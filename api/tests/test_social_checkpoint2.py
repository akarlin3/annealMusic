from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

import pytest
from sqlalchemy import select

from app.models import Account, Session, User, Patch, Recording, Follow, Like, Mute, FeaturedPick
from tests.conftest import VALID_PAYLOAD, make_wav


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
async def test_feed_and_mutes(client):
    from app.db import get_sessionmaker
    sm = get_sessionmaker()

    # 1. Setup Alice (viewer), Bob (creator), and Charlie (creator)
    alice_sess, alice_acc = uuid.uuid4(), uuid.uuid4()
    bob_sess, bob_acc = uuid.uuid4(), uuid.uuid4()
    charlie_sess, charlie_acc = uuid.uuid4(), uuid.uuid4()

    await _create_test_account(sm, "alice@example.com", alice_sess, alice_acc)
    await _create_test_account(sm, "bob@example.com", bob_sess, bob_acc)
    await _create_test_account(sm, "charlie@example.com", charlie_sess, charlie_acc)

    # alice user and bob user
    alice_user_id = alice_acc  # in test conftest, a claimed user shares UUID with the account or is claimed. Let's claim.
    client.cookies.set("am_session", str(alice_sess))
    await client.post("/api/v1/account/me/claim", json={"anon_id": str(alice_sess)})  # we can claim the session id as user id

    client.cookies.set("am_session", str(bob_sess))
    await client.post("/api/v1/account/me/claim", json={"anon_id": str(bob_sess)})

    client.cookies.set("am_session", str(charlie_sess))
    await client.post("/api/v1/account/me/claim", json={"anon_id": str(charlie_sess)})

    # Bob creates a public patch
    client.cookies.set("am_session", str(bob_sess))
    p_res = await client.post(
        "/api/v1/patches",
        headers=_hdr(str(bob_sess)),
        json={"state": VALID_PAYLOAD, "schema_ver": 4, "title": "Bob Ambient", "visibility": "public"},
    )
    assert p_res.status_code == 201

    # Charlie uploads a public recording
    client.cookies.set("am_session", str(charlie_sess))
    wav_data = make_wav(0.5)
    r_res = await client.post(
        "/api/v1/recordings",
        headers=_hdr(str(charlie_sess)),
        data={"format": "wav", "duration_ms": 500, "title": "Charlie Drone", "visibility": "public"},
        files={"file": ("test.wav", wav_data, "audio/wav")},
    )
    assert r_res.status_code == 201

    # Alice follows Bob and Charlie
    client.cookies.set("am_session", str(alice_sess))
    await client.post(f"/api/v1/follows/{bob_acc}", headers=_hdr(str(alice_sess)))
    await client.post(f"/api/v1/follows/{charlie_acc}", headers=_hdr(str(alice_sess)))

    # Alice gets feed -> should contain Bob's patch and Charlie's recording
    feed_res = await client.get("/api/v1/feed", headers=_hdr(str(alice_sess)))
    assert feed_res.status_code == 200
    feed_items = feed_res.json()["items"]
    assert len(feed_items) == 2

    # Alice mutes Bob -> Bob's patch should disappear from Alice's feed
    await client.post(f"/api/v1/mutes/{bob_acc}", headers=_hdr(str(alice_sess)))
    feed_res = await client.get("/api/v1/feed", headers=_hdr(str(alice_sess)))
    assert feed_res.status_code == 200
    feed_items = feed_res.json()["items"]
    assert len(feed_items) == 1
    assert feed_items[0]["title"] == "Charlie Drone"


@pytest.mark.asyncio
async def test_featured_curation(client, app):
    from app.db import get_sessionmaker
    sm = get_sessionmaker()

    # Create creator
    bob_sess, bob_acc = uuid.uuid4(), uuid.uuid4()
    await _create_test_account(sm, "bob@example.com", bob_sess, bob_acc)

    # Bob publishes a public patch
    client.cookies.set("am_session", str(bob_sess))
    await client.post("/api/v1/account/me/claim", json={"anon_id": str(bob_sess)})
    p_res = await client.post(
        "/api/v1/patches",
        headers=_hdr(str(bob_sess)),
        json={"state": VALID_PAYLOAD, "schema_ver": 4, "title": "Curator Target", "visibility": "public"},
    )
    patch_id = p_res.json()["id"]

    # Configure Admin Key in settings
    from app.config import get_settings
    get_settings().admin_key = "secret_admin_key"

    # Curate as Admin
    admin_hdr = {"x-admin-key": "secret_admin_key"}
    curate_res = await client.post(
        "/api/v1/admin/featured",
        headers=admin_hdr,
        json=[{"patch_id": patch_id, "position": 1, "curator_note": "A masterpiece of ambient drift"}],
    )
    assert curate_res.status_code == 200

    # Fetch featured picks (unauthenticated ok)
    feat_res = await client.get("/api/v1/featured")
    assert feat_res.status_code == 200
    picks = feat_res.json()
    assert len(picks) == 1
    assert picks[0]["patch"]["title"] == "Curator Target"
    assert picks[0]["curator_note"] == "A masterpiece of ambient drift"


