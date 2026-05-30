"""v6.1 CP1 — lesson generation pipeline, validators, sanitizer, cache."""

from __future__ import annotations

import json
import uuid

import pytest

from app.services.llm import MockLLMClient
from app.services import lesson_generation as lg
from app.services.svg_sanitizer import sanitize_svg


@pytest.fixture
def admin_key(monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("ADMIN_KEY", "secret")
    get_settings.cache_clear()
    return "secret"


def _ah() -> dict[str, str]:
    return {"x-admin-key": "secret"}


# Reusable mock outputs ------------------------------------------------------

_LONG_TEXT = (
    "### Physical modeling\n\n"
    + "AnnealMusic models a vibrating string as a delay line fed back through a "
    "gentle low-pass filter. " * 6
)

_VALID_PATCH = {
    "m": "open", "e": "sine", "rootFreq": 440, "spread": 1.0, "density": 4,
    "coupling": 0.5, "drift": 0.5, "brightness": 0.5, "space": 0.5,
}

_VALID_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">'
    '<rect x="10" y="10" width="80" height="40" fill="#f59e0b"/>'
    '<line x1="90" y1="30" x2="200" y2="30" stroke="#fbbf24" stroke-width="2"/>'
    '<text x="20" y="35" font-size="12" fill="#fcd34d">string</text></svg>'
)


def _spec(track: str, steps: list[dict], **kw) -> dict:
    return {
        "id": f"{track}/karplus",
        "track": track,
        "title": "How the String Engine Works",
        "objectives": ["Understand Karplus-Strong", "Hear damping"],
        "difficulty": "intro",
        "step_outline": steps,
        "constraints_during_prompts": ["damping", "brightness"],
        **kw,
    }


