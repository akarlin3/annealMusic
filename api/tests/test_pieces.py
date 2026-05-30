from __future__ import annotations

import uuid
import pytest

def _hdr(anon: str | None = None) -> dict[str, str]:
    return {"x-anon-id": anon or str(uuid.uuid4())}

async def test_create_and_get_piece(client):
    h = _hdr()
    # Define a default state and a sequence of segments
    defaults = {"m": "open", "e": "sine", "rootFreq": 147}
    segments = [
        {"type": "fixed", "duration_ms": 5000, "config": {"rootFreq": 150}},
        {"type": "transition", "duration_ms": 3000, "config": {"easing": "linear"}},
        {"type": "open", "duration_ms": None, "config": {}},
    ]

    r = await client.post(
        "/api/v1/pieces",
        headers=h,
        json={
            "defaults_state": defaults,
            "schema_ver": 8,
            "title": "My Ambient Symphony",
            "description": "A deep generative journey.",
            "visibility": "unlisted",
            "segments": segments,
        },
    )
    assert r.status_code == 201, r.text
    piece = r.json()
    assert piece["title"] == "My Ambient Symphony"
    assert piece["defaults_state"] == defaults
    assert len(piece["segments"]) == 3
    assert piece["segments"][0]["type"] == "fixed"
    assert piece["segments"][0]["duration_ms"] == 5000
    assert piece["segments"][1]["type"] == "transition"
    assert piece["has_open_segment"] is True
    assert piece["total_duration_ms"] is None # Open piece has no bounded total duration
    assert piece["short_slug"]

    # Retrieve by id.
    g = await client.get(f"/api/v1/pieces/{piece['id']}")
    assert g.status_code == 200
    assert g.json()["title"] == "My Ambient Symphony"
    assert len(g.json()["segments"]) == 3

    # Retrieve by slug.
    g2 = await client.get(f"/api/v1/pieces/{piece['short_slug']}")
    assert g2.status_code == 200
    assert g2.json()["id"] == piece["id"]

async def test_update_piece(client):
    h = _hdr()
    defaults = {"m": "open", "e": "sine", "rootFreq": 147}
    segments = [
        {"type": "fixed", "duration_ms": 5000, "config": {"rootFreq": 150}},
    ]
    created = (
        await client.post(
            "/api/v1/pieces",
            headers=h,
            json={
                "defaults_state": defaults,
                "schema_ver": 8,
                "title": "Old Title",
                "segments": segments,
            },
        )
    ).json()

    # Update metadata
    r = await client.patch(
        f"/api/v1/pieces/{created['id']}",
        headers=h,
        json={
            "title": "New Title",
            "visibility": "public",
        },
    )
    assert r.status_code == 200
    updated = r.json()
    assert updated["title"] == "New Title"
    assert updated["visibility"] == "public"

    # Update segments
    new_segments = [
        {"type": "fixed", "duration_ms": 4000, "config": {"rootFreq": 180}},
        {"type": "fixed", "duration_ms": 6000, "config": {"rootFreq": 200}},
    ]
    r2 = await client.patch(
        f"/api/v1/pieces/{created['id']}",
        headers=h,
        json={
            "segments": new_segments,
        },
    )
    assert r2.status_code == 200
    updated2 = r2.json()
    assert len(updated2["segments"]) == 2
    assert updated2["segments"][0]["duration_ms"] == 4000
    assert updated2["segments"][1]["duration_ms"] == 6000
    assert updated2["has_open_segment"] is False
    assert updated2["total_duration_ms"] == 10000

async def test_delete_piece(client):
    h = _hdr()
    defaults = {"m": "open", "e": "sine", "rootFreq": 147}
    segments = [{"type": "fixed", "duration_ms": 1000, "config": {}}]
    created = (
        await client.post(
            "/api/v1/pieces",
            headers=h,
            json={
                "defaults_state": defaults,
                "schema_ver": 8,
                "segments": segments,
            },
        )
    ).json()

    # Delete.
    d = await client.delete(f"/api/v1/pieces/{created['id']}", headers=h)
    assert d.status_code == 204

    # Verify deleted.
    g = await client.get(f"/api/v1/pieces/{created['id']}")
    assert g.status_code == 404

