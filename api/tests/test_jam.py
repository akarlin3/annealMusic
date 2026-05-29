from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models import JamSession, JamParticipant, Patch, PatchCollaborator, User, Account
from app.config import get_settings


@pytest.mark.asyncio
async def test_create_session(client, app) -> None:
    # 1. Create a session
    resp = await client.post("/api/v1/jam-sessions", headers={"x-anon-id": str(uuid.uuid4())})
    assert resp.status_code == 201
    data = resp.json()
    
    assert "session" in data
    assert "participants" in data
    assert "ws_url" in data
    
    session_data = data["session"]
    assert "id" in session_data
    assert session_data["ended_at"] is None
    
    participants_data = data["participants"]
    assert len(participants_data) == 1
    assert participants_data[0]["color"] == "#3B82F6"  # First color assigned to host


@pytest.mark.asyncio
async def test_join_and_leave_session(client, app) -> None:
    anon_host = str(uuid.uuid4())
    anon_guest = str(uuid.uuid4())
    anon_stranger = str(uuid.uuid4())
    
    # 1. Host creates a session
    resp = await client.post("/api/v1/jam-sessions", headers={"x-anon-id": anon_host})
    assert resp.status_code == 201
    session_id = resp.json()["session"]["id"]
    
    # 2. Guest joins the session
    resp = await client.post(f"/api/v1/jam-sessions/{session_id}/join", headers={"x-anon-id": anon_guest})
    assert resp.status_code == 200
    data = resp.json()
    assert "color" in data
    assert data["color"] == "#EF4444"  # Second color assigned
    assert "ws_url" in data

    # 3. Third user tries to join but it's full (2 player limit)
    resp = await client.post(f"/api/v1/jam-sessions/{session_id}/join", headers={"x-anon-id": anon_stranger})
    assert resp.status_code == 403
    assert "limit" in resp.json()["message"]

    # 4. Guest leaves
    resp = await client.post(f"/api/v1/jam-sessions/{session_id}/leave", headers={"x-anon-id": anon_guest})
    assert resp.status_code == 204

    # 5. Fetch details and verify guest is marked as left
    resp = await client.get(f"/api/v1/jam-sessions/{session_id}", headers={"x-anon-id": anon_host})
    assert resp.status_code == 200
    details = resp.json()
    assert len(details["participants"]) == 2
    guest_part = next(p for p in details["participants"] if p["user_id"] == anon_guest)
    assert guest_part["left_at"] is not None


@pytest.mark.asyncio
async def test_save_shared_patch(client, app) -> None:
    anon_host = str(uuid.uuid4())
    anon_guest = str(uuid.uuid4())

    from app.db import get_sessionmaker
    from app.models import Session as DbSession
    host_session_id = uuid.uuid4()
    guest_session_id = uuid.uuid4()
    
    session_maker = get_sessionmaker()
    async with session_maker() as session:
        # Create users
        host_user = User(id=uuid.UUID(anon_host))
        guest_user = User(id=uuid.UUID(anon_guest))
        session.add_all([host_user, guest_user])
        await session.flush()
        
        # Link accounts
        host_acc = Account(id=uuid.uuid4(), email="host@example.com", display_name="Host Avery")
        guest_acc = Account(id=uuid.uuid4(), email="guest@example.com", display_name="Guest Alex")
        session.add_all([host_acc, guest_acc])
        await session.flush()
        
        host_user.account_id = host_acc.id
        guest_user.account_id = guest_acc.id
        
        # Create DbSession
        session.add(DbSession(id=host_session_id, account_id=host_acc.id, expires_at=datetime.now(tz=timezone.utc) + timedelta(days=1)))
        session.add(DbSession(id=guest_session_id, account_id=guest_acc.id, expires_at=datetime.now(tz=timezone.utc) + timedelta(days=1)))
        await session.commit()

    # 1. Create session
    client.cookies.set("am_session", str(host_session_id))
    resp = await client.post("/api/v1/jam-sessions", headers={"x-anon-id": anon_host})
    assert resp.status_code == 201
    session_id = resp.json()["session"]["id"]

    # 2. Guest joins
    client.cookies.set("am_session", str(guest_session_id))
    resp = await client.post(f"/api/v1/jam-sessions/{session_id}/join", headers={"x-anon-id": anon_guest})
    assert resp.status_code == 200

    # 3. Host saves shared patch
    client.cookies.set("am_session", str(host_session_id))
    patch_payload = {
        "state": "m=open&e=sine&rootFreq=220",
        "schema_ver": 7,
        "title": "Shared Ambient Jam",
        "description": "Collaborative track description",
        "visibility": "unlisted"
    }
    resp = await client.post(f"/api/v1/jam-sessions/{session_id}/save-patch", json=patch_payload, headers={"x-anon-id": anon_host})
    assert resp.status_code == 201
    patch_data = resp.json()
    assert patch_data["title"] == "Shared Ambient Jam"
    patch_id = patch_data["id"]

    # 4. Verify patch collaborators were inserted
    async with session_maker() as session:
        collabs = (await session.execute(
            select(PatchCollaborator).where(PatchCollaborator.patch_id == uuid.UUID(patch_id))
        )).scalars().all()
        assert len(collabs) == 2
        collaborator_user_ids = {str(c.user_id) for c in collabs}
        assert anon_host in collaborator_user_ids
        assert anon_guest in collaborator_user_ids


def test_websocket_signaling(app) -> None:
    # Use standard FastAPI TestClient for WebSocket testing
    client = TestClient(app)
    
    # 1. Create a session via POST
    resp = client.post("/api/v1/jam-sessions", headers={"x-anon-id": str(uuid.uuid4())})
    assert resp.status_code == 201
    session_id = resp.json()["session"]["id"]
    
    # 2. Open two WebSocket signaling connections
    ws_url = f"/api/v1/jam-sessions/{session_id}/signal"
    with client.websocket_connect(ws_url) as ws1:
        with client.websocket_connect(ws_url) as ws2:
            # 3. ws1 sends SDP offer text
            offer = {"type": "offer", "sdp": "v=0..."}
            ws1.send_json(offer)
            
            # 4. ws2 should receive it
            recv_offer = ws2.receive_json()
            assert recv_offer["type"] == "offer"
            assert recv_offer["sdp"] == "v=0..."

            # 5. Test binary CRDT updates
            crdt_bytes = b"\x01\x02\x03\x04"
            ws2.send_bytes(crdt_bytes)
            
            recv_bytes = ws1.receive_bytes()
            assert recv_bytes == crdt_bytes


@pytest.mark.asyncio
async def test_rate_limits(client, app) -> None:
    anon_id = str(uuid.uuid4())
    
    # Enable rate limiting just for this test (it's disabled by default in conftest environment)
    get_settings().rate_limit_enabled = True
    
    # 1. Host creates a session 5 times
    for _ in range(5):
        resp = await client.post("/api/v1/jam-sessions", headers={"x-anon-id": anon_id})
        assert resp.status_code == 201

    # 2. Sixth session create should be blocked (rate limited)
    resp = await client.post("/api/v1/jam-sessions", headers={"x-anon-id": anon_id})
    assert resp.status_code == 429
    assert resp.json()["error"] == "rate_limited"
    
    get_settings().rate_limit_enabled = False
