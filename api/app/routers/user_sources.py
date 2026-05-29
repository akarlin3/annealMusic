from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, UploadFile, Request
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy import select

from app.config import get_settings
from app.deps import (
    CurrentUser,
    CurrentWriter,
    SessionDep,
    StorageDep,
    rate_limit,
)
from app.errors import (
    ApiError,
    bad_request,
    file_too_large,
    forbidden,
    not_found,
    quota_exceeded,
    invalid_audio,
    content_rejected,
)
from app.models import UserSource
from app.moderation import screen_publish
from app.schemas import (
    UserSourceOut,
    UserSourceListOut,
    UserSourceUpdate,
)
from app.storage import (
    decode_any_to_wav,
    transcode_to_mono_opus,
    validate_audio_safety,
    inspect_wav,
)

logger = logging.getLogger("user_sources")

router = APIRouter(prefix="/api/v1/user-sources", tags=["user-sources"])


def _to_out(src: UserSource) -> UserSourceOut:
    return UserSourceOut.model_validate(src)


@router.post("", response_model=UserSourceOut, status_code=201,
             dependencies=[Depends(rate_limit("captures"))])
async def upload_user_source(
    user: CurrentWriter,
    session: SessionDep,
    storage: StorageDep,
    file: UploadFile = File(...),
) -> UserSourceOut:
    settings = get_settings()

    # 1. Quota check
    if user.source_count >= settings.quota_user_sources:
        raise quota_exceeded("user_sources", settings.quota_user_sources)

    # Filename screening
    filename = file.filename or ""
    # Strip extension for moderation screening
    stem = filename.rsplit(".", 1)[0] if "." in filename else filename
    if screen_publish(stem, None):
        raise content_rejected("display_name")

    # 2. File size ceiling check (25MB before transcode)
    raw_data = await file.read()
    if len(raw_data) > 25 * 1024 * 1024:
        raise file_too_large()

    # 3. Decode to WAV using ffmpeg (re-encode protection)
    if settings.transcode_enabled:
        try:
            wav_data = await decode_any_to_wav(raw_data)
        except Exception as exc:
            logger.warning("ffmpeg decode failed: %s", exc)
            raise invalid_audio("corrupt or unsupported format")
    else:
        wav_data = raw_data

    info = inspect_wav(wav_data)
    if info is None:
        raise invalid_audio("corrupt WAV format")

    # 4. Length cap (60 seconds maximum)
    if info.duration_ms <= 0 or info.duration_ms > 60000:
        raise invalid_audio("audio duration exceeds 60 seconds")

    # 5. Amplitude / DC / NaN / silence checks
    try:
        validate_audio_safety(wav_data)
    except ValueError as exc:
        raise invalid_audio(str(exc))

    # 6. Transcode to mono Opus (96kbps)
    if settings.transcode_enabled:
        try:
            opus_data = await transcode_to_mono_opus(wav_data, settings.opus_bitrate_kbps)
            fmt, ext, content_type = "opus", "opus", "audio/ogg"
        except Exception as exc:
            logger.warning("ffmpeg transcode failed: %s", exc)
            raise invalid_audio("failed to transcode to Opus")
    else:
        opus_data = wav_data
        fmt, ext, content_type = "wav", "wav", "audio/wav"

    # 7. Total bytes used quota check
    if user.bytes_used + len(opus_data) > settings.quota_bytes:
        raise quota_exceeded("bytes", settings.quota_bytes)

    # 8. Save row and write to S3
    source_id = uuid.uuid4()
    storage_key = f"user_sources/{user.id}/{source_id}.{ext}"
    await storage.put(storage_key, opus_data, content_type)

    user_source = UserSource(
        id=source_id,
        user_id=user.id,
        storage_key=storage_key,
        duration_ms=info.duration_ms,
        sample_rate=info.sample_rate,
        channels=1,  # canonical: mono
        bytes=len(opus_data),
        display_name=stem or "Untitled Source",
        visibility="unlisted",
        ref_count=0,
    )
    session.add(user_source)
    user.source_count += 1
    user.bytes_used += len(opus_data)
    await session.commit()
    await session.refresh(user_source)

    return _to_out(user_source)



