from __future__ import annotations

import io
import json
import math
import struct
import wave

import pytest


@pytest.fixture
def admin_key(monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("ADMIN_KEY", "secret")
    get_settings.cache_clear()
    return "secret"


def tone_wav(seconds: float = 1.0, sample_rate: int = 48000, freq: float = 220.0) -> bytes:
    """A short mono 16-bit PCM sine — a valid, non-silent WAV for upload tests."""
    frames = int(seconds * sample_rate)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        samples = bytearray()
        for n in range(frames):
            v = int(0.5 * 32767 * math.sin(2 * math.pi * freq * n / sample_rate))
            samples += struct.pack("<h", v)
        w.writeframes(bytes(samples))
    return buf.getvalue()


def _meta(**over) -> str:
    base = {
        "slug": "karplus-archetype",
        "title": "Textbook Karplus Pluck",
        "description": "A textbook Karplus pluck — bright, percussive, with a clean decay.",
        "track_affinity": ["synthesis-fundamentals"],
        "concept_tags": ["karplus-strong", "string", "physical-modeling", "pluck"],
        "license": "original-by-you",
        "attribution": None,
    }
    base.update(over)
    return json.dumps(base)


async def _upload(client, admin_key, meta_json: str, *, wav: bytes | None = None):
    return await client.post(
        "/api/v1/admin/clips",
        headers={"x-admin-key": admin_key},
        data={"meta": meta_json},
        files={"file": ("clip.wav", wav or tone_wav(0.5), "audio/wav")},
    )


async def test_upload_and_fetch_clip(client, admin_key):
    r = await _upload(client, admin_key, _meta())
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["slug"] == "karplus-archetype"
    assert body["license"] == "original-by-you"
    assert body["duration_ms"] > 0  # derived from the WAV header
    assert body["audio_url"] == "/api/v1/clips/karplus-archetype/audio"

    # Public metadata endpoint.
    meta = await client.get("/api/v1/clips/karplus-archetype")
    assert meta.status_code == 200
    assert meta.json()["title"] == "Textbook Karplus Pluck"

    # Public audio streams the stored bytes.
    audio = await client.get("/api/v1/clips/karplus-archetype/audio")
    assert audio.status_code == 200
    assert len(audio.content) > 0


async def test_duplicate_slug_rejected(client, admin_key):
    assert (await _upload(client, admin_key, _meta())).status_code == 201
    dup = await _upload(client, admin_key, _meta())
    assert dup.status_code == 400


async def test_license_required_and_attribution_enforced(client, admin_key):
    # Missing license → invalid metadata (422 from the JSON parse / validation).
    bad = await _upload(
        client, admin_key, json.dumps({"slug": "x", "title": "x", "description": "y"})
    )
    assert bad.status_code == 400  # bad_request wraps the validation error

    # CC-BY without attribution → rejected.
    r = await _upload(
        client, admin_key, _meta(slug="cc-clip", license="CC-BY", attribution=None)
    )
    assert r.status_code == 400

    # CC-BY with attribution → allowed.
    ok = await _upload(
        client,
        admin_key,
        _meta(slug="cc-clip", license="CC-BY", attribution="CC-BY: Jane Doe"),
    )
    assert ok.status_code == 201
    assert ok.json()["attribution"] == "CC-BY: Jane Doe"


async def test_patch_and_archive(client, admin_key):
    created = (await _upload(client, admin_key, _meta())).json()
    cid = created["id"]

    patched = await client.patch(
        f"/api/v1/admin/clips/{cid}",
        headers={"x-admin-key": admin_key},
        json={"title": "Renamed", "concept_tags": ["pluck", "bright"]},
    )
    assert patched.status_code == 200
    assert patched.json()["title"] == "Renamed"
    assert patched.json()["concept_tags"] == ["pluck", "bright"]

    # Archive (soft-delete) → public fetch 404s.
    arch = await client.delete(
        f"/api/v1/admin/clips/{cid}", headers={"x-admin-key": admin_key}
    )
    assert arch.status_code == 200
    gone = await client.get("/api/v1/clips/karplus-archetype")
    assert gone.status_code == 404


async def test_patch_cannot_break_license_invariant(client, admin_key):
    created = (await _upload(client, admin_key, _meta())).json()
    cid = created["id"]
    # Switching to CC-BY without an attribution must be rejected.
    r = await client.patch(
        f"/api/v1/admin/clips/{cid}",
        headers={"x-admin-key": admin_key},
        json={"license": "CC-BY"},
    )
    assert r.status_code == 400


async def test_admin_requires_key(client, admin_key):
    # No key header → unauthorized.
    r = await client.post(
        "/api/v1/admin/clips",
        data={"meta": _meta()},
        files={"file": ("c.wav", tone_wav(0.3), "audio/wav")},
    )
    assert r.status_code == 401


async def test_unknown_clip_404(client):
    assert (await client.get("/api/v1/clips/nope")).status_code == 404
    assert (await client.get("/api/v1/clips/nope/audio")).status_code == 404
