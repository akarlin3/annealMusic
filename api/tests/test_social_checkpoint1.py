from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

import pytest
from sqlalchemy import select

from app.models import Account, Session, User, Patch, Recording, Like, Follow, Block, Mute
from tests.conftest import VALID_PAYLOAD


def _hdr(anon: str | None = None) -> dict[str, str]:
    return {"x-anon-id": anon or str(uuid.uuid4())}


async def _create_test_account(session_maker, email: str, sess_id: uuid.UUID, acc_id: uuid.UUID) -> tuple[Account, Session]:
    async with session_maker() as session:
        acc = Account(
            id=acc_id,
            email=email,
            email_verified=True,
            display_name=f"User {email.split('@')[0]}",
        )
        db_sess = Session(
            id=sess_id,
            account_id=acc_id,
            expires_at=datetime.now(tz=timezone.utc) + timedelta(days=30),
        )
        session.add(acc)
        session.add(db_sess)
        await session.commit()
    return acc, db_sess


@pytest.mark.asyncio
async def test_likes_workflow(client):
    # Setup anon user
    h = _hdr()

    # Create a public patch
    p_res = await client.post(
        "/api/v1/patches",
        headers=h,
        json={"state": VALID_PAYLOAD, "schema_ver": 4, "title": "Glow", "visibility": "public"},
    )
    assert p_res.status_code == 201
    patch = p_res.json()
    patch_id = patch["id"]

    # 1. Like the patch
    like_res = await client.post(
        "/api/v1/likes",
        headers=h,
        json={"target_kind": "patch", "target_id": patch_id},
    )
    assert like_res.status_code == 200
    assert like_res.json()["liked"] is True

    # Check status
    status_res = await client.get(
        f"/api/v1/likes/status?target_kind=patch&target_id={patch_id}",
        headers=h,
    )
    assert status_res.status_code == 200
    assert status_res.json()["liked"] is True

    # Verify count updated on the patch (via database triggers)
    from app.db import get_sessionmaker
    async with get_sessionmaker()() as session:
        p_db = await session.get(Patch, uuid.UUID(patch_id))
        assert p_db.like_count == 1

    # 2. Unlike the patch
    unlike_res = await client.delete(
        f"/api/v1/likes/patch/{patch_id}",
        headers=h,
    )
    assert unlike_res.status_code == 200
    assert unlike_res.json()["liked"] is False

    # Verify count decremented
    async with get_sessionmaker()() as session:
        p_db = await session.get(Patch, uuid.UUID(patch_id))
        assert p_db.like_count == 0


@pytest.mark.asyncio
async def test_follows_and_blocks_workflow(client):
    from app.db import get_sessionmaker
    sm = get_sessionmaker()

    # Setup two logged-in accounts
    sess1, acc1 = uuid.uuid4(), uuid.uuid4()
    sess2, acc2 = uuid.uuid4(), uuid.uuid4()

    await _create_test_account(sm, "alice@example.com", sess1, acc1)
    await _create_test_account(sm, "bob@example.com", sess2, acc2)

    # 1. Alice follows Bob
    client.cookies.set("am_session", str(sess1))
    f_res = await client.post(f"/api/v1/follows/{acc2}", headers=_hdr())
    assert f_res.status_code == 200
    assert f_res.json()["following"] is True

    # Verify follower counts on accounts (triggers)
    async with sm() as session:
        a1 = await session.get(Account, acc1)
        a2 = await session.get(Account, acc2)
        assert a1.following_count == 1
        assert a2.follower_count == 1

    # 2. Alice blocks Bob -> should auto-unfollow Bob
    block_res = await client.post(f"/api/v1/blocks/{acc2}", headers=_hdr())
    assert block_res.status_code == 200

    # Verify follow record deleted, block record created, and counts decremented
    async with sm() as session:
        follows = (await session.execute(select(Follow))).scalars().all()
        assert len(follows) == 0

        blocks = (await session.execute(select(Block))).scalars().all()
        assert len(blocks) == 1
        assert blocks[0].blocker_account_id == acc1
        assert blocks[0].blocked_account_id == acc2

        a1 = await session.get(Account, acc1)
        a2 = await session.get(Account, acc2)
        assert a1.following_count == 0
        assert a2.follower_count == 0

    # 3. Bob attempts to follow Alice -> returns 404 account not found due to block
    client.cookies.set("am_session", str(sess2))
    f_fail = await client.post(f"/api/v1/follows/{acc1}", headers=_hdr())
    assert f_fail.status_code == 404


@pytest.mark.asyncio
async def test_mutes_workflow(client):
    from app.db import get_sessionmaker
    sm = get_sessionmaker()

    sess1, acc1 = uuid.uuid4(), uuid.uuid4()
    sess2, acc2 = uuid.uuid4(), uuid.uuid4()

    await _create_test_account(sm, "muter@example.com", sess1, acc1)
    await _create_test_account(sm, "muted@example.com", sess2, acc2)

    # Alice mutes Bob
    client.cookies.set("am_session", str(sess1))
    mute_res = await client.post(f"/api/v1/mutes/{acc2}", headers=_hdr())
    assert mute_res.status_code == 200

    # Verify mute in DB
    async with sm() as session:
        mutes = (await session.execute(select(Mute))).scalars().all()
        assert len(mutes) == 1
        assert mutes[0].muter_account_id == acc1
        assert mutes[0].muted_account_id == acc2

    # Unmute Bob
    unmute_res = await client.delete(f"/api/v1/mutes/{acc2}", headers=_hdr())
    assert unmute_res.status_code == 200

    # Verify mute removed from DB
    async with sm() as session:
        mutes = (await session.execute(select(Mute))).scalars().all()
        assert len(mutes) == 0


@pytest.mark.asyncio
async def test_social_self_interaction_checks(client):
    from app.db import get_sessionmaker
    sm = get_sessionmaker()

    sess, acc = uuid.uuid4(), uuid.uuid4()
    await _create_test_account(sm, "self@example.com", sess, acc)

    client.cookies.set("am_session", str(sess))

    # Self-follow rejected
    f_res = await client.post(f"/api/v1/follows/{acc}", headers=_hdr())
    assert f_res.status_code == 400

    # Self-block rejected
    b_res = await client.post(f"/api/v1/blocks/{acc}", headers=_hdr())
    assert b_res.status_code == 400

    # Self-mute rejected
    m_res = await client.post(f"/api/v1/mutes/{acc}", headers=_hdr())
    assert m_res.status_code == 400
