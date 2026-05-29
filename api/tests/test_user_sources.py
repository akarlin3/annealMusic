from __future__ import annotations

import io
import math
import struct
import wave
import uuid

import pytest
from app.errors import ApiError
from app.models import UserSource
from app.config import get_settings

def make_tone_wav(seconds: float = 1.0, freq: float = 440.0, sample_rate: int = 48000, channels: int = 1) -> bytes:
    """A valid 16-bit PCM WAV containing a clear sine wave tone."""
    frames = int(seconds * sample_rate)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        
        samples = []
        for i in range(frames):
            val = int(10000 * math.sin(2 * math.pi * freq * i / sample_rate))
            samples.append(val)
        
        # Pack to 16-bit signed shorts
        packed = struct.pack(f"<{frames * channels}h", *(samples * channels))
        w.writeframes(packed)
    return buf.getvalue()


def make_silent_wav(seconds: float = 1.0, sample_rate: int = 48000, channels: int = 1) -> bytes:
    """An invalid (silent) 16-bit PCM WAV."""
    frames = int(seconds * sample_rate)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(b"\x00\x00" * frames * channels)
    return buf.getvalue()


def _hdr() -> dict[str, str]:
    return {"x-anon-id": str(uuid.uuid4())}


async def _upload(client, h, name="tone.wav", data=None) -> dict:
    if data is None:
        data = make_tone_wav(1.0)
    r = await client.post(
        "/api/v1/user-sources",
        headers=h,
        files={"file": (name, data, "audio/wav")},
    )
    return r


async def test_upload_user_source(client):
    h = _hdr()
    r = await _upload(client, h)
    assert r.status_code == 201, r.text
    src = r.json()
    assert src["channels"] == 1
    assert src["sample_rate"] == 48000
    assert 900 <= src["duration_ms"] <= 1100
    assert src["display_name"] == "tone"
    assert src["visibility"] == "unlisted"

    me = (await client.get("/api/v1/users/me", headers=h)).json()["user"]
    assert me["source_count"] == 1
    assert me["bytes_used"] == src["bytes"]


async def test_reject_silent_source(client):
    h = _hdr()
    r = await _upload(client, h, "silence.wav", make_silent_wav(1.0))
    assert r.status_code == 422
    assert r.json()["error"] == "invalid_audio"
    assert "silent" in r.json()["message"]


async def test_reject_corrupt_source(client):
    h = _hdr()
    r = await _upload(client, h, "corrupt.wav", b"garbage bytes")
    assert r.status_code == 422
    assert r.json()["error"] == "invalid_audio"
    assert "corrupt" in r.json()["message"]


async def test_reject_oversized_duration(client):
    h = _hdr()
    r = await _upload(client, h, "long.wav", make_tone_wav(61.0))
    assert r.status_code == 422
    assert r.json()["error"] == "invalid_audio"
    assert "duration" in r.json()["message"]


async def test_quota_limits(client):
    h = _hdr()
    settings = get_settings()
    original_rate_limit = settings.rate_limit_enabled
    settings.rate_limit_enabled = False
    try:
        # Upload up to 20 sources (max quota)
        for i in range(20):
            r = await _upload(client, h, f"tone_{i}.wav")
            assert r.status_code == 201

        # Attempt 21st upload
        r = await _upload(client, h, "tone_21.wav")
        assert r.status_code == 409
        assert r.json()["error"] == "quota_exceeded"
    finally:
        settings.rate_limit_enabled = original_rate_limit


async def test_filename_moderation_screening(client):
    h = _hdr()
    r = await _upload(client, h, "viagra.wav")
    assert r.status_code == 422
    assert r.json()["error"] == "content_rejected"


async def test_get_user_source_visibility_and_ownership(client, app):
    from app.db import get_sessionmaker

    owner = _hdr()
    stranger = _hdr()

    # Upload as owner
    src = (await _upload(client, owner)).json()
    src_id = src["id"]

    # 1. Owner can load
    r = await client.get(f"/api/v1/user-sources/{src_id}", headers=owner, follow_redirects=False)
    assert r.status_code == 302
    assert r.headers["location"].startswith("memory://user_sources/")

    # 2. Stranger gets 403 Forbidden on unlisted source
    r = await client.get(f"/api/v1/user-sources/{src_id}", headers=stranger, follow_redirects=False)
    assert r.status_code == 403

    # 3. Flip visibility to shared
    sm = get_sessionmaker()
    async with sm() as s:
        db_src = await s.get(UserSource, uuid.UUID(src_id))
        db_src.visibility = "shared"
        await s.commit()

    # 4. Stranger can load shared source
    r = await client.get(f"/api/v1/user-sources/{src_id}", headers=stranger, follow_redirects=False)
    assert r.status_code == 302

    # 5. Flip visibility to flagged
    async with sm() as s:
        db_src = await s.get(UserSource, uuid.UUID(src_id))
        db_src.visibility = "flagged"
        await s.commit()

    # 6. Flagged returns 451
    r = await client.get(f"/api/v1/user-sources/{src_id}", headers=owner, follow_redirects=False)
    assert r.status_code == 451
    assert r.json()["error"] == "flagged"


