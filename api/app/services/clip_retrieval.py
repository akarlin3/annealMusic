"""Audio-clip retrieval (v6.2).

ONE ranking implementation, shared by the admin search endpoint and the LLM
lesson-generation pipeline (rules of engagement: "clip retrieval logic lives
once"). Three signals, blended:

1. Embedding similarity of a free-text query against the clip description.
2. Tag intersection (Jaccard) between requested tags and ``concept_tags``.
3. Track-affinity boost when the lesson's track is in ``track_affinity``.

Scoring is exact and in-Python over the non-archived library (≤~60 rows), which
mirrors how patch/piece similarity search already works in this repo. The
pgvector ivfflat index is forward-looking for when the library grows.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AudioClip
from app.services.embeddings import EmbeddingClient

# Blend weights. Embedding dominates; tags refine; affinity is a gentle nudge.
W_EMBED = 0.6
W_TAGS = 0.3
W_AFFINITY = 0.1


@dataclass
class ClipMatch:
    clip: AudioClip
    score: float


def _cosine_sim(v1: list[float], v2: list[float]) -> float:
    """Cosine similarity in [-1, 1]; 0 when either vector is degenerate. Mirrors
    ``get_cosine_dist`` in routers/patches.py (sim = 1 - dist)."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm_a = math.sqrt(sum(a * a for a in v1))
    norm_b = math.sqrt(sum(b * b for b in v2))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _jaccard(a: list[str], b: list[str]) -> float:
    sa, sb = {x.lower() for x in a}, {x.lower() for x in b}
    if not sa or not sb:
        return 0.0
    inter = len(sa & sb)
    union = len(sa | sb)
    return inter / union if union else 0.0


async def search_clips(
    session: AsyncSession,
    *,
    embeddings: EmbeddingClient | None = None,
    query_text: str | None = None,
    tags: list[str] | None = None,
    track: str | None = None,
    limit: int = 3,
) -> list[ClipMatch]:
    """Rank non-archived clips by the blended score and return the top ``limit``.

    A signal contributes 0 when its input is absent (no query / no tags / no
    track), so the blend degrades gracefully to whichever signals are provided.
    """
    clips = (
        await session.execute(select(AudioClip).where(AudioClip.archived_at.is_(None)))
    ).scalars().all()
    if not clips:
        return []

    query_vec: list[float] | None = None
    if query_text and embeddings is not None:
        try:
            query_vec = await embeddings.embed(query_text)
        except Exception:  # noqa: BLE001 — embedding is best-effort; fall back to tags/affinity.
            query_vec = None

    tags = tags or []
    matches: list[ClipMatch] = []
    for clip in clips:
        embed_score = (
            (_cosine_sim(query_vec, clip.description_embedding) + 1.0) / 2.0
            if query_vec and clip.description_embedding
            else 0.0
        )
        tag_score = _jaccard(tags, list(clip.concept_tags or []))
        affinity_score = 1.0 if track and track in (clip.track_affinity or []) else 0.0
        score = W_EMBED * embed_score + W_TAGS * tag_score + W_AFFINITY * affinity_score
        matches.append(ClipMatch(clip=clip, score=score))

    matches.sort(key=lambda m: (m.score, m.clip.slug), reverse=True)
    return matches[:limit]
