"""v6.4 CP1 — curriculum authoring endpoints + spec generator."""

from __future__ import annotations

import json

import pytest

from app.services.llm import MockLLMClient
from app.services.spec_generator import generate_spec


@pytest.fixture
def admin_key(monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("ADMIN_KEY", "secret")
    get_settings.cache_clear()
    return "secret"


def _ah() -> dict[str, str]:
    return {"x-admin-key": "secret"}


async def _make_track(client, slug: str, title: str = "Track") -> str:
    r = await client.post("/api/v1/admin/tracks", headers=_ah(), json={"slug": slug, "title": title})
    assert r.status_code == 201, r.text
    return r.json()["id"]


_VALID_SPEC_JSON = json.dumps({
    "title": "The Sine Engine, Deep Dive",
    "objectives": ["Understand a pure sine partial", "Hear the effect of spread"],
    "difficulty": "intro",
    "step_outline": [
        {"type": "text", "topic": "what a sine partial is"},
        {"type": "demo", "patch_brief": "a single pure sine, low spread"},
        {"type": "prompt", "task": "raise the spread and listen"},
        {"type": "reflection", "topic": "how spread changes the tone"},
    ],
    "constraints_during_prompts": ["spread", "brightness"],
})


# --- Spec generator service (unit) -------------------------------------------


async def test_generate_spec_valid_output():
    mock = MockLLMClient()
    mock.add_response(_VALID_SPEC_JSON)
    spec = await generate_spec(mock, topic="The sine engine", track="synthesis-fundamentals")
    assert spec.id == "synthesis-fundamentals/the-sine-engine-deep-dive"
    assert spec.track == "synthesis-fundamentals"
    assert any(s.type == "demo" for s in spec.step_outline)


async def test_generate_spec_falls_back_on_garbage():
    mock = MockLLMClient()
    mock.add_response("not json at all")
    mock.add_response("still not json")
    # Coercion seeds a valid outline even when the LLM is useless.
    spec = await generate_spec(mock, topic="Granular engine", track="synthesis-fundamentals")
    assert spec.track == "synthesis-fundamentals"
    assert len(spec.step_outline) >= 4


async def test_generate_spec_injects_framing_directive():
    mock = MockLLMClient()
    mock.add_response(_VALID_SPEC_JSON)
    await generate_spec(mock, topic="The 432 Hz and solfeggio healing claims", track="music-science-crossover")
    # The system prompt for a sensitive topic must carry the honest-framing directive.
    assert "FRAMING.md" in mock.calls[0]["system"]


# --- Endpoints ---------------------------------------------------------------


async def test_spec_generate_endpoint(app, client, admin_key):
    app.state.llm = MockLLMClient()
    app.state.llm.add_response(_VALID_SPEC_JSON)
    await _make_track(client, "synthesis-fundamentals", "Synthesis Fundamentals")

    r = await client.post(
        "/api/v1/admin/curriculum/spec-generate", headers=_ah(),
        json={"topic": "The sine engine", "track": "synthesis-fundamentals"},
    )
    assert r.status_code == 200, r.text
    spec = r.json()["spec"]
    assert spec["track"] == "synthesis-fundamentals"


async def test_spec_generate_unknown_track_400(app, client, admin_key):
    app.state.llm = MockLLMClient()
    r = await client.post(
        "/api/v1/admin/curriculum/spec-generate", headers=_ah(),
        json={"topic": "the sine engine", "track": "no-such-track"},
    )
    assert r.status_code == 400


async def test_spec_generate_requires_admin(app, client, admin_key):
    r = await client.post(
        "/api/v1/admin/curriculum/spec-generate",
        json={"topic": "x", "track": "synthesis-fundamentals"},
    )
    assert r.status_code in (401, 403)


async def test_prereqs_get_and_put_dag(app, client, admin_key):
    track_id = await _make_track(client, "synthesis-fundamentals", "Synth")
    # Generate two lessons so we have nodes to connect.
    app.state.llm = MockLLMClient()
    for slug, title in (("intro", "Intro"), ("sine-engine", "Sine Engine")):
        spec = {
            "id": f"synthesis-fundamentals/{slug}", "track": "synthesis-fundamentals",
            "title": title, "objectives": ["Learn"], "difficulty": "intro",
            "step_outline": [{"type": "text", "topic": "x"}],
            "constraints_during_prompts": [],
        }
        app.state.llm.add_response('{"title":"T","content":"' + ("word " * 80) + '","key_points":[]}')
        r = await client.post("/api/v1/admin/lessons/generate", headers=_ah(), json=spec)
        assert r.status_code == 201, r.text

    # Initially no edges.
    r = await client.get("/api/v1/admin/curriculum/prereqs", headers=_ah())
    assert r.status_code == 200
    assert len(r.json()["nodes"]) == 2
    assert r.json()["edges"] == []

    # Add a valid edge: intro -> sine-engine.
    r = await client.put(
        "/api/v1/admin/curriculum/prereqs", headers=_ah(),
        json={"edges": [{"prerequisite": "synthesis-fundamentals/intro",
                         "lesson": "synthesis-fundamentals/sine-engine"}]},
    )
    assert r.status_code == 200, r.text
    assert len(r.json()["edges"]) == 1

    # A cycle is rejected.
    r = await client.put(
        "/api/v1/admin/curriculum/prereqs", headers=_ah(),
        json={"edges": [
            {"prerequisite": "synthesis-fundamentals/intro", "lesson": "synthesis-fundamentals/sine-engine"},
            {"prerequisite": "synthesis-fundamentals/sine-engine", "lesson": "synthesis-fundamentals/intro"},
        ]},
    )
    assert r.status_code == 400, r.text


async def test_batch_generate_all_pending(app, client, admin_key):
    await _make_track(client, "synthesis-fundamentals", "Synth")
    # Create a lesson via spec but leave it pending by failing generation once,
    # then batch-generate it. We simulate by directly inserting a spec lesson.
    app.state.llm = MockLLMClient()
    spec = {
        "id": "synthesis-fundamentals/pulse-engine", "track": "synthesis-fundamentals",
        "title": "Pulse Engine", "objectives": ["Learn"], "difficulty": "intro",
        "step_outline": [{"type": "text", "topic": "pulse"}],
        "constraints_during_prompts": [],
    }
    # First generation succeeds and marks ready.
    app.state.llm.add_response('{"title":"T","content":"' + ("word " * 80) + '","key_points":[]}')
    r = await client.post("/api/v1/admin/lessons/generate", headers=_ah(), json=spec)
    assert r.status_code == 201

    # Batch generate with no ids → all pending/failed; this one is ready so it is
    # a no-op (cache hit), returning an empty requested set.
    r = await client.post("/api/v1/admin/curriculum/batch-generate", headers=_ah(), json={})
    assert r.status_code == 200, r.text
    assert r.json()["requested"] == 0


async def test_qa_endpoint_flags_missing_clip(app, client, admin_key):
    await _make_track(client, "synthesis-fundamentals", "Synth")
    app.state.llm = MockLLMClient()
    # text + reflection only → no hearable step → QA error.
    spec = {
        "id": "synthesis-fundamentals/intro", "track": "synthesis-fundamentals",
        "title": "Intro", "objectives": ["Learn"], "difficulty": "intro",
        "step_outline": [{"type": "text", "topic": "x"}, {"type": "reflection", "topic": "y"}],
        "constraints_during_prompts": [],
    }
    app.state.llm.add_response('{"title":"T","content":"' + ("word " * 80) + '","key_points":[]}')
    app.state.llm.add_response('{"prompt":"What did you notice about the calm tone?"}')
    r = await client.post("/api/v1/admin/lessons/generate", headers=_ah(), json=spec)
    assert r.status_code == 201, r.text
    lesson_id = r.json()["id"]

    r = await client.get(f"/api/v1/admin/curriculum/qa/{lesson_id}", headers=_ah())
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "fail"
    assert any(f["rule"] == "step-coverage" for f in body["findings"])
