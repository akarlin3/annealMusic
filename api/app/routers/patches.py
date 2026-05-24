from __future__ import annotations

import base64
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.deps import CurrentUser, CurrentWriter, SessionDep, rate_limit
from app.errors import forbidden, invalid_state, not_found, quota_exceeded
from app.models import Capture, Patch
from app.schemas import (
    PatchCreate,
    PatchListOut,
    PatchOut,
    PatchUpdate,
)
from app.slug import new_slug
from app.validation import validate_payload

router = APIRouter(prefix="/api/v1/patches", tags=["patches"])


def to_out(patch: Patch) -> PatchOut:
    state = patch.state or {}
    return PatchOut(
        id=patch.id,
        schema_ver=patch.schema_ver,
        state=state.get("payload", ""),
        title=patch.title,
        description=patch.description,
        visibility=patch.visibility,  # type: ignore[arg-type]
        capture_refs=patch.capture_refs,
        short_slug=patch.short_slug,
        created_at=patch.created_at,
        updated_at=patch.updated_at,
    )


async def _insert_with_slug(session: AsyncSession, patch: Patch) -> Patch:
    # 62^8 ≈ 2e14 keyspace over an 8-char slug — collision is negligible, so a
    # single allocation + flush is sufficient (the UNIQUE index is the backstop).
    patch.short_slug = new_slug()
    session.add(patch)
    await session.flush()
    return patch


@router.post(
    "", response_model=PatchOut, status_code=201,
    dependencies=[Depends(rate_limit("patches"))],
)
async def create_patch(
    body: PatchCreate, user: CurrentWriter, session: SessionDep
) -> PatchOut:
    errors = validate_payload(body.state, body.schema_ver)
    if errors:
        raise invalid_state(errors)

    settings = get_settings()
    if user.patch_count >= settings.quota_patches:
        raise quota_exceeded("patches", settings.quota_patches)

    # Bind capture refs the user actually owns; bump their ref counts.
    refs: list[uuid.UUID] = []
    if body.capture_refs:
        owned = (
            await session.execute(
                select(Capture).where(
                    Capture.id.in_(body.capture_refs),
                    Capture.user_id == user.id,
                )
            )
        ).scalars().all()
        owned_ids = {c.id for c in owned}
        missing = [r for r in body.capture_refs if r not in owned_ids]
        if missing:
            raise not_found("capture")
        refs = list(owned_ids)
        for cap in owned:
            cap.ref_count += 1

    patch = Patch(
        user_id=user.id,
        schema_ver=body.schema_ver,
        state={"v": body.schema_ver, "payload": body.state},
        title=body.title,
        description=body.description,
        visibility=body.visibility,
        capture_refs=refs,
    )
    await _insert_with_slug(session, patch)
    user.patch_count += 1
    await session.commit()
    await session.refresh(patch)
    return to_out(patch)


@router.get("/me", response_model=PatchListOut,
            dependencies=[Depends(rate_limit("get"))])
async def list_my_patches(
    user: CurrentUser,
    session: SessionDep,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> PatchListOut:
    stmt = select(Patch).where(Patch.user_id == user.id)
    if cursor:
        before = _decode_cursor(cursor)
        if before is not None:
            stmt = stmt.where(Patch.created_at < before)
    stmt = stmt.order_by(Patch.created_at.desc()).limit(limit + 1)
    rows = (await session.execute(stmt)).scalars().all()
    await session.commit()

    next_cursor = None
    if len(rows) > limit:
        rows = rows[:limit]
        next_cursor = _encode_cursor(rows[-1].created_at)
    return PatchListOut(items=[to_out(p) for p in rows], next_cursor=next_cursor)


@router.get("/{id_or_slug}", response_model=PatchOut,
            dependencies=[Depends(rate_limit("get"))])
async def get_patch(id_or_slug: str, session: SessionDep) -> PatchOut:
    # Link-only read: no user minted. Both 'unlisted' and 'public' are readable
    # by anyone holding the slug/id in v0.7; the gallery (v0.8) adds the listing
    # surface that makes 'public' meaningfully different.
    patch = await _resolve(session, id_or_slug)
    if patch is None:
        raise not_found("patch")
    return to_out(patch)


@router.patch("/{id}", response_model=PatchOut,
              dependencies=[Depends(rate_limit("patches"))])
async def update_patch(
    id: uuid.UUID, body: PatchUpdate, user: CurrentWriter, session: SessionDep
) -> PatchOut:
    patch = await session.get(Patch, id)
    if patch is None:
        raise not_found("patch")
    if patch.user_id != user.id:
        raise forbidden()
    if body.title is not None:
        patch.title = body.title
    if body.description is not None:
        patch.description = body.description
    if body.visibility is not None:
        patch.visibility = body.visibility
    await session.commit()
    await session.refresh(patch)
    return to_out(patch)


@router.delete("/{id}", status_code=204,
               dependencies=[Depends(rate_limit("patches"))])
async def delete_patch(
    id: uuid.UUID, user: CurrentWriter, session: SessionDep
) -> None:
    patch = await session.get(Patch, id)
    if patch is None:
        raise not_found("patch")
    if patch.user_id != user.id:
        raise forbidden()
    # Dereference captures (real deletion; orphans swept on schedule).
    if patch.capture_refs:
        await session.execute(
            update(Capture)
            .where(Capture.id.in_(patch.capture_refs))
            .values(ref_count=Capture.ref_count - 1)
        )
    await session.delete(patch)
    user.patch_count = max(0, user.patch_count - 1)
    await session.commit()


async def _resolve(session: AsyncSession, id_or_slug: str) -> Patch | None:
    try:
        pid = uuid.UUID(id_or_slug)
        patch = await session.get(Patch, pid)
        if patch is not None:
            return patch
    except ValueError:
        pass
    return (
        await session.execute(select(Patch).where(Patch.short_slug == id_or_slug))
    ).scalar_one_or_none()


def _encode_cursor(dt: datetime) -> str:
    return base64.urlsafe_b64encode(dt.isoformat().encode()).decode()


def _decode_cursor(cursor: str) -> datetime | None:
    try:
        return datetime.fromisoformat(
            base64.urlsafe_b64decode(cursor.encode()).decode()
        )
    except (ValueError, TypeError):
        return None
