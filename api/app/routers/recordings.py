from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from app.config import get_settings
from app.deps import (
    CurrentUser,
    CurrentWriter,
    SessionDep,
    StorageDep,
    rate_limit,
)
from app.errors import forbidden, not_found, quota_exceeded
from app.models import Recording
from app.schemas import RecordingCreate, RecordingListOut, RecordingOut

router = APIRouter(prefix="/api/v1/recordings", tags=["recordings"])


@router.post("", response_model=RecordingOut, status_code=201,
             dependencies=[Depends(rate_limit("recordings"))])
async def create_recording(
    body: RecordingCreate, user: CurrentWriter, session: SessionDep
) -> RecordingOut:
    # v0.7 establishes the schema + endpoints; the render/export pipeline is
    # v1.0 (client-side). This persists metadata for an already-stored blob.
    settings = get_settings()
    if user.recording_count >= settings.quota_recordings:
        raise quota_exceeded("recordings", settings.quota_recordings)
    if user.bytes_used + body.bytes > settings.quota_bytes:
        raise quota_exceeded("bytes", settings.quota_bytes)

    rec = Recording(
        user_id=user.id,
        storage_key=body.storage_key,
        duration_ms=body.duration_ms,
        bytes=body.bytes,
        format=body.format,
        patch_id=body.patch_id,
        title=body.title,
        visibility=body.visibility,
    )
    session.add(rec)
    user.recording_count += 1
    user.bytes_used += body.bytes
    await session.commit()
    await session.refresh(rec)
    return RecordingOut.model_validate(rec)


@router.get("/me", response_model=RecordingListOut,
            dependencies=[Depends(rate_limit("get"))])
async def list_my_recordings(
    user: CurrentUser, session: SessionDep
) -> RecordingListOut:
    rows = (
        await session.execute(
            select(Recording)
            .where(Recording.user_id == user.id)
            .order_by(Recording.created_at.desc())
        )
    ).scalars().all()
    await session.commit()
    return RecordingListOut(items=[RecordingOut.model_validate(r) for r in rows])


@router.get("/{id}", dependencies=[Depends(rate_limit("get"))])
async def get_recording(id: uuid.UUID, session: SessionDep, storage: StorageDep):
    rec = await session.get(Recording, id)
    if rec is None:
        raise not_found("recording")
    url = await storage.presigned_get_url(rec.storage_key)
    return RedirectResponse(url=url, status_code=302)


@router.delete("/{id}", status_code=204,
               dependencies=[Depends(rate_limit("recordings"))])
async def delete_recording(
    id: uuid.UUID, user: CurrentWriter, session: SessionDep, storage: StorageDep
) -> None:
    rec = await session.get(Recording, id)
    if rec is None:
        raise not_found("recording")
    if rec.user_id != user.id:
        raise forbidden()
    await storage.delete(rec.storage_key)
    user.recording_count = max(0, user.recording_count - 1)
    user.bytes_used = max(0, user.bytes_used - rec.bytes)
    await session.delete(rec)
    await session.commit()
