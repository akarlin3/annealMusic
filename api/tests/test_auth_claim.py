from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.models import Account, AccountProvider, MagicLink, Patch, Session, User
from app.services.email import NoOpEmailClient, set_email_client


@pytest.mark.asyncio
async def test_request_magic_link_success(client, app):
    # Setup NoOpEmailClient mock
    email_client = NoOpEmailClient()
    set_email_client(email_client)

    r = await client.post(
        "/api/v1/auth/email/request",
        json={"email": "test@example.com", "intent": "login"},
    )
    assert r.status_code == 202
    assert r.json()["message"] == "If the email is valid, a link has been sent."

    # Verify magic link inserted in DB
    from app.db import get_sessionmaker
    sm = get_sessionmaker()
    async with sm() as session:
        links = (await session.execute(select(MagicLink))).scalars().all()
        assert len(links) == 1
        assert links[0].email == "test@example.com"
        assert links[0].intent == "login"
        assert links[0].consumed_at is None

        # Verify email client received the link
        assert len(email_client.sent_emails) == 1
        assert email_client.sent_emails[0][0] == "test@example.com"
        assert str(links[0].token) in email_client.sent_emails[0][1]


@pytest.mark.asyncio
async def test_magic_link_verify_and_session(client):
    # Setup link in DB
    from app.db import get_sessionmaker
    sm = get_sessionmaker()
    token = uuid.uuid4()
    expires_at = datetime.now(tz=timezone.utc) + timedelta(minutes=15)

    async with sm() as session:
        link = MagicLink(
            token=token,
            email="test@example.com",
            intent="signup",
            expires_at=expires_at,
        )
        session.add(link)
        await session.commit()

    # Verify link
    r = await client.get(f"/api/v1/auth/email/verify?token={token}")
    assert r.status_code == 302
    assert "signed_in=1" in r.headers["location"]

    # Verify session cookie was set
    cookies = r.cookies
    assert "am_session" in cookies
    session_id = cookies["am_session"]

    # Verify account and session in DB
    async with sm() as db_session:
        # Account
        stmt = select(Account).where(Account.email == "test@example.com")
        account = (await db_session.execute(stmt)).scalar_one()
        assert account.email_verified is True
        assert account.avatar_seed is not None

        # Providers
        prov = (
            await db_session.execute(
                select(AccountProvider).where(AccountProvider.account_id == account.id)
            )
        ).scalar_one()
        assert prov.provider == "email"
        assert prov.subject == "test@example.com"

        # Session
        db_sess = (
            await db_session.execute(
                select(Session).where(Session.id == uuid.UUID(session_id))
            )
        ).scalar_one()
        assert db_sess.account_id == account.id

    # Check active session route
    client.cookies.set("am_session", session_id)
    session_res = await client.get("/api/v1/auth/session")
    assert session_res.status_code == 200
    assert session_res.json()["account"]["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_expired_or_consumed_magic_link_fails(client):
    from app.db import get_sessionmaker
    sm = get_sessionmaker()

    # 1. Expired link
    token_expired = uuid.uuid4()
    expires_at = datetime.now(tz=timezone.utc) - timedelta(minutes=1)

    async with sm() as session:
        link = MagicLink(
            token=token_expired,
            email="test@example.com",
            intent="login",
            expires_at=expires_at,
        )
        session.add(link)
        await session.commit()

    r = await client.get(f"/api/v1/auth/email/verify?token={token_expired}")
    assert r.status_code == 302
    assert "error=invalid_token" in r.headers["location"]

    # 2. Consumed link
    token_consumed = uuid.uuid4()
    expires_at = datetime.now(tz=timezone.utc) + timedelta(minutes=15)

    async with sm() as session:
        link = MagicLink(
            token=token_consumed,
            email="test@example.com",
            intent="login",
            expires_at=expires_at,
            consumed_at=datetime.now(tz=timezone.utc),
        )
        session.add(link)
        await session.commit()

    r = await client.get(f"/api/v1/auth/email/verify?token={token_consumed}")
    assert r.status_code == 302
    assert "error=invalid_token" in r.headers["location"]


@pytest.mark.asyncio
async def test_profile_update_and_delete(client):
    # 1. Sign up/log in first
    from app.db import get_sessionmaker
    sm = get_sessionmaker()
    account_id = uuid.uuid4()
    session_id = uuid.uuid4()
    expires_at = datetime.now(tz=timezone.utc) + timedelta(days=30)

    async with sm() as session:
        acc = Account(
            id=account_id,
            email="profile@example.com",
            email_verified=True,
        )
        db_sess = Session(
            id=session_id,
            account_id=account_id,
            expires_at=expires_at,
        )
        session.add(acc)
        session.add(db_sess)
        await session.commit()

    client.cookies.set("am_session", str(session_id))

    # 2. Get profile
    r = await client.get("/api/v1/account/me")
    assert r.status_code == 200
    assert r.json()["email"] == "profile@example.com"
    assert r.json()["display_name"] is None

    # 3. Patch profile (valid name)
    r = await client.patch(
        "/api/v1/account/me",
        json={"display_name": "Sonic Sculptor", "avatar_seed": "new_seed"},
    )
    assert r.status_code == 200
    assert r.json()["display_name"] == "Sonic Sculptor"
    assert r.json()["avatar_seed"] == "new_seed"

    # 4. Patch profile (invalid name with profanity)
    r = await client.patch(
        "/api/v1/account/me",
        json={"display_name": "fuck"},
    )
    assert r.status_code == 400  # screened

    # 5. Delete account matching email
    r = await client.request(
        "DELETE",
        "/api/v1/account/me",
        json={"confirm_email": "profile@example.com"},
    )
    assert r.status_code == 204

    # Verify deleted
    async with sm() as session:
        acc_check = await session.get(Account, account_id)
        assert acc_check is None


@pytest.mark.asyncio
async def test_claiming_flow_and_conflict(client):
    from app.db import get_sessionmaker
    sm = get_sessionmaker()

    # Setup: two accounts and two anonymous users (devices)
    acc1_id = uuid.uuid4()
    sess1_id = uuid.uuid4()
    acc2_id = uuid.uuid4()
    sess2_id = uuid.uuid4()

    anon1_id = uuid.uuid4()
    anon2_id = uuid.uuid4()

    async with sm() as session:
        # Create accounts
        session.add(Account(id=acc1_id, email="acc1@example.com", email_verified=True))
        session.add(Account(id=acc2_id, email="acc2@example.com", email_verified=True))

        # Create sessions
        session.add(Session(id=sess1_id, account_id=acc1_id, expires_at=datetime.now(tz=timezone.utc) + timedelta(days=1)))
        session.add(Session(id=sess2_id, account_id=acc2_id, expires_at=datetime.now(tz=timezone.utc) + timedelta(days=1)))

        # Create anon users
        session.add(User(id=anon1_id))
        session.add(User(id=anon2_id))
        await session.commit()

    # 1. Account 1 claims Device 1
    client.cookies.set("am_session", str(sess1_id))
    r = await client.post("/api/v1/account/me/claim", json={"anon_id": str(anon1_id)})
    assert r.status_code == 200
    assert r.json()["success"] is True

    # Verify ownership in DB
    async with sm() as session:
        u1 = await session.get(User, anon1_id)
        assert u1.account_id == acc1_id

    # 2. Account 2 attempts to claim Device 1 -> 409 Conflict
    client.cookies.set("am_session", str(sess2_id))
    r = await client.post("/api/v1/account/me/claim", json={"anon_id": str(anon1_id)})
    assert r.status_code == 409
    assert r.json()["detail"]["error"] == "anon_id_already_claimed"

    # 3. Account 1 unclaims Device 1
    client.cookies.set("am_session", str(sess1_id))
    r = await client.delete(f"/api/v1/account/me/claim/{anon1_id}")
    assert r.status_code == 204

    # Verify unclaimed
    async with sm() as session:
        u1 = await session.get(User, anon1_id)
        assert u1.account_id is None


@pytest.mark.asyncio
async def test_email_rate_limit(client, app):
    # Setup rate limiter reset
    app.state.rate_limiter.reset()

    # Hit Magic Link endpoint repeatedly
    for _ in range(5):
        r = await client.post(
            "/api/v1/auth/email/request",
            json={"email": "limit@example.com", "intent": "login"},
        )
        assert r.status_code == 202

    # 6th hit should fail with 429
    r = await client.post(
        "/api/v1/auth/email/request",
        json={"email": "limit@example.com", "intent": "login"},
    )
    assert r.status_code == 429
