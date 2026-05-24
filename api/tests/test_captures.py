from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from tests.conftest import VALID_PAYLOAD, make_wav


def _hdr() -> dict[str, str]:
    return {"x-anon-id": str(uuid.uuid4())}


async def _upload(client, h) -> dict:
    r = await client.post(
        "/api/v1/captures",
        headers=h,
        files={"file": ("loop.wav", make_wav(1.0), "audio/wav")},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def test_upload_capture(client):
    h = _hdr()
    cap = await _upload(client, h)
    assert cap["format"] == "wav"  # transcode disabled in tests
    assert cap["channels"] == 2
    assert cap["sample_rate"] == 48000
    assert 900 <= cap["duration_ms"] <= 1100
    assert cap["bytes"] > 0

    me = (await client.get("/api/v1/users/me", headers=h)).json()["user"]
    assert me["capture_count"] == 1
    assert me["bytes_used"] == cap["bytes"]


async def test_get_capture_redirects(client):
    h = _hdr()
    cap = await _upload(client, h)
    r = await client.get(f"/api/v1/captures/{cap['id']}", follow_redirects=False)
    assert r.status_code == 302
    assert r.headers["location"].startswith("memory://captures/")


async def test_reject_non_wav(client):
    h = _hdr()
    r = await client.post(
        "/api/v1/captures",
        headers=h,
        files={"file": ("x.wav", b"not a wav", "audio/wav")},
    )
    assert r.status_code == 400


async def test_save_patch_with_capture_refcount(client, app):
    from app.db import get_sessionmaker
    from app.models import Capture

    h = _hdr()
    cap = await _upload(client, h)
    cap_id = uuid.UUID(cap["id"])

    created = await client.post(
        "/api/v1/patches",
        headers=h,
        json={
            "state": VALID_PAYLOAD,
            "schema_ver": 4,
            "capture_refs": [cap["id"]],
        },
    )
    assert created.status_code == 201
    assert created.json()["capture_refs"] == [cap["id"]]

    sm = get_sessionmaker()
    async with sm() as s:
        row = await s.get(Capture, cap_id)
        assert row is not None and row.ref_count == 1

    # Deleting the patch dereferences the capture.
    await client.delete(
        f"/api/v1/patches/{created.json()['id']}", headers=h
    )
    async with sm() as s:
        row = await s.get(Capture, cap_id)
        assert row is not None and row.ref_count == 0


async def test_cannot_reference_others_capture(client):
    owner = _hdr()
    cap = await _upload(client, owner)
    stranger = _hdr()
    r = await client.post(
        "/api/v1/patches",
        headers=stranger,
        json={"state": VALID_PAYLOAD, "schema_ver": 4, "capture_refs": [cap["id"]]},
    )
    assert r.status_code == 404


async def test_orphan_sweep(client, app):
    from app.db import get_sessionmaker
    from app.models import Capture
    from app.routers.captures import sweep_orphans

    h = _hdr()
    cap = await _upload(client, h)
    cap_id = uuid.UUID(cap["id"])

    sm = get_sessionmaker()
    # Age the capture past the grace window; ref_count is already 0.
    async with sm() as s:
        row = await s.get(Capture, cap_id)
        row.created_at = datetime.now(tz=timezone.utc) - timedelta(hours=48)
        await s.commit()

    async with sm() as s:
        deleted = await sweep_orphans(s, app.state.storage)
    assert deleted == 1

    async with sm() as s:
        assert await s.get(Capture, cap_id) is None