@router.get("/me", response_model=UserSourceListOut,
            dependencies=[Depends(rate_limit("get"))])
async def list_my_user_sources(
    user: CurrentUser,
    session: SessionDep,
) -> UserSourceListOut:
    stmt = select(UserSource).where(UserSource.user_id == user.id).order_by(UserSource.created_at.desc())
    rows = (await session.execute(stmt)).scalars().all()
    await session.commit()
    return UserSourceListOut(items=[_to_out(s) for s in rows])


@router.get("/{id}", dependencies=[Depends(rate_limit("get"))])
async def get_user_source(
    id: uuid.UUID,
    session: SessionDep,
    storage: StorageDep,
    request: Request,
):
    source = await session.get(UserSource, id)
    if source is None:
        raise not_found("user_source")

    # Anonymous user validation (check cookie or header)
    from app.deps import _parse_uuid
    caller_id = _parse_uuid(request.headers.get("x-anon-id"))

    # Visibility / Access checks
    if source.visibility == "flagged":
        return JSONResponse(
            status_code=451,
            content={"error": "flagged", "message": "This source is unavailable due to a moderation action."}
        )

    if source.user_id == caller_id or source.visibility == "shared":
        url = await storage.presigned_get_url(source.storage_key)
        return RedirectResponse(url=url, status_code=302)

    raise forbidden()


@router.patch("/{id}", response_model=UserSourceOut,
              dependencies=[Depends(rate_limit("captures"))])
async def update_user_source(
    id: uuid.UUID,
    body: UserSourceUpdate,
    user: CurrentWriter,
    session: SessionDep,
) -> UserSourceOut:
    source = await session.get(UserSource, id)
    if source is None:
        raise not_found("user_source")
    if source.user_id != user.id:
        raise forbidden()

    if screen_publish(body.display_name, None):
        raise content_rejected("display_name")

    source.display_name = body.display_name
    await session.commit()
    await session.refresh(source)
    return _to_out(source)


@router.delete("/{id}", status_code=204,
               dependencies=[Depends(rate_limit("captures"))])
async def delete_user_source(
    id: uuid.UUID,
    user: CurrentWriter,
    session: SessionDep,
    storage: StorageDep,
) -> None:
    source = await session.get(UserSource, id)
    if source is None:
        raise not_found("user_source")
    if source.user_id != user.id:
        raise forbidden()

    await storage.delete(source.storage_key)
    user.source_count = max(0, user.source_count - 1)
    user.bytes_used = max(0, user.bytes_used - source.bytes)
    await session.delete(source)
    await session.commit()


# Dedicated render-only endpoint
@router.get("/render/{id}", dependencies=[Depends(rate_limit("get"))])
async def get_render_user_source(
    id: uuid.UUID,
    session: SessionDep,
    storage: StorageDep,
):
    """Bypasses caller identity checks, strictly allowing anonymous loads
    of 'shared' sources for preview rendering compatibility."""
    source = await session.get(UserSource, id)
    if source is None:
        raise not_found("user_source")

    if source.visibility == "shared":
        url = await storage.presigned_get_url(source.storage_key)
        return RedirectResponse(url=url, status_code=302)

    raise forbidden()


render_router = APIRouter(prefix="/api/v1/render/user-sources", tags=["user-sources"])


@render_router.get("/{id}", dependencies=[Depends(rate_limit("get"))])
async def get_render_user_source_legacy(
    id: uuid.UUID,
    session: SessionDep,
    storage: StorageDep,
):
    """Legacy/compatibility endpoint matching docs/v1.2-PLAN.md.
    Bypasses caller identity checks, strictly allowing anonymous loads
    of 'shared' sources for preview rendering compatibility."""
    source = await session.get(UserSource, id)
    if source is None:
        raise not_found("user_source")

    if source.visibility == "shared":
        url = await storage.presigned_get_url(source.storage_key)
        return RedirectResponse(url=url, status_code=302)

    raise forbidden()
