from __future__ import annotations

import uuid
import pytest
from sqlalchemy.engine import Engine
from sqlalchemy.event import listens_for

@pytest.fixture(autouse=True)
def enable_sqlite_fk():
    @listens_for(Engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA foreign_keys=ON")
        except Exception:
            pass
        finally:
            cursor.close()
            
    yield
    
    from sqlalchemy.event import remove
    try:
        remove(Engine, "connect", set_sqlite_pragma)
    except Exception:
        pass

def _hdr(anon: str | None = None) -> dict[str, str]:
    return {"x-anon-id": anon or str(uuid.uuid4())}

async def test_create_and_get_listening_session(client):
    h = _hdr()
    
    # 1. Create an underlying piece (fixed duration = 10s)
    defaults = {"m": "open", "e": "sine", "rootFreq": 147}
    segments = [
        {"type": "fixed", "duration_ms": 5000, "config": {"rootFreq": 150}},
        {"type": "fixed", "duration_ms": 5000, "config": {"rootFreq": 160}},
    ]
    piece_res = await client.post(
        "/api/v1/pieces",
        headers=h,
        json={
            "defaults_state": defaults,
            "schema_ver": 8,
            "title": "My Composition",
            "segments": segments,
        },
    )
    assert piece_res.status_code == 201
    piece = piece_res.json()
    assert piece["total_duration_ms"] == 10000

    # 2. Create a Listening Session wrapping this Piece
    ls_res = await client.post(
        "/api/v1/listening-sessions",
        headers=h,
        json={
            "piece_id": piece["id"],
            "schema_ver": 19,
            "title": "Evening Meditation",
            "description": "Slow down and breathe.",
            "intention": "Evening Release",
            "length_category": "short",
            "recommended_environment": "Quiet room",
            "settle_in_ms": 15000,
            "integration_ms": 30000,
            "bell_schedule": [
                {"bellId": "zen_bell_rin", "trigger": "at-start", "volume": 0.7},
                {"bellId": "zen_bell_rin", "trigger": "at-end", "volume": 0.7},
            ],
            "visibility": "unlisted",
        },
    )
    assert ls_res.status_code == 201, ls_res.text
    ls = ls_res.json()
    assert ls["title"] == "Evening Meditation"
    assert ls["piece_id"] == piece["id"]
    assert len(ls["bell_schedule"]) == 2
    assert ls["bell_schedule"][0]["bellId"] == "zen_bell_rin"
    # Layered concurrently, total duration is exactly the piece's duration
    assert ls["total_duration_ms"] == 10000
    assert ls["piece"]["title"] == "My Composition"
    assert ls["short_slug"]

    # 3. Retrieve by ID
    get_res = await client.get(f"/api/v1/listening-sessions/{ls['id']}", headers=h)
    assert get_res.status_code == 200
    assert get_res.json()["title"] == "Evening Meditation"

    # 4. Retrieve by short slug
    get_slug_res = await client.get(f"/api/v1/listening-sessions/{ls['short_slug']}", headers=h)
    assert get_slug_res.status_code == 200
    assert get_slug_res.json()["id"] == ls["id"]


async def test_listening_session_security_constraints(client):
    owner_h = _hdr()
    other_h = _hdr()

    # 1. Create a private piece owned by Owner
    piece_res = await client.post(
        "/api/v1/pieces",
        headers=owner_h,
        json={
            "defaults_state": {"m": "open", "e": "sine"},
            "schema_ver": 8,
            "title": "Private Piece",
            "visibility": "unlisted",
            "segments": [{"type": "fixed", "duration_ms": 1000, "config": {}}],
        },
    )
    assert piece_res.status_code == 201
    owner_piece = piece_res.json()

    # 2. Other user tries to create a Listening Session wrapping Owner's private piece -> Should fail (403)
    ls_res1 = await client.post(
        "/api/v1/listening-sessions",
        headers=other_h,
        json={
            "piece_id": owner_piece["id"],
            "schema_ver": 16,
            "title": "Attempt",
        },
    )
    assert ls_res1.status_code == 403

    # 3. Owner makes the Piece public
    patch_res = await client.patch(
        f"/api/v1/pieces/{owner_piece['id']}",
        headers=owner_h,
        json={"visibility": "public"},
    )
    assert patch_res.status_code == 200

    # 4. Other user wraps Owner's public piece -> Should succeed!
    ls_res2 = await client.post(
        "/api/v1/listening-sessions",
        headers=other_h,
        json={
            "piece_id": owner_piece["id"],
            "schema_ver": 16,
            "title": "Successful Wrap",
        },
    )
    assert ls_res2.status_code == 201
    wrapped_ls = ls_res2.json()
    assert wrapped_ls["title"] == "Successful Wrap"
    assert wrapped_ls["piece"]["title"] == "Private Piece"


async def test_update_and_delete_listening_session(client):
    h = _hdr()
    
    # Create Piece
    piece_res = await client.post(
        "/api/v1/pieces",
        headers=h,
        json={
            "defaults_state": {"m": "open"},
            "schema_ver": 8,
            "segments": [{"type": "fixed", "duration_ms": 1000, "config": {}}],
        },
    )
    piece = piece_res.json()

    # Create Listening Session
    ls_res = await client.post(
        "/api/v1/listening-sessions",
        headers=h,
        json={
            "piece_id": piece["id"],
            "schema_ver": 19,
            "title": "Calm Sitting",
            "bell_schedule": [],
        },
    )
    ls = ls_res.json()
    assert ls["total_duration_ms"] == 1000 # No bells

    # Update metadata and bells
    patch_res = await client.patch(
        f"/api/v1/listening-sessions/{ls['id']}",
        headers=h,
        json={
            "title": "Deep Settle",
            "bell_schedule": [{"bellId": "zen_bell_rin", "trigger": "at-start", "volume": 0.7}],
        },
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["title"] == "Deep Settle"
    assert len(updated["bell_schedule"]) == 1
    assert updated["bell_schedule"][0]["trigger"] == "at-start"
    # Layered concurrently, total duration is exactly the piece's duration
    assert updated["total_duration_ms"] == 1000

    # Delete
    del_res = await client.delete(f"/api/v1/listening-sessions/{ls['id']}", headers=h)
    assert del_res.status_code == 204

    # Verify deleted
    get_res = await client.get(f"/api/v1/listening-sessions/{ls['id']}", headers=h)
    assert get_res.status_code == 404


async def test_source_piece_deleted_set_null(client):
    h = _hdr()
    
    # 1. Create Piece
    piece_res = await client.post(
        "/api/v1/pieces",
        headers=h,
        json={
            "defaults_state": {"m": "open"},
            "schema_ver": 8,
            "segments": [{"type": "fixed", "duration_ms": 5000, "config": {}}],
        },
    )
    piece = piece_res.json()

    # 2. Create Listening Session wrapping it
    ls_res = await client.post(
        "/api/v1/listening-sessions",
        headers=h,
        json={
            "piece_id": piece["id"],
            "schema_ver": 16,
            "title": "Graceful Fallback Test",
        },
    )
    ls = ls_res.json()
    assert ls["piece_id"] == piece["id"]
    assert ls["piece"] is not None

    # 3. Delete the underlying Piece
    del_piece = await client.delete(f"/api/v1/pieces/{piece['id']}", headers=h)
    assert del_piece.status_code == 204

    # 4. Fetch the Listening Session again -> Should NOT be deleted. `piece_id` should be Null (None), piece relation None.
    get_ls = await client.get(f"/api/v1/listening-sessions/{ls['id']}", headers=h)
    assert get_ls.status_code == 200
    updated_ls = get_ls.json()
    assert updated_ls["piece_id"] is None
    assert updated_ls["piece"] is None
    assert updated_ls["piece_creator_name"] is None


async def test_listening_history(client):
    h = _hdr()
    
    # 1. Create a Piece and a Listening Session wrapping it
    piece_res = await client.post(
        "/api/v1/pieces",
        headers=h,
        json={
            "defaults_state": {"m": "open"},
            "schema_ver": 8,
            "segments": [{"type": "fixed", "duration_ms": 1000, "config": {}}],
        },
    )
    piece = piece_res.json()
    
    ls_res = await client.post(
        "/api/v1/listening-sessions",
        headers=h,
        json={
            "piece_id": piece["id"],
            "schema_ver": 19,
            "title": "A Meditation",
        },
    )
    ls = ls_res.json()

    # 2. Log a played session config
    log_res = await client.post(
        "/api/v1/listening-sessions/me/sessions/log",
        headers=h,
        json={
            "listening_session_id": ls["id"],
            "started_at": "2026-05-30T10:00:00Z",
            "completed_at": "2026-05-30T10:10:00Z",
            "duration_seconds": 600.0,
            "is_standalone_timer": False,
        },
    )
    assert log_res.status_code == 201
    log_out = log_res.json()
    assert log_out["listening_session_id"] == ls["id"]
    assert log_out["duration_seconds"] == 600.0
    assert not log_out["is_standalone_timer"]

    # 3. Log a standalone timer session
    log_res_timer = await client.post(
        "/api/v1/listening-sessions/me/sessions/log",
        headers=h,
        json={
            "listening_session_id": None,
            "started_at": "2026-05-30T11:00:00Z",
            "completed_at": "2026-05-30T11:15:00Z",
            "duration_seconds": 900.0,
            "is_standalone_timer": True,
        },
    )
    assert log_res_timer.status_code == 201
    log_timer_out = log_res_timer.json()
    assert log_timer_out["listening_session_id"] is None
    assert log_timer_out["duration_seconds"] == 900.0
    assert log_timer_out["is_standalone_timer"]

    # 4. Export CSV and check format/contents
    export_res = await client.get(
        "/api/v1/listening-sessions/me/sessions/export",
        headers=h,
    )
    assert export_res.status_code == 200
    assert export_res.headers["content-type"].startswith("text/csv")
    csv_text = export_res.text
    
    # Assert headers
    assert "ID,Session ID,Session Title,Started At,Completed At,Duration (Seconds),Type" in csv_text
    
    # Assert values are included
    assert "A Meditation" in csv_text
    assert "Standalone Bell Timer" in csv_text
    assert "600.000" in csv_text
    assert "900.000" in csv_text