async def _make_track(client, admin_key, slug: str = "synth") -> str:
    r = await client.post(
        "/api/v1/admin/tracks", headers=_ah(),
        json={"slug": slug, "title": "Synth"},
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


# --- Unit: SVG sanitizer -----------------------------------------------------

def test_svg_sanitizer_accepts_clean():
    ok, errs, out = sanitize_svg(_VALID_SVG)
    assert ok, errs
    assert "<svg" in out


@pytest.mark.parametrize("bad", [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect onclick="x()"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="http://x/y.png"/></svg>',
    '<!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9000 9000"><rect/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><a href="http://x"/></svg>',
])
def test_svg_sanitizer_rejects(bad):
    ok, errs, _ = sanitize_svg(bad)
    assert not ok
    assert errs


# --- Unit: mermaid validator -------------------------------------------------

def test_mermaid_accepts_flowchart():
    ok, errs, _ = lg.validate_mermaid("flowchart TD\n A --> B")
    assert ok, errs


@pytest.mark.parametrize("bad", [
    "pie title x\n a: 1",                 # disallowed type
    "flowchart TD\n A --> B<script>x",    # injection
    "",                                    # empty
])
def test_mermaid_rejects(bad):
    ok, _, _ = lg.validate_mermaid(bad)
    assert not ok


# --- Unit: text / prompt / reflection / demo validators ----------------------

def test_validate_text_rules():
    assert lg.validate_text(_LONG_TEXT)[0]
    assert not lg.validate_text("too short")[0]
    assert not lg.validate_text("# h1 not allowed\n\n" + _LONG_TEXT)[0]


def test_validate_prompt_and_reflection():
    ok, _, v = lg.validate_prompt(json.dumps({"prompt": "Turn drift up.", "hint": "0.8"}))
    assert ok and v["hint"] == "0.8"
    assert not lg.validate_prompt(json.dumps({"prompt": ""}))[0]
    assert lg.validate_reflection(json.dumps({"prompt": "What changed?"}))[0]
    assert not lg.validate_reflection(json.dumps({"prompt": "Not a question"}))[0]


def test_validate_demo_against_schema():
    ok, errs, v = lg.validate_demo(json.dumps(_VALID_PATCH))
    assert ok, errs
    assert "e=sine" in v["payload"]
    assert v["patch"]["rootFreq"] in ("440", "440.0")
    assert not lg.validate_demo("not json")[0]


# --- Unit: cache key ---------------------------------------------------------

def test_cache_key_is_deterministic_and_discriminating():
    base = dict(prompt_version="v1", schema_version=7, spec_id="t/l",
                step_index=0, step_type="text", model_id="m")
    assert lg.lesson_cache_key(**base) == lg.lesson_cache_key(**base)
    assert lg.lesson_cache_key(**base) != lg.lesson_cache_key(**{**base, "step_index": 1})
    assert lg.lesson_cache_key(**base) != lg.lesson_cache_key(**{**base, "diagram": "svg"})


# --- E2E: generation endpoint ------------------------------------------------

async def test_generate_full_lesson(app, client, admin_key):
    await _make_track(client, admin_key)
    mock = MockLLMClient()
    app.state.llm = mock
    mock.add_response(_LONG_TEXT)
    mock.add_response(json.dumps(_VALID_PATCH))
    mock.add_response(json.dumps({"prompt": "Raise drift slowly.", "hint": "0.8"}))
    mock.add_response(json.dumps({"prompt": "What shifted in the texture?"}))

    spec = _spec("synth", [
        {"type": "text", "topic": "What physical modeling is"},
        {"type": "demo", "patch_brief": "A bright sine pad"},
        {"type": "prompt", "task": "Adjust damping"},
        {"type": "reflection", "topic": "the sound"},
    ])
    r = await client.post("/api/v1/admin/lessons/generate", headers=_ah(), json=spec)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["generation_status"] == "ready", data
    assert len(data["steps"]) == 4
    assert data["steps"][0]["config"]["content"].startswith("### Physical")
    assert "e=sine" in data["steps"][1]["config"]["payload"]
    assert data["steps"][2]["config"]["constraints"] == ["damping", "brightness"]
    assert data["steps"][3]["config"]["prompt"].endswith("?")
    assert len(mock.calls) == 4


async def test_generation_caches_across_runs(app, client, admin_key):
    await _make_track(client, admin_key)
    mock = MockLLMClient()
    app.state.llm = mock
    for resp in (_LONG_TEXT, json.dumps(_VALID_PATCH)):
        mock.add_response(resp)
    spec = _spec("synth", [
        {"type": "text", "topic": "intro"},
        {"type": "demo", "patch_brief": "sine pad"},
    ])
    r1 = await client.post("/api/v1/admin/lessons/generate", headers=_ah(), json=spec)
    lesson_id = r1.json()["id"]
    assert len(mock.calls) == 2

    # Regenerate with a fresh mock that has NO responses: a cache hit must mean
    # zero LLM calls yet still produce a ready lesson.
    mock2 = MockLLMClient()
    app.state.llm = mock2
    r2 = await client.post(f"/api/v1/admin/lessons/{lesson_id}/regenerate", headers=_ah())
    assert r2.status_code == 200, r2.text
    assert r2.json()["generation_status"] == "ready"
    assert len(mock2.calls) == 0


async def test_prompt_version_bump_busts_cache(app, client, admin_key, monkeypatch):
    await _make_track(client, admin_key)
    mock = MockLLMClient()
    app.state.llm = mock
    mock.add_response(_LONG_TEXT)
    spec = _spec("synth", [{"type": "text", "topic": "intro"}])
    r1 = await client.post("/api/v1/admin/lessons/generate", headers=_ah(), json=spec)
    lesson_id = r1.json()["id"]
    assert len(mock.calls) == 1

    monkeypatch.setattr(lg, "LESSON_PROMPT_VERSION", "v9.9.9")
    mock2 = MockLLMClient()
    app.state.llm = mock2
    mock2.add_response(_LONG_TEXT + " bumped.")
    r2 = await client.post(f"/api/v1/admin/lessons/{lesson_id}/regenerate", headers=_ah())
    assert r2.json()["generation_status"] == "ready"
    assert len(mock2.calls) == 1  # fresh generation, not a cache hit


async def test_generation_failure_after_retries(app, client, admin_key):
    await _make_track(client, admin_key)
    mock = MockLLMClient()
    app.state.llm = mock
    mock.add_response(_LONG_TEXT)
    for _ in range(3):  # demo: 1 initial + 2 retries, all invalid
        mock.add_response("not a patch")
    spec = _spec("synth", [
        {"type": "text", "topic": "intro"},
        {"type": "demo", "patch_brief": "broken"},
    ])
    r = await client.post("/api/v1/admin/lessons/generate", headers=_ah(), json=spec)
    data = r.json()
    assert data["generation_status"] == "generation_failed"
    assert "step 1" in data["generation_error"]


async def test_svg_diagram_step(app, client, admin_key):
    await _make_track(client, admin_key)
    mock = MockLLMClient()
    app.state.llm = mock
    mock.add_response(_LONG_TEXT)
    mock.add_response(_VALID_SVG)
    spec = _spec("synth", [{"type": "text", "topic": "signal flow", "diagram": "svg"}])
    r = await client.post("/api/v1/admin/lessons/generate", headers=_ah(), json=spec)
    data = r.json()
    assert data["generation_status"] == "ready", data
    assert data["steps"][0]["config"]["diagram"]["kind"] == "svg"
    assert "<svg" in data["steps"][0]["config"]["diagram"]["source"]


async def test_manual_override_preserved_on_regenerate(app, client, admin_key):
    await _make_track(client, admin_key)
    mock = MockLLMClient()
    app.state.llm = mock
    mock.add_response(_LONG_TEXT)
    mock.add_response(json.dumps({"prompt": "Adjust drift.", "hint": None}))
    spec = _spec("synth", [
        {"type": "text", "topic": "intro"},
        {"type": "prompt", "task": "adjust"},
    ])
    r = await client.post("/api/v1/admin/lessons/generate", headers=_ah(), json=spec)
    text_step_id = r.json()["steps"][0]["id"]

    ov = await client.put(
        f"/api/v1/admin/lesson-steps/{text_step_id}/override", headers=_ah(),
        json={"content": {"title": "Hand", "content": "Hand-written", "key_points": []}},
    )
    assert ov.status_code == 200, ov.text

    # Regenerate: overridden step is skipped (no LLM call), others would re-run
    # but are cache hits → zero LLM calls.
    mock2 = MockLLMClient()
    app.state.llm = mock2
    r2 = await client.post(f"/api/v1/admin/lessons/{r.json()['id']}/regenerate", headers=_ah())
    assert len(mock2.calls) == 0
    steps = r2.json()["steps"]
    assert steps[0]["manual_override_content"]["content"] == "Hand-written"

    # Public lesson serves the override over the generated config.
    pub = await client.get("/api/v1/lessons/synth/karplus")
    assert pub.json()["steps"][0]["config"]["content"] == "Hand-written"


async def test_unready_lesson_hidden_from_public(app, client, admin_key):
    await _make_track(client, admin_key)
    mock = MockLLMClient()
    app.state.llm = mock
    mock.add_response(_LONG_TEXT)
    mock.add_response("not a patch")
    mock.add_response("not a patch")
    mock.add_response("not a patch")
    spec = _spec("synth", [
        {"type": "text", "topic": "intro"},
        {"type": "demo", "patch_brief": "broken"},
    ])
    await client.post("/api/v1/admin/lessons/generate", headers=_ah(), json=spec)
    pub = await client.get("/api/v1/lessons/synth/karplus")
    assert pub.status_code == 404


async def test_spec_validation_errors(app, client, admin_key):
    await _make_track(client, admin_key)
    # demo without patch_brief
    bad = _spec("synth", [{"type": "demo"}])
    r = await client.post("/api/v1/admin/lessons/generate", headers=_ah(), json=bad)
    assert r.status_code == 400
    # diagram on non-text
    bad2 = _spec("synth", [{"type": "demo", "patch_brief": "x", "diagram": "svg"}])
    r2 = await client.post("/api/v1/admin/lessons/generate", headers=_ah(), json=bad2)
    assert r2.status_code == 400
    # unknown track
    bad3 = _spec("ghost", [{"type": "text", "topic": "x"}])
    r3 = await client.post("/api/v1/admin/lessons/generate", headers=_ah(), json=bad3)
    assert r3.status_code == 404


async def test_admin_lessons_list_includes_status(app, client, admin_key):
    await _make_track(client, admin_key)
    mock = MockLLMClient()
    app.state.llm = mock
    mock.add_response(_LONG_TEXT)
    spec = _spec("synth", [{"type": "text", "topic": "intro"}])
    await client.post("/api/v1/admin/lessons/generate", headers=_ah(), json=spec)
    r = await client.get("/api/v1/admin/lessons", headers=_ah())
    assert r.status_code == 200, r.text
    rows = r.json()
    assert any(row["slug"] == "karplus" and row["generation_status"] == "ready" for row in rows)


async def test_admin_endpoints_require_key(client):
    r = await client.post("/api/v1/admin/lessons/generate", json=_spec("x", [{"type": "text", "topic": "y"}]))
    assert r.status_code in (404, 401)
