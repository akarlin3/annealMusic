from __future__ import annotations

import json
import uuid

import pytest

from app.services.llm import MockLLMClient
from tests.test_social_checkpoint1 import _create_test_account


def _hdr(anon: str | None = None) -> dict[str, str]:
    return {"x-anon-id": anon or str(uuid.uuid4())}


@pytest.fixture
def admin_key(monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("ADMIN_KEY", "secret")
    get_settings.cache_clear()
    return "secret"


async def _make_track(client, admin_key, slug, position=1) -> dict:
    r = await client.post(
        "/api/v1/admin/tracks",
        headers={"x-admin-key": admin_key},
        json={"slug": slug, "title": slug.replace("-", " ").title(), "position": position},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _make_lesson(
    client, admin_key, track_id, slug, *, difficulty="intro", position=1, prereqs=None
) -> dict:
    r = await client.post(
        "/api/v1/admin/lessons",
        headers={"x-admin-key": admin_key},
        json={
            "track_id": track_id,
            "slug": slug,
            "title": slug.replace("-", " ").title(),
            "difficulty": difficulty,
            "estimated_minutes": 8,
            "position": position,
            "prerequisites": prereqs or [],
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _signed_in(client) -> dict:
    from app.db import get_sessionmaker

    sm = get_sessionmaker()
    sess_id, acc_id = uuid.uuid4(), uuid.uuid4()
    anon = str(uuid.uuid4())
    await _create_test_account(sm, f"{uuid.uuid4().hex}@example.com", sess_id, acc_id)
    client.cookies.set("am_session", str(sess_id))
    await client.post("/api/v1/account/me/claim", json={"anon_id": anon})
    client.cookies.set("am_session", str(sess_id))
    return _hdr(anon)


async def _complete(client, h, lesson_id):
    r = await client.post(
        "/api/v1/lesson-progress",
        headers=h,
        json={"lesson_id": lesson_id, "state": "completed"},
    )
    assert r.status_code == 200, r.text


# --- Onboarding --------------------------------------------------------------


async def test_onboarding_for_new_user(client, app, admin_key):
    t1 = await _make_track(client, admin_key, "synthesis-fundamentals", position=1)
    t2 = await _make_track(client, admin_key, "composition-technique", position=2)
    await _make_lesson(client, admin_key, t1["id"], "sine", difficulty="intro", position=1)
    await _make_lesson(client, admin_key, t2["id"], "arcs", difficulty="intro", position=1)

    mock = MockLLMClient()
    app.state.llm = mock
    h = await _signed_in(client)

    r = await client.post("/api/v1/recommendations/next", headers=h, json={"context": "arrival"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["source"] == "onboarding"
    assert 1 <= len(body["items"]) <= 3
    # No LLM call needed for onboarding.
    assert mock.calls == []


# --- Stage 2 LLM ranking -----------------------------------------------------


async def test_llm_ranking_after_completion(client, app, admin_key):
    t1 = await _make_track(client, admin_key, "synthesis-fundamentals", position=1)
    l_done = await _make_lesson(client, admin_key, t1["id"], "sine", position=1)
    l_next = await _make_lesson(client, admin_key, t1["id"], "fm", position=2)
    await _make_lesson(client, admin_key, t1["id"], "granular", position=3)

    mock = MockLLMClient()
    mock.add_response(
        json.dumps(
            {"recommendations": [{"lesson_id": l_next["id"], "rationale": "Builds on the sine engine."}]}
        )
    )
    app.state.llm = mock

    h = await _signed_in(client)
    await _complete(client, h, l_done["id"])

    r = await client.post(
        "/api/v1/recommendations/next",
        headers=h,
        json={"context": "completion", "just_completed_lesson_id": l_done["id"]},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["source"] == "llm"
    assert body["items"][0]["lesson_id"] == l_next["id"]
    assert body["items"][0]["rationale"] == "Builds on the sine engine."
    assert body["items"][0]["track_slug"] == "synthesis-fundamentals"


async def test_hallucinated_ids_dropped_then_fallback(client, app, admin_key):
    t1 = await _make_track(client, admin_key, "synthesis-fundamentals", position=1)
    l_done = await _make_lesson(client, admin_key, t1["id"], "sine", position=1)
    await _make_lesson(client, admin_key, t1["id"], "fm", position=2)

    mock = MockLLMClient()
    # Both attempts return only hallucinated ids → parser yields nothing → fallback.
    bogus = json.dumps({"recommendations": [{"lesson_id": str(uuid.uuid4()), "rationale": "x"}]})
    mock.add_response(bogus)
    mock.add_response(bogus)
    app.state.llm = mock

    h = await _signed_in(client)
    await _complete(client, h, l_done["id"])

    r = await client.post(
        "/api/v1/recommendations/next",
        headers=h,
        json={"context": "completion", "just_completed_lesson_id": l_done["id"]},
    )
    body = r.json()
    assert body["source"] == "deterministic"
    assert len(body["items"]) >= 1
    # Retried once before giving up.
    assert len(mock.calls) == 2


# --- Stage 1 determinism: prerequisites + difficulty -------------------------


async def test_prereqs_not_met_are_excluded(client, app, admin_key):
    t1 = await _make_track(client, admin_key, "synthesis-fundamentals", position=1)
    l_done = await _make_lesson(client, admin_key, t1["id"], "sine", position=1)
    l_open = await _make_lesson(client, admin_key, t1["id"], "fm", position=2)
    # l_locked requires a lesson the user has NOT completed.
    other = await _make_lesson(client, admin_key, t1["id"], "wavetable", position=4, difficulty="intermediate")
    l_locked = await _make_lesson(
        client, admin_key, t1["id"], "advanced-fm", position=3,
        difficulty="intermediate", prereqs=[other["id"]],
    )

    mock = MockLLMClient()
    # Echo back whatever candidates the prompt contains so we can assert the set.
    app.state.llm = mock

    h = await _signed_in(client)
    await _complete(client, h, l_done["id"])

    r = await client.post(
        "/api/v1/recommendations/next",
        headers=h,
        json={"context": "completion", "just_completed_lesson_id": l_done["id"]},
    )
    assert r.status_code == 200
    # The locked lesson must never be offered (prereq unmet).
    prompt = mock.calls[0]["prompt"]
    assert l_open["id"] in prompt
    assert l_locked["id"] not in prompt


async def test_recommendation_model_is_haiku_45(client, app, admin_key):
    t1 = await _make_track(client, admin_key, "synthesis-fundamentals", position=1)
    l_done = await _make_lesson(client, admin_key, t1["id"], "sine", position=1)
    await _make_lesson(client, admin_key, t1["id"], "fm", position=2)

    mock = MockLLMClient()
    app.state.llm = mock
    h = await _signed_in(client)
    await _complete(client, h, l_done["id"])
    await client.post(
        "/api/v1/recommendations/next",
        headers=h,
        json={"context": "completion", "just_completed_lesson_id": l_done["id"]},
    )
    assert mock.calls[0]["model"] == "claude-haiku-4-5"


# --- Caching -----------------------------------------------------------------


async def test_identical_state_is_cached(client, app, admin_key):
    t1 = await _make_track(client, admin_key, "synthesis-fundamentals", position=1)
    l_done = await _make_lesson(client, admin_key, t1["id"], "sine", position=1)
    l_next = await _make_lesson(client, admin_key, t1["id"], "fm", position=2)

    mock = MockLLMClient()
    mock.add_response(
        json.dumps({"recommendations": [{"lesson_id": l_next["id"], "rationale": "Next."}]})
    )
    app.state.llm = mock

    h = await _signed_in(client)
    await _complete(client, h, l_done["id"])

    body = {"context": "completion", "just_completed_lesson_id": l_done["id"]}
    r1 = await client.post("/api/v1/recommendations/next", headers=h, json=body)
    r2 = await client.post("/api/v1/recommendations/next", headers=h, json=body)
    assert r1.json() == r2.json()
    # Second call within 5 min with identical state → served from cache, no 2nd LLM call.
    assert len(mock.calls) == 1


# --- Privacy -----------------------------------------------------------------


async def test_reflection_text_never_sent_to_llm(client, app, admin_key):
    t1 = await _make_track(client, admin_key, "synthesis-fundamentals", position=1)
    l_done = await _make_lesson(client, admin_key, t1["id"], "sine", position=1)
    await _make_lesson(client, admin_key, t1["id"], "fm", position=2)

    mock = MockLLMClient()
    app.state.llm = mock
    h = await _signed_in(client)

    secret = "MY-PRIVATE-REFLECTION-TEXT-12345"
    await client.post(
        "/api/v1/lesson-progress",
        headers=h,
        json={"lesson_id": l_done["id"], "state": "completed", "reflection_text": secret},
    )

    await client.post(
        "/api/v1/recommendations/next",
        headers=h,
        json={"context": "completion", "just_completed_lesson_id": l_done["id"]},
    )
    assert mock.calls, "expected an LLM call"
    for call in mock.calls:
        assert secret not in call["system"]
        assert secret not in call["prompt"]
