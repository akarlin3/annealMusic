"""v6.5 admin lesson-analytics endpoints (x-admin-key gated).

Aggregate-only and admin-only. No per-user data is ever returned — see
``app/services/analytics.py`` and ``docs/PRIVACY.md``. The hot rollup is also a
Postgres materialized view (migration ``0024``) refreshed nightly + via
``POST /refresh``; the read endpoints compute live so there is one tested path.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import require_admin
from app.errors import not_found
from app.services import analytics

router = APIRouter(
    prefix="/api/v1/admin/analytics",
    tags=["lesson-analytics-admin"],
    dependencies=[Depends(require_admin)],
)


@router.get("/lessons")
async def get_lesson_analytics(session: AsyncSession = Depends(get_session)) -> dict:
    return {"items": await analytics.lesson_rollups(session)}


@router.get("/lessons/{lesson_id}")
async def get_lesson_detail(
    lesson_id: str, session: AsyncSession = Depends(get_session)
) -> dict:
    try:
        lid = uuid.UUID(lesson_id)
    except ValueError as exc:
        raise not_found("lesson") from exc
    detail = await analytics.lesson_detail(session, lid)
    if detail is None:
        raise not_found("lesson")
    return detail


@router.get("/tracks")
async def get_track_analytics(session: AsyncSession = Depends(get_session)) -> dict:
    return {"items": await analytics.track_rollups(session)}


@router.get("/clips")
async def get_clip_analytics(session: AsyncSession = Depends(get_session)) -> dict:
    return {"items": await analytics.clip_rollups(session)}


@router.post("/refresh")
async def refresh_analytics(session: AsyncSession = Depends(get_session)) -> dict:
    refreshed = await analytics.refresh_materialized_view(session)
    return {
        "refreshed": refreshed,
        "refreshed_at": datetime.now(timezone.utc).isoformat(),
    }
