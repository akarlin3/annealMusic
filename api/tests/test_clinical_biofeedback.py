from __future__ import annotations

import uuid
from datetime import datetime, timezone
import pytest

from app.models import ClinicalProtocol, ClinicalSessionRecord, BiosignalStream
from tests.test_clinical import _mk_account, _login, _logout

@pytest.mark.asyncio
async def test_biofeedback_devices_list(client):
    r = await client.get("/api/v1/biofeedback/devices")
    assert r.status_code == 200
    devices = r.json()
    assert len(devices) == 5
    assert devices[0]["id"] == "polar-h10"
    assert devices[2]["id"] == "openbci-cyton"
    assert "hrv" in devices[0]["capabilities"]
    assert "eeg" in devices[2]["capabilities"]

@pytest.mark.asyncio
async def test_biosignal_stream_upload_and_delete(client):
    pi_acc, pi_sess, _ = await _mk_account("pi@example.com")
    _login(client, pi_sess)
    
    # 1. Setup Study & Protocol
    study_r = await client.post("/api/v1/studies", json={"title": "Biofeedback Study"})
    assert study_r.status_code == 201
    study_id = study_r.json()["id"]

    proto_r = await client.post(
        "/api/v1/clinical-protocols",
        json={
            "study_id": study_id,
            "conditions": [{"id": "cond-1", "val": 100}],
            "randomization_scheme": "simple",
            "biosignal_channels": [{"channel_name": "hrv", "required": True}],
        },
    )
    assert proto_r.status_code == 201, proto_r.text
    proto_id = proto_r.json()["id"]

    # 2. Subject Enrolls
    _logout(client)
    enroll_r = await client.post(
        f"/api/v1/clinical-protocols/{proto_id}/enroll",
        json={"subject_id": "subject-bio-1"},
    )
    assert enroll_r.status_code == 201
    session_id = enroll_r.json()["session_id"]
    assert "hrv" in [c["channel_name"] for c in enroll_r.json()["biosignal_channels"]]

    # 3. Finalize Session telemetry
    finalize_r = await client.post(
        "/api/v1/clinical-protocols/sessions",
        json={
            "id": session_id,
            "subject_id": "subject-bio-1",
            "condition_id": "cond-1",
            "started_at": datetime.now(tz=timezone.utc).isoformat(),
            "completed_at": datetime.now(tz=timezone.utc).isoformat(),
            "stimulus_sha256": "sha-abc-123",
            "adverse_events": [],
            "withdrew": False,
        },
    )
    assert finalize_r.status_code == 201

    # 4. Upload Biosignal Stream
    frames = [
        {"timestamp": 1000, "channels": {"hrv": {"value": 800, "unit": "rr_ms"}}},
        {"timestamp": 2000, "channels": {"hrv": {"value": 810, "unit": "rr_ms"}}},
    ]
    
    stream_payload = {
        "device_id": "polar-h10",
        "channel_name": "hrv",
        "consented_at": datetime.now(tz=timezone.utc).isoformat(),
        "sample_rate_hz": 1.0,
        "frames": frames
    }

    _login(client, pi_sess) # Admin key authorized
    upload_r = await client.post(
        f"/api/v1/clinical-session-records/{session_id}/biosignal-stream",
        json=stream_payload,
    )
    assert upload_r.status_code == 201, upload_r.text
    stream_out = upload_r.json()
    assert stream_out["device_id"] == "polar-h10"
    assert stream_out["channel_name"] == "hrv"
    assert stream_out["sample_rate_hz"] == 1.0
    stream_id = stream_out["id"]

    # 5. Verify database storage key exists
    from app.db import get_sessionmaker
    sm = get_sessionmaker()
    async with sm() as s:
        db_stream = await s.get(BiosignalStream, uuid.UUID(stream_id))
        assert db_stream is not None
        assert db_stream.channel_name == "hrv"

    # 6. Delete Biosignal Stream (Shred GDPR flow)
    delete_r = await client.delete(f"/api/v1/biosignal-streams/{stream_id}")
    assert delete_r.status_code == 204

    # Verify db entry is deleted
    async with sm() as s:
        db_stream_deleted = await s.get(BiosignalStream, uuid.UUID(stream_id))
        assert db_stream_deleted is None
