"""Audio clip library endpoints (v6.2).

Public: clip metadata + audio streaming. Admin (``x-admin-key``): upload,
edit, archive, and search. Search and the LLM pipeline share one ranking
implementation (``app.services.clip_retrieval``).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import RedirectResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.deps import SessionDep, StorageDep, require_admin
from app.errors import bad_request, not_found
from app.models import AudioClip
from app.schemas import (
    AudioClipMeta,
    AudioClipOut,
    AudioClipPatch,
    ClipSearchResult,
)
from app.storage import StorageClient, inspect_wav, transcode_to_mono_opus

router = APIRouter(prefix="/api/v1", tags=["clips"])
admin_router = APIRouter(
    prefix="/api/v1/admin", tags=["clips-admin"], dependencies=[Depends(require_admin)]
)

PUBLIC_PREFIX = "public:"


def _audio_url(clip: AudioClip) -> str:
    """Static path for shipped clips, else the API streaming endpoint."""
    if clip.storage_key.startswith(PUBLIC_PREFIX):
        return "/" + clip.storage_key[len(PUBLIC_PREFIX):]
    return f"/api/v1/clips/{clip.slug}/audio"


def _clip_out(clip: AudioClip) -> AudioClipOut:
    return AudioClipOut(
        id=clip.id,
        slug=clip.slug,
        title=clip.title,
        description=clip.description,
        duration_ms=clip.duration_ms,
        track_affinity=list(clip.track_affinity or []),
        concept_tags=list(clip.concept_tags or []),
        license=clip.license,
        attribution=clip.attribution,
        audio_url=_audio_url(clip),
        created_at=clip.created_at,
    )


def _embed_text(description: str, tags: list[str]) -> str:
    return (description + " " + " ".join(tags)).strip()


async def _load_clip(session: AsyncSession, slug: str) -> AudioClip:
    clip = (
        await session.execute(
            select(AudioClip).where(
                AudioClip.slug == slug, AudioClip.archived_at.is_(None)
            )
        )
    ).scalar_one_or_none()
    if clip is None:
        raise not_found("clip")
    return clip


# --- Public ------------------------------------------------------------------

@router.get("/clips/{slug}", response_model=AudioClipOut)
async def get_clip(slug: str, session: SessionDep) -> AudioClipOut:
    return _clip_out(await _load_clip(session, slug))


@router.get("/clips/{slug}/audio")
async def get_clip_audio(slug: str, session: SessionDep, storage: StorageDep):
    clip = await _load_clip(session, slug)
    # Shipped clips live as static assets; redirect to the static path.
    if clip.storage_key.startswith(PUBLIC_PREFIX):
        return RedirectResponse(url="/" + clip.storage_key[len(PUBLIC_PREFIX):])
    data = await storage.get(clip.storage_key)
    if data is None:
        raise not_found("clip audio")
    return StreamingResponse(iter([data]), media_type="audio/ogg")


# --- Admin -------------------------------------------------------------------

async def _store_audio(
    storage: StorageClient, slug: str, raw: bytes, declared_ms: int | None
) -> tuple[str, int]:
    """Persist audio bytes; return (storage_key, duration_ms). Transcodes WAV to
    mono Opus when enabled (mirrors the captures path), else stores as-is."""
    settings = get_settings()
    wav = inspect_wav(raw)
    duration_ms = declared_ms or (wav.duration_ms if wav else None)
    if duration_ms is None:
        raise bad_request("could not determine duration; supply 'duration_ms' or upload a WAV")
    if not (0 < duration_ms <= 120000):
        raise bad_request("duration must be 1–120000 ms")

    body, content_type = raw, "audio/ogg"
    if wav and settings.transcode_enabled:
        body = await transcode_to_mono_opus(raw, settings.opus_bitrate_kbps)

    storage_key = f"clips/{slug}"
    await storage.put(storage_key, body, content_type)
    return storage_key, duration_ms


@admin_router.post("/clips", response_model=AudioClipOut, status_code=201)
async def create_clip(
    request: Request,
    session: SessionDep,
    storage: StorageDep,
    meta: str = Form(..., description="JSON-encoded AudioClipMeta"),
    file: UploadFile = File(...),
) -> AudioClipOut:
    try:
        parsed = AudioClipMeta.model_validate_json(meta)
    except Exception as exc:  # noqa: BLE001
        raise bad_request(f"invalid clip metadata: {exc}")

    existing = (
        await session.execute(select(AudioClip).where(AudioClip.slug == parsed.slug))
    ).scalar_one_or_none()
    if existing is not None:
        raise bad_request(f"clip slug '{parsed.slug}' already exists")

    raw = await file.read()
    if not raw:
        raise bad_request("empty audio upload")
    storage_key, duration_ms = await _store_audio(storage, parsed.slug, raw, parsed.duration_ms)

    embeddings = request.app.state.embeddings
    try:
        embedding = await embeddings.embed(_embed_text(parsed.description, parsed.concept_tags))
    except Exception:  # noqa: BLE001 — clip is still usable without an embedding.
        embedding = None

    clip = AudioClip(
        slug=parsed.slug,
        title=parsed.title,
        description=parsed.description,
        duration_ms=duration_ms,
        storage_key=storage_key,
        track_affinity=parsed.track_affinity,
        concept_tags=parsed.concept_tags,
        license=parsed.license,
        attribution=parsed.attribution,
        description_embedding=embedding,
    )
    session.add(clip)
    await session.commit()
    await session.refresh(clip)
    return _clip_out(clip)


@admin_router.patch("/clips/{clip_id}", response_model=AudioClipOut)
async def patch_clip(
    clip_id: uuid.UUID, body: AudioClipPatch, request: Request, session: SessionDep
) -> AudioClipOut:
    clip = await session.get(AudioClip, clip_id)
    if clip is None or clip.archived_at is not None:
        raise not_found("clip")

    if body.title is not None:
        clip.title = body.title
    if body.description is not None:
        clip.description = body.description
    if body.track_affinity is not None:
        clip.track_affinity = body.track_affinity
    if body.concept_tags is not None:
        clip.concept_tags = body.concept_tags
    if body.license is not None:
        clip.license = body.license
    if body.attribution is not None:
        clip.attribution = body.attribution

    # License attribution invariant (mirrors AudioClipMeta).
    if clip.license != "original-by-you" and not (clip.attribution or "").strip():
        raise bad_request(f"attribution is required for license '{clip.license}'")

    # Re-embed when the embedding inputs changed.
    if body.description is not None or body.concept_tags is not None:
        try:
            clip.description_embedding = await request.app.state.embeddings.embed(
                _embed_text(clip.description, list(clip.concept_tags or []))
            )
        except Exception:  # noqa: BLE001
            pass

    await session.commit()
    await session.refresh(clip)
    return _clip_out(clip)


@admin_router.delete("/clips/{clip_id}", response_model=AudioClipOut)
async def archive_clip(clip_id: uuid.UUID, session: SessionDep) -> AudioClipOut:
    from datetime import datetime, timezone

    clip = await session.get(AudioClip, clip_id)
    if clip is None:
        raise not_found("clip")
    if clip.archived_at is None:
        clip.archived_at = datetime.now(tz=timezone.utc)
        await session.commit()
        await session.refresh(clip)
    return _clip_out(clip)


@admin_router.get("/clips", response_model=list[AudioClipOut])
async def list_clips(session: SessionDep) -> list[AudioClipOut]:
    clips = (
        await session.execute(
            select(AudioClip)
            .where(AudioClip.archived_at.is_(None))
            .order_by(AudioClip.slug.asc())
        )
    ).scalars().all()
    return [_clip_out(c) for c in clips]


@admin_router.get("/clips/search", response_model=list[ClipSearchResult])
async def search_clips_endpoint(
    request: Request,
    session: SessionDep,
    q: str | None = Query(default=None, description="free-text concept query"),
    tags: list[str] | None = Query(default=None),
    track: str | None = Query(default=None),
    limit: int = Query(default=3, ge=1, le=20),
) -> list[ClipSearchResult]:
    from app.services.clip_retrieval import search_clips

    matches = await search_clips(
        session,
        embeddings=request.app.state.embeddings,
        query_text=q,
        tags=tags,
        track=track,
        limit=limit,
    )
    return [
        ClipSearchResult(
            slug=m.clip.slug,
            title=m.clip.title,
            description=m.clip.description,
            duration_ms=m.clip.duration_ms,
            track_affinity=list(m.clip.track_affinity or []),
            concept_tags=list(m.clip.concept_tags or []),
            score=round(m.score, 6),
        )
        for m in matches
    ]
