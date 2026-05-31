from __future__ import annotations

import re

import pytest
import pytest_asyncio

from app.services.embeddings import EmbeddingClient


class HashEmbeddingClient(EmbeddingClient):
    """Deterministic bag-of-words embedding so cosine similarity reflects token
    overlap — good enough to exercise the semantic ranking path in tests."""

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


@pytest_asyncio.fixture
async def seeded(app):
    """Seed the full clip manifest with deterministic embeddings."""
    from app.db import get_sessionmaker
    from app.services.clip_seed import seed_clips_from_manifest

    app.state.embeddings = HashEmbeddingClient()
    sm = get_sessionmaker()
    async with sm() as session:
        n = await seed_clips_from_manifest(session, HashEmbeddingClient())
    assert n >= 40
    return app


async def test_tag_and_affinity_surface_expected_clips(seeded):
    from app.db import get_sessionmaker
    from app.services.clip_retrieval import search_clips

    sm = get_sessionmaker()
    async with sm() as session:
        matches = await search_clips(
            session,
            embeddings=HashEmbeddingClient(),
            tags=["physical-modeling", "string"],
            track="synthesis-fundamentals",
            limit=3,
        )
    slugs = [m.clip.slug for m in matches]
    # The "physical modeling string" smoke expectation from the plan.
    assert "karplus-archetype" in slugs
    assert any(s.startswith("physical-") for s in slugs)


async def test_freetext_embedding_ranks_relevant_above_irrelevant(seeded):
    from app.db import get_sessionmaker
    from app.services.clip_retrieval import search_clips

    sm = get_sessionmaker()
    async with sm() as session:
        matches = await search_clips(
            session,
            embeddings=HashEmbeddingClient(),
            query_text="physical modeling string pluck karplus",
            limit=5,
        )
    slugs = [m.clip.slug for m in matches]
    assert "karplus-archetype" in slugs
    # An unrelated production clip should not outrank the string clips.
    assert "comp-pumping" not in slugs[:3]


async def test_limit_respected_and_sorted(seeded):
    from app.db import get_sessionmaker
    from app.services.clip_retrieval import search_clips

    sm = get_sessionmaker()
    async with sm() as session:
        matches = await search_clips(
            session, embeddings=HashEmbeddingClient(), tags=["fm"], limit=2
        )
    assert len(matches) == 2
    assert matches[0].score >= matches[1].score


async def test_admin_search_endpoint(seeded, admin_key):
    from httpx import ASGITransport, AsyncClient

    transport = ASGITransport(app=seeded)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.get(
            "/api/v1/admin/clips/search",
            headers={"x-admin-key": admin_key},
            params={"tags": ["physical-modeling", "string"], "track": "synthesis-fundamentals", "limit": 3},
        )
    assert r.status_code == 200, r.text
    results = r.json()
    assert len(results) <= 3
    assert any(x["slug"] == "karplus-archetype" for x in results)


async def test_empty_library_returns_empty(app):
    from app.db import get_sessionmaker
    from app.services.clip_retrieval import search_clips

    sm = get_sessionmaker()
    async with sm() as session:
        matches = await search_clips(session, tags=["anything"], limit=3)
    assert matches == []
