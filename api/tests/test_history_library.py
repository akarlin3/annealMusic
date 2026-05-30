from __future__ import annotations

import uuid

import pytest

from tests.test_social_checkpoint1 import _create_test_account


def _hdr(anon: str | None = None) -> dict[str, str]:
    return {"x-anon-id": anon or str(uuid.uuid4())}


@pytest.fixture
def admin_key(monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("ADMIN_KEY", "secret")
    get_settings.cache_clear()
    return "secret"


async def _make_listening_session(client, headers) -> dict:
    """Create a Piece + a Listening Session wrapping it; return the LS dict."""
    segments = [{"type": "fixed", "duration_ms": 60000, "config": {"rootFreq": 150}}]
    piece = (
        await client.post(
            "/api/v1/pieces",
            headers=headers,
            json={
                "defaults_state": {"m": "open", "e": "sine", "rootFreq": 147},
                "schema_ver": 8,
                "title": "Calm Piece",
                "visibility": "public",
                "segments": segments,
            },
        )
    ).json()
    ls = (
        await client.post(
            "/api/v1/listening-sessions",
            headers=headers,
            json={
                "piece_id": piece["id"],
                "schema_ver": 20,
                "title": "Evening Settle",
                "intention": "evening",
                "length_category": "short",
                "visibility": "public",
            },
        )
    ).json()
    return ls


async def _signed_in(client, email: str) -> tuple[dict, uuid.UUID]:
    """Create an account, claim an anon user id, return (headers, session_id)."""
    from app.db import get_sessionmaker

    sm = get_sessionmaker()
    sess_id, acc_id = uuid.uuid4(), uuid.uuid4()
    anon = str(uuid.uuid4())
    await _create_test_account(sm, email, sess_id, acc_id)
    client.cookies.set("am_session", str(sess_id))
    await client.post("/api/v1/account/me/claim", json={"anon_id": anon})
    return _hdr(anon), sess_id


# --- History ----------------------------------------------------------------


async def test_history_requires_account(client):
    """Anonymous callers cannot log history — they get 401 (the sign-in nudge)."""
    h = _hdr()
    ls = await _make_listening_session(client, h)
    r = await client.post(
        "/api/v1/me/sessions",
        headers=h,
        json={"listening_session_id": ls["id"]},
    )
    assert r.status_code == 401


async def test_log_finalize_list_and_stats(client):
    h, sess = await _signed_in(client, "hist1@example.com")
    ls = await _make_listening_session(client, h)
    client.cookies.set("am_session", str(sess))

    # Log on start.
    created = await client.post(
        "/api/v1/me/sessions",
        headers=h,
        json={"listening_session_id": ls["id"]},
    )
    assert created.status_code == 201
    play = created.json()
    assert play["completed_at"] is None
    assert play["duration_listened_ms"] == 0
    assert play["session_title"] == "Evening Settle"

    # Finalize on completion with a partial duration + reflection.
    fin = await client.patch(
        f"/api/v1/me/sessions/{play['id']}",
        headers=h,
        json={
            "completed_at": "2026-05-30T10:00:00+00:00",
            "duration_listened_ms": 45000,
            "reflection": "Felt settled.",
        },
    )
    assert fin.status_code == 200
    assert fin.json()["duration_listened_ms"] == 45000
    assert fin.json()["reflection"] == "Felt settled."

    # List newest-first.
    listed = await client.get("/api/v1/me/sessions", headers=h)
    assert listed.status_code == 200
    items = listed.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == play["id"]

    # Stats: minimal + descriptive, no engagement-signal fields.
    stats = await client.get("/api/v1/me/sessions/stats", headers=h)
    assert stats.status_code == 200
    s = stats.json()
    assert s["total_sessions"] == 1
    assert s["total_listened_ms"] == 45000
    assert s["average_length_ms"] == 45000
    assert s["this_month_sessions"] == 1
    # Calm-by-design: no streak/rank/goal anywhere in the stats payload.
    banned = {"streak", "rank", "goal", "level", "badge", "achievement", "days_in_a_row"}
    assert banned.isdisjoint(set(s.keys()))


async def test_reflection_max_length_enforced(client):
    h, sess = await _signed_in(client, "hist2@example.com")
    ls = await _make_listening_session(client, h)
    client.cookies.set("am_session", str(sess))
    play = (
        await client.post(
            "/api/v1/me/sessions",
            headers=h,
            json={"listening_session_id": ls["id"]},
        )
    ).json()
    r = await client.patch(
        f"/api/v1/me/sessions/{play['id']}",
        headers=h,
        json={"reflection": "x" * 501},
    )
    assert r.status_code == 422


async def test_forget_a_session(client):
    h, sess = await _signed_in(client, "hist3@example.com")
    ls = await _make_listening_session(client, h)
    client.cookies.set("am_session", str(sess))
    play = (
        await client.post(
            "/api/v1/me/sessions",
            headers=h,
            json={"listening_session_id": ls["id"]},
        )
    ).json()
    d = await client.delete(f"/api/v1/me/sessions/{play['id']}", headers=h)
    assert d.status_code == 204
    listed = await client.get("/api/v1/me/sessions", headers=h)
    assert listed.json()["items"] == []


async def test_history_is_cross_device(client):
    """Two anon devices under one account see a unified history."""
    from app.db import get_sessionmaker

    sm = get_sessionmaker()
    sess_id, acc_id = uuid.uuid4(), uuid.uuid4()
    anon_a, anon_b = str(uuid.uuid4()), str(uuid.uuid4())
    await _create_test_account(sm, "cross@example.com", sess_id, acc_id)
    client.cookies.set("am_session", str(sess_id))
    await client.post("/api/v1/account/me/claim", json={"anon_id": anon_a})
    await client.post("/api/v1/account/me/claim", json={"anon_id": anon_b})

    ls = await _make_listening_session(client, _hdr(anon_a))
    client.cookies.set("am_session", str(sess_id))
    await client.post(
        "/api/v1/me/sessions",
        headers=_hdr(anon_a),
        json={"listening_session_id": ls["id"]},
    )
    await client.post(
        "/api/v1/me/sessions",
        headers=_hdr(anon_b),
        json={"listening_session_id": ls["id"]},
    )

    # Listing from either device shows both plays.
    listed = await client.get("/api/v1/me/sessions", headers=_hdr(anon_b))
    assert len(listed.json()["items"]) == 2


# --- Library ----------------------------------------------------------------


async def test_admin_add_and_public_filters(client, admin_key):
    h = _hdr()
    ls = await _make_listening_session(client, h)

    add = await client.post(
        "/api/v1/admin/library",
        headers={"x-admin-key": admin_key},
        json={
            "listening_session_id": ls["id"],
            "intention": "evening",
            "length_category": "short",
            "character_tags": ["composed", "spoken_word_free"],
            "curator_note": "A gentle wind-down.",
        },
    )
    assert add.status_code == 201
    listing = add.json()
    assert listing["intention"] == "evening"
    assert "composed" in listing["character_tags"]
    assert listing["session_title"] == "Evening Settle"

    # Public list, unfiltered.
    pub = await client.get("/api/v1/library")
    assert pub.status_code == 200
    assert len(pub.json()["items"]) == 1

    # Filter by intention (match + miss).
    assert len((await client.get("/api/v1/library?intention=evening")).json()["items"]) == 1
    assert len((await client.get("/api/v1/library?intention=morning")).json()["items"]) == 0
    # Filter by length.
    assert len((await client.get("/api/v1/library?length=short")).json()["items"]) == 1
    assert len((await client.get("/api/v1/library?length=long")).json()["items"]) == 0
    # Filter by character tag.
    assert len((await client.get("/api/v1/library?character=composed")).json()["items"]) == 1
    assert len((await client.get("/api/v1/library?character=with_bells")).json()["items"]) == 0


async def test_admin_rejects_unknown_taxonomy(client, admin_key):
    h = _hdr()
    ls = await _make_listening_session(client, h)
    r = await client.post(
        "/api/v1/admin/library",
        headers={"x-admin-key": admin_key},
        json={"listening_session_id": ls["id"], "intention": "doomscroll"},
    )
    assert r.status_code == 400


async def test_editor_picks_surface(client, admin_key):
    h = _hdr()
    ls = await _make_listening_session(client, h)
    listing = (
        await client.post(
            "/api/v1/admin/library",
            headers={"x-admin-key": admin_key},
            json={"listening_session_id": ls["id"], "intention": "morning"},
        )
    ).json()

    # Not a pick yet.
    assert (await client.get("/api/v1/library/picks")).json()["items"] == []

    # Promote to editor pick.
    upd = await client.patch(
        f"/api/v1/admin/library/{listing['id']}",
        headers={"x-admin-key": admin_key},
        json={"editor_pick": True},
    )
    assert upd.status_code == 200
    assert upd.json()["editor_pick"] is True
    assert upd.json()["editor_pick_at"] is not None

    picks = await client.get("/api/v1/library/picks")
    assert len(picks.json()["items"]) == 1
    # Also surfaces via ?picks=only.
    assert len((await client.get("/api/v1/library?picks=only")).json()["items"]) == 1


async def test_archive_removes_from_public(client, admin_key):
    h = _hdr()
    ls = await _make_listening_session(client, h)
    listing = (
        await client.post(
            "/api/v1/admin/library",
            headers={"x-admin-key": admin_key},
            json={"listening_session_id": ls["id"], "intention": "focus"},
        )
    ).json()

    d = await client.delete(
        f"/api/v1/admin/library/{listing['id']}",
        headers={"x-admin-key": admin_key},
    )
    assert d.status_code == 204
    assert (await client.get("/api/v1/library")).json()["items"] == []
    # Still visible to admin with include_archived.
    admin_list = await client.get(
        "/api/v1/admin/library?include_archived=true",
        headers={"x-admin-key": admin_key},
    )
    assert len(admin_list.json()["items"]) == 1


async def test_library_admin_requires_key(client):
    r = await client.get("/api/v1/library")  # public read is open
    assert r.status_code == 200
    # Admin add without key (ADMIN_KEY unset) → 404, no oracle.
    r2 = await client.post(
        "/api/v1/admin/library",
        json={"listening_session_id": str(uuid.uuid4())},
    )
    assert r2.status_code == 404
