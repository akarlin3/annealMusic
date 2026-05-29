from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.deps import (
    CurrentUser,
    CurrentWriter,
    OptionalUser,
    SessionDep,
    StorageDep,
    rate_limit,
    Identity,
    get_identity,
)
from app.errors import bad_request, file_too_large, forbidden, not_found, quota_exceeded
from app.models import Recording
from app.schemas import RecordingListOut, RecordingMetaOut, RecordingOut
from app.slug import new_slug

router = APIRouter(prefix="/api/v1/recordings", tags=["recordings"])

# Container/extension/content-type per client-declared format. The Opus path
# uploads WebM/Opus (MediaRecorder output); WAV is lossless PCM.
_FORMAT_INFO = {
    "opus": ("webm", "audio/webm"),
    "wav": ("wav", "audio/wav"),
}


@router.post("", response_model=RecordingOut, status_code=201,
             dependencies=[Depends(rate_limit("recordings"))])
async def upload_recording(
    user: CurrentWriter,
    session: SessionDep,
    storage: StorageDep,
    file: UploadFile = File(...),
    format: str = Form(...),
    duration_ms: int = Form(...),
    title: str | None = Form(default=None),
    visibility: str = Form(default="unlisted"),
    patch_id: uuid.UUID | None = Form(default=None),
) -> RecordingOut:
    settings = get_settings()

    if format not in _FORMAT_INFO:
        raise bad_request("format must be 'opus' or 'wav'")
    if visibility not in ("unlisted", "public"):
        raise bad_request("visibility must be 'unlisted' or 'public'")
    if duration_ms <= 0 or duration_ms > settings.max_recording_seconds * 1000:
        raise bad_request("duration out of range")

    if user.recording_count >= settings.quota_recordings:
        raise quota_exceeded("recordings", settings.quota_recordings)

    body = await file.read()
    if len(body) == 0:
        raise bad_request("empty upload")
    if len(body) > settings.max_recording_bytes:
        raise file_too_large()
    if user.bytes_used + len(body) > settings.quota_bytes:
        raise quota_exceeded("bytes", settings.quota_bytes)

    ext, content_type = _FORMAT_INFO[format]
    recording_id = uuid.uuid4()
    storage_key = f"recordings/{user.id}/{recording_id}.{ext}"
    await storage.put(storage_key, body, content_type)

    rec = Recording(
        id=recording_id,
        user_id=user.id,
        short_slug=new_slug(),
        storage_key=storage_key,
        duration_ms=duration_ms,
        bytes=len(body),
        format=format,
        patch_id=patch_id,
        title=(title or None),
        visibility=visibility,
    )
    session.add(rec)
    user.recording_count += 1
    user.bytes_used += len(body)
    await session.commit()
    await session.refresh(rec)
    return RecordingOut.model_validate(rec)


@router.get("/me", response_model=RecordingListOut,
            dependencies=[Depends(rate_limit("get"))])
async def list_my_recordings(
    user: CurrentUser,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> RecordingListOut:
    if identity.account_id is not None:
        stmt = select(Recording).where(Recording.user_id.in_(identity.owned_anon_ids))
    else:
        stmt = select(Recording).where(Recording.user_id == user.id)
    
    stmt = stmt.order_by(Recording.created_at.desc())
    rows = (await session.execute(stmt)).scalars().all()
    await session.commit()

    liked_rec_ids = set()
    from app.models import Like
    likes_stmt = select(Like.target_id).where(Like.user_id == user.id, Like.target_kind == "recording")
    likes_res = await session.execute(likes_stmt)
    liked_rec_ids = set(likes_res.scalars().all())

    items = []
    for r in rows:
        out = RecordingOut.model_validate(r)
        out.liked_by_me = r.id in liked_rec_ids
        items.append(out)

    return RecordingListOut(items=items)


@router.get("/{id_or_slug}/meta", response_model=RecordingMetaOut,
            dependencies=[Depends(rate_limit("get"))])
async def get_recording_meta(
    id_or_slug: str,
    user: OptionalUser,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> RecordingMetaOut:
    """Metadata for the `/r/<slug>` player. Public recordings are visible to
    anyone; private recordings only to their owner."""
    from app.models import User, Account
    from sqlalchemy import or_
    try:
        rid = uuid.UUID(id_or_slug)
        cond = or_(Recording.short_slug == id_or_slug, Recording.id == rid)
    except ValueError:
        cond = Recording.short_slug == id_or_slug

    stmt = (
        select(Recording, Account.display_name, Account.avatar_seed, Account.id)
        .outerjoin(User, User.id == Recording.user_id)
        .outerjoin(Account, Account.id == User.account_id)
        .where(cond)
    )
    res = await session.execute(stmt)
    row = res.one_or_none()

    if row is None:
        raise not_found("recording")

    rec, display_name, avatar_seed, account_id = row

    if rec.visibility != "public" and (user is None or rec.user_id != user.id):
        raise not_found("recording")

    # Block filtering
    from app.deps import get_blocked_user_ids
    blocked_user_ids = await get_blocked_user_ids(session, identity.account_id)
    if rec.user_id in blocked_user_ids:
        raise not_found("recording")

    liked_by_me = False
    if user:
        from app.models import Like
        like_stmt = select(Like).where(Like.user_id == user.id, Like.target_kind == "recording", Like.target_id == rec.id)
        like_res = await session.execute(like_stmt)
        liked_by_me = like_res.scalar_one_or_none() is not None

    return RecordingMetaOut(
        id=rec.id,
        short_slug=rec.short_slug,
        duration_ms=rec.duration_ms,
        format=rec.format,
        title=rec.title,
        patch_id=rec.patch_id,
        created_at=rec.created_at,
        creator_name=display_name,
        creator_avatar_seed=avatar_seed,
        creator_id=account_id,
        like_count=rec.like_count,
        liked_by_me=liked_by_me,
    )


@router.get("/{id_or_slug}", dependencies=[Depends(rate_limit("get"))])
async def get_recording(
    id_or_slug: str,
    user: OptionalUser,
    session: SessionDep,
    storage: StorageDep,
    identity: Identity = Depends(get_identity),
):
    rec = await _resolve(session, id_or_slug)
    if rec is None:
        raise not_found("recording")
    if rec.visibility != "public" and (user is None or rec.user_id != user.id):
        raise not_found("recording")

    # Block filtering
    from app.deps import get_blocked_user_ids
    blocked_user_ids = await get_blocked_user_ids(session, identity.account_id)
    if rec.user_id in blocked_user_ids:
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


async def _resolve(session: AsyncSession, id_or_slug: str) -> Recording | None:
    try:
        rid = uuid.UUID(id_or_slug)
        rec = await session.get(Recording, rid)
        if rec is not None:
            return rec
    except ValueError:
        pass
    return (
        await session.execute(
            select(Recording).where(Recording.short_slug == id_or_slug)
        )
    ).scalar_one_or_none()