async def test_list_my_pieces(client):
    a = str(uuid.uuid4())
    defaults = {"m": "open", "e": "sine", "rootFreq": 147}
    segments = [{"type": "fixed", "duration_ms": 1000, "config": {}}]

    for i in range(3):
        await client.post(
            "/api/v1/pieces",
            headers={"x-anon-id": a},
            json={
                "defaults_state": defaults,
                "schema_ver": 8,
                "title": f"piece{i}",
                "segments": segments,
            },
        )

    r = await client.get("/api/v1/pieces/me", headers={"x-anon-id": a})
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 3
    assert all(p["title"].startswith("piece") for p in items)

async def test_piece_likes_and_feed(client):
    from app.db import get_sessionmaker
    sm = get_sessionmaker()

    # 1. Setup two logged-in accounts
    sess1, acc1 = uuid.uuid4(), uuid.uuid4()
    sess2, acc2 = uuid.uuid4(), uuid.uuid4()
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())
    h_a = _hdr(user_a)
    h_b = _hdr(user_b)

    from tests.test_social_checkpoint1 import _create_test_account
    await _create_test_account(sm, "piece_a@example.com", sess1, acc1)
    await _create_test_account(sm, "piece_b@example.com", sess2, acc2)

    # 1.5 Claim anonymous user IDs to link User A and User B users with accounts
    client.cookies.set("am_session", str(sess1))
    await client.post("/api/v1/account/me/claim", json={"anon_id": user_a})
    client.cookies.set("am_session", str(sess2))
    await client.post("/api/v1/account/me/claim", json={"anon_id": user_b})

    # 2. User B follows User A (Account 2 follows Account 1)
    client.cookies.set("am_session", str(sess2))
    follow = await client.post(f"/api/v1/follows/{acc1}", headers=h_b)
    assert follow.status_code == 200

    # 3. User A creates a public piece (using session 1)
    client.cookies.clear()
    client.cookies.set("am_session", str(sess1))
    
    defaults = {"m": "open", "e": "sine", "rootFreq": 147}
    segments = [{"type": "fixed", "duration_ms": 1000, "config": {}}]
    piece = (
        await client.post(
            "/api/v1/pieces",
            headers=h_a,
            json={
                "defaults_state": defaults,
                "schema_ver": 8,
                "title": "Public Masterpiece",
                "description": "Lovely ambient sounds",
                "visibility": "public",
                "segments": segments,
            },
        )
    ).json()

    # 4. User B likes the piece (using session 2)
    client.cookies.clear()
    client.cookies.set("am_session", str(sess2))
    
    like = await client.post(
        "/api/v1/likes",
        headers=h_b,
        json={
            "target_kind": "piece",
            "target_id": piece["id"],
        },
    )
    assert like.status_code == 200
    assert like.json()["liked"] is True

    # 5. Check like status
    status = await client.get(
        f"/api/v1/likes/status?target_kind=piece&target_id={piece['id']}",
        headers=h_b,
    )
    assert status.status_code == 200
    assert status.json()["liked"] is True

    # 6. Retrieve piece to verify like_count is 1
    g = await client.get(f"/api/v1/pieces/{piece['id']}")
    assert g.json()["like_count"] == 1

    # 7. Check User B's activity feed, should contain the piece
    feed = await client.get("/api/v1/feed", headers=h_b)
    assert feed.status_code == 200
    feed_items = feed.json()["items"]
    assert len(feed_items) > 0
    piece_feed_item = next(item for item in feed_items if item["id"] == piece["id"])
    assert piece_feed_item["kind"] == "piece"
    assert piece_feed_item["title"] == "Public Masterpiece"
    assert piece_feed_item["like_count"] == 1
    assert piece_feed_item["liked_by_me"] is True
    assert piece_feed_item["mode"] == "piece"

    # 8. User B unlikes the piece
    unlike = await client.delete(
        f"/api/v1/likes/piece/{piece['id']}",
        headers=h_b,
    )
    assert unlike.status_code == 200
    assert unlike.json()["liked"] is False

    # 9. Verify like_count is back to 0
    client.cookies.clear()
    g2 = await client.get(f"/api/v1/pieces/{piece['id']}")
    assert g2.json()["like_count"] == 0
