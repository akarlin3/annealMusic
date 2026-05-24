from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.deps import (
    CurrentUser,
    CurrentWriter,
    SessionDep,
    StorageDep,
    rate_limit,
)
from app.errors import bad_request, file_too_large, forbidden, not_found, quota_exceeded
from app.models import Capture, User
from app.schemas import CaptureOut
from app.storage import StorageClient, inspect_wav, transcode_to_opus

router = APIRouter(prefix="/api/v1/captures", tags=["captures"])

ORPHAN_GRACE = timedelta(hours=24)


def _to_out(c: Capture) -> CaptureOut:
    return CaptureOut.model_validate(c)


@router.post("", response_model=CaptureOut, status_code=201,
             dependencies=[Depends(rate_limit("captures"))])
async def upload_capture(
    user: CurrentWriter,
    session: SessionDep,
    storage: StorageDep,
    file: UploadFile = File(...),
) -> CaptureOut:
    settings = get_settings()

    if user.capture_count >= settings.quota_captures:
        raise quota_exceeded("captures", settings.quota_captures)

    wav = await file.read()
    if len(wav) > settings.max_capture_bytes:
        raise file_too_large()

    info = inspect_wav(wav)
    if info is None:
        raise bad_request("upload is not a valid PCM WAV")
    if info.duration_ms <= 0 or info.duration_ms > settings.max_capture_seconds * 1000:
        raise file_too_large()

    # Transcode to Opus when ffmpeg is available; otherwise store the WAV as-is
    # (the `format` column records what was actually written).
    if settings.transcode_enabled:
        body = await transcode_to_opus(wav, settings.opus_bitrate_kbps)
        fmt, ext, content_type = "opus", "opus", "audio/ogg"
    else:
        body, fmt, ext, content_type = wav, "wav", "wav", "audio/wav"

    if user.bytes_used + len(body) > settings.quota_bytes:
        raise quota_exceeded("bytes", settings.quota_bytes)

    capture_id = uuid.uuid4()
    storage_key = f"captures/{user.id}/{capture_id}.{ext}"
    await storage.put(storage_key, body, content_type)

    capture = Capture(
        id=capture_id,
        user_id=user.id,
        storage_key=storage_key,
        duration_ms=info.duration_ms,
        sample_rate=info.sample_rate,
        channels=info.channels,
        bytes=len(body),
        format=fmt,
        ref_count=0,
    )
    session.add(capture)
    user.capture_count += 1
    user.bytes_used += len(body)
    await session.commit()
    await session.refresh(capture)
    return _to_out(capture)


@router.get("/{id}", dependencies=[Depends(rate_limit("get"))])
async def get_capture(id: uuid.UUID, session: SessionDep, storage: StorageDep):
    capture = await session.get(Capture, id)
    if capture is None:
        raise not_found("capture")
    url = await storage.presigned_get_url(capture.storage_key)
    return RedirectResponse(url=url, status_code=302)


@router.delete("/{id}", status_code=204,
               dependencies=[Depends(rate_limit("captures"))])
async def delete_capture(
    id: uuid.UUID, user: CurrentWriter, session: SessionDep, storage: StorageDep
) -> None:
    capture = await session.get(Capture, id)
    if capture is None:
        raise not_found("capture")
    if capture.user_id != user.id:
        raise forbidden()
    await storage.delete(capture.storage_key)
    user.capture_count = max(0, user.capture_count - 1)
    user.bytes_used = max(0, user.bytes_used - capture.bytes)
    await session.delete(capture)
    await session.commit()


async def sweep_orphans(session: AsyncSession, storage: StorageClient) -> int:
    """Delete captures referenced by nothing for longer than the grace period.
    Returns the number deleted. Invoked by a scheduled job (see DEPLOY.md)."""
    cutoff = datetime.now(tz=timezone.utc) - ORPHAN_GRACE
    rows = (
        await session.execute(
            select(Capture).where(
                Capture.ref_count <= 0, Capture.created_at < cutoff
            )
        )
    ).scalars().all()
    for capture in rows:
        await storage.delete(capture.storage_key)
        owner = await session.get(User, capture.user_id)
        if owner is not None:
            owner.capture_count = max(0, owner.capture_count - 1)
            owner.bytes_used = max(0, owner.bytes_used - capture.bytes)
        await session.delete(capture)
    await session.commit()
    return len(rows)
