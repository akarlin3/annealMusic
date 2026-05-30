"""Seed the audio-clip library from the committed manifest (v6.2).

The manifest (``api/data/clip_library.json``) is the source of truth for the
shipped library. Seeding upserts each entry by slug and (re)computes the
description embedding. Idempotent: re-running updates metadata + embeddings and
leaves already-present rows otherwise untouched.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AudioClip
from app.services.embeddings import EmbeddingClient

MANIFEST_PATH = Path(__file__).resolve().parents[2] / "data" / "clip_library.json"


def load_manifest(path: Path | None = None) -> list[dict[str, Any]]:
    data = json.loads((path or MANIFEST_PATH).read_text())
    return data.get("clips", [])


def _embed_text(entry: dict[str, Any]) -> str:
    return (entry["description"] + " " + " ".join(entry.get("concept_tags", []))).strip()


async def seed_clips_from_manifest(
    session: AsyncSession,
    embeddings: EmbeddingClient,
    *,
    manifest: list[dict[str, Any]] | None = None,
) -> int:
    """Upsert every manifest clip into ``audio_clips``. Returns the count seeded."""
    entries = manifest if manifest is not None else load_manifest()
    count = 0
    for entry in entries:
        slug = entry["slug"]
        storage_key = f"public:{entry['file']}"
        try:
            embedding = await embeddings.embed(_embed_text(entry))
        except Exception:  # noqa: BLE001 — embedding is best-effort.
            embedding = None

        clip = (
            await session.execute(select(AudioClip).where(AudioClip.slug == slug))
        ).scalar_one_or_none()
        if clip is None:
            clip = AudioClip(slug=slug)
            session.add(clip)
        clip.title = entry["title"]
        clip.description = entry["description"]
        clip.duration_ms = entry["duration_ms"]
        clip.storage_key = storage_key
        clip.track_affinity = entry.get("track_affinity", [])
        clip.concept_tags = entry.get("concept_tags", [])
        clip.license = entry["license"]
        clip.attribution = entry.get("attribution")
        if embedding is not None:
            clip.description_embedding = embedding
        count += 1
    await session.commit()
    return count
