from __future__ import annotations

import json
import uuid
import pytest
from app.services.llm import MockLLMClient
from app.services.embeddings import MockEmbeddingClient

def _hdr(anon: str | None = None) -> dict[str, str]:
    return {"x-anon-id": anon or str(uuid.uuid4())}


@pytest.mark.asyncio
async def test_modify_patch_success(app, client):
    mock_llm = MockLLMClient()
    app.state.llm = mock_llm

    # Base patch: rootFreq=220, spread=1.0, brightness=0.5
    before_state = "m=open&e=sine&rootFreq=220&spread=1.00&brightness=0.50"

    # LLM will return modified patch: rootFreq=200, spread=0.8, brightness=0.3
    mock_modified = {
        "m": "open",
        "e": "sine",
        "rootFreq": 200,
        "spread": 0.80,
        "brightness": 0.30,
        "space": 0.50,
    }
    mock_llm.add_response(json.dumps(mock_modified), 150, 100)

    h = _hdr()
    r = await client.post(
        "/api/v1/ai/modify-patch",
        headers=h,
        json={"current_state": before_state, "direction": "darker and slower"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "state" in data
    assert "changes" in data

    # Verify changes diff
    changes = data["changes"]
    assert len(changes) == 4
    # rootFreq should have decreased
    rf_change = next(c for c in changes if c["key"] == "rootFreq")
    assert rf_change["direction"] == "decreased"
    assert rf_change["label"] == "Root Frequency"
    assert rf_change["oldValue"] == 220
    assert rf_change["newValue"] == 200

    # spread should have decreased
    spread_change = next(c for c in changes if c["key"] == "spread")
    assert spread_change["direction"] == "decreased"
    assert spread_change["oldValue"] == 1.0


@pytest.mark.asyncio
async def test_describe_patch_success(app, client):
    mock_llm = MockLLMClient()
    app.state.llm = mock_llm

    state = "m=open&e=sine&rootFreq=440&spread=1.00"
    mock_llm.add_response("Chilly mountain breeze, slow bells ringing.", 100, 20)

    h = _hdr()
    r = await client.post(
        "/api/v1/ai/describe-patch",
        headers=h,
        json={"state": state},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["description"] == "Chilly mountain breeze, slow bells ringing."


@pytest.mark.asyncio
async def test_describe_patch_moderated_fallback(app, client):
    mock_llm = MockLLMClient()
    app.state.llm = mock_llm

    state = "m=open&e=sine&rootFreq=440&spread=1.00"
    # LLM tries to generate a bad word
    mock_llm.add_response("Slow fuck ambient space with bit of noise.", 100, 20)

    h = _hdr()
    r = await client.post(
        "/api/v1/ai/describe-patch",
        headers=h,
        json={"state": state},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    # Should fall back to standard safe description
    assert data["description"] == "Calm ambient sound with organic shifts"


@pytest.mark.asyncio
async def test_background_embedding_and_similarity(app, client):
    # Setup mock LLM and embedding clients
    mock_llm = MockLLMClient()
    mock_embed = MockEmbeddingClient()
    app.state.llm = mock_llm
    app.state.embeddings = mock_embed

    # 1. Create a public patch (triggers background embed description task)
    # Mock LLM description response
    mock_llm.add_response("Chilly breeze, slow bells ringing.", 100, 20)

    h = _hdr()
    # Create the patch as public
    state_payload = "m=open&e=sine&rootFreq=440&spread=1.00&brightness=0.50"
    r = await client.post(
        "/api/v1/patches",
        headers=h,
        json={
            "state": state_payload,
            "schema_ver": 7,
            "title": "Frozen Lake",
            "visibility": "public",
        },
    )
    assert r.status_code == 201, r.text
    p1 = r.json()

    # The background task executes! Let's wait a brief moment for async execution or trigger directly.
    # Since FastAPI BackgroundTasks execute within the request-response thread loop asynchronously,
    # in standard pytest ASGI client they are run immediately during request or just after.
    # Let's verify by fetching the patch after a short interval.
    # Wait, the test uses SQLite in-memory, so they run in the same session. Let's retrieve by ID.
    g1 = await client.get(f"/api/v1/patches/{p1['id']}")
    assert g1.status_code == 200
    # Description should be generated and set by AI background task!
    assert g1.json()["ai_description"] == "Chilly breeze, slow bells ringing."
    assert g1.json()["ai_description_source"] == "ai"

    # 2. Create another similar public patch
    mock_llm.add_response("Freezing mountain dawn, crystal bells.", 100, 20)
    r2 = await client.post(
        "/api/v1/patches",
        headers=_hdr(), # different author
        json={
            "state": state_payload,
            "schema_ver": 7,
            "title": "Icy Morning",
            "visibility": "public",
        },
    )
    assert r2.status_code == 201
    p2 = r2.json()

    # 3. Create a third public patch that is NOT similar (completely different description)
    # The mock embedding client generates vectors where `sum(ord(c))/10000.0` is the scalar.
    # "Chilly breeze, slow bells ringing." -> sum=3051 -> vector element ~0.30
    # "Freezing mountain dawn, crystal bells." -> sum=3571 -> vector element ~0.35 (similar)
    # "Loud screeching feedback, aggressive noise." -> sum=4145 -> vector element ~0.41 (dissimilar)
    mock_llm.add_response("Loud screeching feedback, aggressive noise.", 100, 20)
    r3 = await client.post(
        "/api/v1/patches",
        headers=_hdr(),
        json={
            "state": state_payload,
            "schema_ver": 7,
            "title": "Aggressive Noise",
            "visibility": "public",
        },
    )
    assert r3.status_code == 201
    p3 = r3.json()

    # Retrieve similar patches row for Frozen Lake (p1['id'])
    sim = await client.get(f"/api/v1/patches/{p1['id']}/similar")
    assert sim.status_code == 200
    sim_data = sim.json()
    
    # It should return p2 ("Icy Morning") because its vector distance to p1 is < 0.4
    # and exclude p3 ("Aggressive Noise") because its distance is >= 0.4
    assert len(sim_data["items"]) == 1
    assert sim_data["items"][0]["id"] == p2["id"]