async def test_patch_display_name(client):
    h = _hdr()
    src = (await _upload(client, h)).json()
    src_id = src["id"]

    # Valid rename
    r = await client.patch(
        f"/api/v1/user-sources/{src_id}",
        headers=h,
        json={"display_name": "new_tone_name"},
    )
    assert r.status_code == 200
    assert r.json()["display_name"] == "new_tone_name"

    # Screened rename
    r = await client.patch(
        f"/api/v1/user-sources/{src_id}",
        headers=h,
        json={"display_name": "viagra"},
    )
    assert r.status_code == 422
    assert r.json()["error"] == "content_rejected"


async def test_delete_user_source(client):
    h = _hdr()
    src = (await _upload(client, h)).json()
    src_id = src["id"]

    # Stranger cannot delete
    stranger = _hdr()
    r = await client.delete(f"/api/v1/user-sources/{src_id}", headers=stranger)
    assert r.status_code == 403

    # Owner can delete
    r = await client.delete(f"/api/v1/user-sources/{src_id}", headers=h)
    assert r.status_code == 204

    # Deleted doesn't exist
    r = await client.get(f"/api/v1/user-sources/{src_id}", headers=h)
    assert r.status_code == 404


async def test_render_dedicated_endpoint(client, app):
    from app.db import get_sessionmaker

    h = _hdr()
    src = (await _upload(client, h)).json()
    src_id = src["id"]

    # 1. Unlisted is forbidden on render endpoint
    r = await client.get(f"/api/v1/user-sources/render/{src_id}", follow_redirects=False)
    assert r.status_code == 403

    # 2. Shared is allowed on render endpoint anonymously
    sm = get_sessionmaker()
    async with sm() as s:
        db_src = await s.get(UserSource, uuid.UUID(src_id))
        db_src.visibility = "shared"
        await s.commit()

    r = await client.get(f"/api/v1/user-sources/render/{src_id}", follow_redirects=False)
    assert r.status_code == 302
    assert r.headers["location"].startswith("memory://user_sources/")


async def test_patch_publication_with_unlisted_sources_requires_consent(client, app):
    from app.db import get_sessionmaker

    h = _hdr()
    src = (await _upload(client, h)).json()
    src_id = src["id"]

    # 1. Try to create public patch referencing unlisted user source without consent -> 409
    state = f"e=granular&gr.source=u:{src_id}"
    r = await client.post(
        "/api/v1/patches",
        headers=h,
        json={
            "state": state,
            "schema_ver": 5,
            "title": "Consent Test",
            "visibility": "public",
            "acknowledge_source_visibility": False,
        },
    )
    assert r.status_code == 409
    assert r.json()["error"] == "requires_source_consent"

    # Verify source remains unlisted and ref_count is 0
    sm = get_sessionmaker()
    async with sm() as s:
        db_src = await s.get(UserSource, uuid.UUID(src_id))
        assert db_src.visibility == "unlisted"
        assert db_src.ref_count == 0

    # 2. Try with consent -> 201 Success
    r = await client.post(
        "/api/v1/patches",
        headers=h,
        json={
            "state": state,
            "schema_ver": 5,
            "title": "Consent Test",
            "visibility": "public",
            "acknowledge_source_visibility": True,
        },
    )
    assert r.status_code == 201
    patch = r.json()

    # Verify source transitioned to shared and ref_count is 1
    async with sm() as s:
        db_src = await s.get(UserSource, uuid.UUID(src_id))
        assert db_src.visibility == "shared"
        assert db_src.ref_count == 1


async def test_patch_update_publication_requires_consent(client, app):
    from app.db import get_sessionmaker

    h = _hdr()
    src = (await _upload(client, h)).json()
    src_id = src["id"]

    # 1. Create unlisted patch referencing unlisted user source -> 201
    state = f"e=granular&gr.source=u:{src_id}"
    r = await client.post(
        "/api/v1/patches",
        headers=h,
        json={
            "state": state,
            "schema_ver": 5,
            "title": "Consent Test Unlisted",
            "visibility": "unlisted",
            "acknowledge_source_visibility": False,
        },
    )
    assert r.status_code == 201
    patch = r.json()
    patch_id = patch["id"]

    # Verify source remains unlisted, but ref_count is 1
    sm = get_sessionmaker()
    async with sm() as s:
        db_src = await s.get(UserSource, uuid.UUID(src_id))
        assert db_src.visibility == "unlisted"
        assert db_src.ref_count == 1

    # 2. Try to update visibility to public without consent -> 409
    r = await client.patch(
        f"/api/v1/patches/{patch_id}",
        headers=h,
        json={
            "visibility": "public",
            "acknowledge_source_visibility": False,
        },
    )
    assert r.status_code == 409
    assert r.json()["error"] == "requires_source_consent"

    # 3. Update with consent -> 200 Success
    r = await client.patch(
        f"/api/v1/patches/{patch_id}",
        headers=h,
        json={
            "visibility": "public",
            "acknowledge_source_visibility": True,
        },
    )
    assert r.status_code == 200

    # Verify source transitioned to shared
    async with sm() as s:
        db_src = await s.get(UserSource, uuid.UUID(src_id))
        assert db_src.visibility == "shared"
        assert db_src.ref_count == 1

    # 4. Deleting patch decrements ref_count back to 0
    r = await client.delete(f"/api/v1/patches/{patch_id}", headers=h)
    assert r.status_code == 204
    async with sm() as s:
        db_src = await s.get(UserSource, uuid.UUID(src_id))
        assert db_src.ref_count == 0
