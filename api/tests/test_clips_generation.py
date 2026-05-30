"""v6.2 CP2 — audio-clip step generation via shared retrieval + LLM picker."""

from __future__ import annotations

import json
import re

import pytest

from app.services.embeddings import EmbeddingClient
from app.services.llm import MockLLMClient


class HashEmbeddingClient(EmbeddingClient):
    async def embed(self, text: str) -> list[float]:
        vec = [0.0] * 1536
        for tok in re.findall(r"[a-z0-9]+", text.lower()):
            vec[hash(tok) % 1536] += 1.0
        return vec


@pytest.fixture
def admin_key(monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("ADMIN_KEY", "secret")
    get_settings.cache_clear()
    return "secret"


def _ah():
    return {"x-admin-key": "secret"}


async def _seed(app):
    from app.db import get_sessionmaker
    from app.services.clip_seed import seed_clips_from_manifest

    sm = get_sessionmaker()
    async with sm() as session:
        await seed_clips_from_manifest(session, HashEmbeddingClient())


async def _make_track(client, slug: str) -> str:
    r = await client.post("/api/v1/admin/tracks", headers=_ah(), json={"slug": slug, "title": "T"})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _spec(track: str, steps: list[dict]) -> dict:
    return {
        "id": f"{track}/clips-lesson",
        "track": track,
        "title": "Hearing the String Engine",
        "objectives": ["Recognise a physical-model pluck"],
        "difficulty": "intro",
        "step_outline": steps,
    }


async def test_audio_clip_step_generates(app, client, admin_key):
    await _seed(app)
    await _make_track(client, "synthesis-fundamentals")
    app.state.embeddings = HashEmbeddingClient()

    mock = MockLLMClient()
    app.state.llm = mock
    # The picker chooses karplus from the retrieved candidates and frames it.
    mock.add_response(json.dumps({
        "clip_id": "karplus-archetype",
        "intro_text": "Listen to a textbook Karplus pluck.",
        "outro_text": "Hear the high end soften with each repeat.",
    }))

    spec = _spec("synthesis-fundamentals", [
        {"type": "audio-clip", "clip_topic": "physical modeling string pluck karplus"},
    ])
    r = await client.post("/api/v1/admin/lessons/generate", headers=_ah(), json=spec)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["generation_status"] == "ready", data
    cfg = data["steps"][0]["config"]
    assert cfg["clip_id"] == "karplus-archetype"
    assert cfg["intro_text"]
    assert cfg["auto_advance"] is False


async def test_audio_clip_spec_requires_clip_topic(client, admin_key):
    await _make_track(client, "synthesis-fundamentals")
    spec = _spec("synthesis-fundamentals", [{"type": "audio-clip"}])
    r = await client.post("/api/v1/admin/lessons/generate", headers=_ah(), json=spec)
    assert r.status_code == 400
    assert "clip_topic" in r.text


async def test_audio_clip_picker_rejects_offlist_choice(app, client, admin_key):
    await _seed(app)
    await _make_track(client, "synthesis-fundamentals")
    app.state.embeddings = HashEmbeddingClient()

    mock = MockLLMClient()
    app.state.llm = mock
    # Picker returns a slug that wasn't among the candidates → retries, then fails.
    for _ in range(3):
        mock.add_response(json.dumps({"clip_id": "not-a-real-slug", "intro_text": "x"}))

    spec = _spec("synthesis-fundamentals", [
        {"type": "audio-clip", "clip_topic": "fm bell ratios"},
    ])
    r = await client.post("/api/v1/admin/lessons/generate", headers=_ah(), json=spec)
    assert r.status_code == 201
    assert r.json()["generation_status"] == "generation_failed"