@pytest.mark.asyncio
async def test_profile_tabs_and_privacy(client):
    from app.db import get_sessionmaker
    sm = get_sessionmaker()

    sess1, acc1 = uuid.uuid4(), uuid.uuid4()
    sess2, acc2 = uuid.uuid4(), uuid.uuid4()

    await _create_test_account(sm, "alice@example.com", sess1, acc1)
    await _create_test_account(sm, "bob@example.com", sess2, acc2)

    # Bob likes a patch, Alice gets Bob's profile tabs
    client.cookies.set("am_session", str(sess2))
    await client.post("/api/v1/account/me/claim", json={"anon_id": str(sess2)})

    # Bob saves a public patch
    p_res = await client.post(
        "/api/v1/patches",
        headers=_hdr(str(sess2)),
        json={"state": VALID_PAYLOAD, "schema_ver": 4, "title": "Bob Masterpiece", "visibility": "public"},
    )
    patch_id = p_res.json()["id"]

    # Bob likes it himself
    await client.post(
        "/api/v1/likes",
        headers=_hdr(str(sess2)),
        json={"target_kind": "patch", "target_id": patch_id},
    )

    # Alice views Bob's patches
    client.cookies.set("am_session", str(sess1))
    profile_patches = await client.get(f"/api/v1/profiles/{acc2}/patches")
    assert profile_patches.status_code == 200
    assert len(profile_patches.json()["items"]) == 1
    assert profile_patches.json()["items"][0]["title"] == "Bob Masterpiece"

    # Alice views Bob's likes -> should return 403 Forbidden because Bob's likes are private by default
    profile_likes = await client.get(f"/api/v1/profiles/{acc2}/liked")
    assert profile_likes.status_code == 403

    # Bob updates settings to make likes public
    client.cookies.set("am_session", str(sess2))
    patch_settings = await client.patch(
        "/api/v1/account/me",
        json={"likes_public": True, "bio": "Crafting procedural drones."},
    )
    assert patch_settings.status_code == 200
    assert patch_settings.json()["likes_public"] is True

    # Alice views Bob's likes again -> now works!
    client.cookies.set("am_session", str(sess1))
    profile_likes = await client.get(f"/api/v1/profiles/{acc2}/liked")
    assert profile_likes.status_code == 200
    assert len(profile_likes.json()["items"]) == 1


@pytest.mark.asyncio
async def test_account_suspension(client):
    from app.db import get_sessionmaker
    sm = get_sessionmaker()

    sess, acc = uuid.uuid4(), uuid.uuid4()
    await _create_test_account(sm, "offender@example.com", sess, acc)

    # Bob logs in and creates content
    client.cookies.set("am_session", str(sess))
    await client.post("/api/v1/account/me/claim", json={"anon_id": str(sess)})
    await client.post(
        "/api/v1/patches",
        headers=_hdr(str(sess)),
        json={"state": VALID_PAYLOAD, "schema_ver": 4, "title": "Violating Patch", "visibility": "public"},
    )

    # Admin key config
    from app.config import get_settings
    get_settings().admin_key = "secret_admin_key"

    # Admin suspends Bob
    admin_hdr = {"x-admin-key": "secret_admin_key"}
    susp_res = await client.post(f"/api/v1/admin/accounts/{acc}/suspend", headers=admin_hdr)
    assert susp_res.status_code == 200

    # Bob tries to make requests -> should be gated with 403 Forbidden
    client.cookies.set("am_session", str(sess))
    failed_req = await client.get("/api/v1/account/me", headers=_hdr(str(sess)))
    assert failed_req.status_code == 403
    assert "Authentication required." in failed_req.json()["message"]
