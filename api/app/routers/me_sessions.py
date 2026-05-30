"""v4.5 — private per-user Session History.

Calm-by-design: this surface records a user's own practice so they can revisit
it. It is strictly private (no public route), requires a signed-in account, and
stores only timestamp / source / actual-duration / optional reflection. No
streaks, no points, no engagement signals — ``compute_stats`` is the single
place stats are derived and it deliberately omits any nudge-able field.
"""
from __future__ import annotations

import base64
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func

from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import (
    CurrentWriter,
    SessionDep,
    rate_limit,
    Identity,
    get_identity,
)
from app.errors import not_found, unauthorized
from app.models import SessionPlay, ListeningSession, User
from app.schemas import (
    SessionPlayCreate,
    SessionPlayUpdate,
    SessionPlayOut,
    SessionPlayListOut,
    SessionStatsOut,
)

router = APIRouter(prefix="/api/v1/me/sessions", tags=["history"])


def _require_account(identity: Identity) -> None:
    """History is account-only. Anonymous callers get a 401 the client renders
    as the gentle "sign in to keep your history" nudge — never a logged row."""
    if identity.account_id is None:
        raise unauthorized()


def _encode_cursor(dt: datetime) -> str:
    return base64.urlsafe_b64encode(dt.isoformat().encode()).decode()


def _decode_cursor(cursor: str) -> datetime | None:
    try:
        return datetime.fromisoformat(
            base64.urlsafe_b64decode(cursor.encode()).decode()
        )
    except (ValueError, TypeError):
        return None


async def _owned_user_ids(identity: Identity, writer: User) -> list[uuid.UUID]:
    ids = set(identity.owned_anon_ids or [])
    ids.add(writer.id)
    return list(ids)


async def _to_out(session: AsyncSession, play: SessionPlay) -> SessionPlayOut:
    ls = await session.get(ListeningSession, play.listening_session_id)
    return SessionPlayOut(
        id=play.id,
        listening_session_id=play.listening_session_id,
        started_at=play.started_at,
        completed_at=play.completed_at,
        duration_listened_ms=play.duration_listened_ms,
        reflection=play.reflection,
        created_at=play.created_at,
        session_title=ls.title if ls else None,
        session_slug=ls.short_slug if ls else None,
        session_length_category=ls.length_category if ls else None,
    )


@router.post(
    "", response_model=SessionPlayOut, status_code=201,
    dependencies=[Depends(rate_limit("patches"))],
)
async def log_play(
    body: SessionPlayCreate,
    writer: CurrentWriter,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> SessionPlayOut:
    _require_account(identity)

    ls = await session.get(ListeningSession, body.listening_session_id)
    if ls is None or ls.visibility == "flagged":
        raise not_found("listening_session")

    play = SessionPlay(
        user_id=writer.id,
        listening_session_id=body.listening_session_id,
        started_at=body.started_at or datetime.now(tz=timezone.utc),
        duration_listened_ms=0,
    )
    session.add(play)
    await session.commit()
    await session.refresh(play)
    return await _to_out(session, play)


async def _get_owned_play(
    session: AsyncSession, play_id: uuid.UUID, owned: list[uuid.UUID]
) -> SessionPlay:
    play = await session.get(SessionPlay, play_id)
    if play is None or play.user_id not in owned:
        raise not_found("session_play")
    return play


@router.patch(
    "/{play_id}", response_model=SessionPlayOut,
    dependencies=[Depends(rate_limit("patches"))],
)
async def update_play(
    play_id: uuid.UUID,
    body: SessionPlayUpdate,
    writer: CurrentWriter,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> SessionPlayOut:
    _require_account(identity)
    owned = await _owned_user_ids(identity, writer)
    play = await _get_owned_play(session, play_id, owned)

    if body.completed_at is not None:
        play.completed_at = body.completed_at
    if body.duration_listened_ms is not None:
        play.duration_listened_ms = body.duration_listened_ms
    if "reflection" in body.model_fields_set:
        text = (body.reflection or "").strip()
        play.reflection = text or None

    await session.commit()
    await session.refresh(play)
    return await _to_out(session, play)


@router.get(
    "/stats", response_model=SessionStatsOut,
    dependencies=[Depends(rate_limit("get"))],
)
async def get_stats(
    writer: CurrentWriter,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> SessionStatsOut:
    _require_account(identity)
    owned = await _owned_user_ids(identity, writer)
    return await compute_stats(session, owned)


@router.get(
    "", response_model=SessionPlayListOut,
    dependencies=[Depends(rate_limit("get"))],
)
async def list_plays(
    writer: CurrentWriter,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> SessionPlayListOut:
    _require_account(identity)
    owned = await _owned_user_ids(identity, writer)

    stmt = select(SessionPlay).where(SessionPlay.user_id.in_(owned))
    if cursor:
        before = _decode_cursor(cursor)
        if before is not None:
            stmt = stmt.where(SessionPlay.started_at < before)
    stmt = stmt.order_by(SessionPlay.started_at.desc()).limit(limit + 1)
    rows = (await session.execute(stmt)).scalars().all()

    next_cursor = None
    if len(rows) > limit:
        rows = rows[:limit]
        next_cursor = _encode_cursor(rows[-1].started_at)

    items = [await _to_out(session, p) for p in rows]
    return SessionPlayListOut(items=items, next_cursor=next_cursor)


@router.delete(
    "/{play_id}", status_code=204,
    dependencies=[Depends(rate_limit("patches"))],
)
async def forget_play(
    play_id: uuid.UUID,
    writer: CurrentWriter,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> None:
    _require_account(identity)
    owned = await _owned_user_ids(identity, writer)
    play = await _get_owned_play(session, play_id, owned)
    await session.delete(play)
    await session.commit()


async def compute_stats(
    session: AsyncSession, owned: list[uuid.UUID]
) -> SessionStatsOut:
    """The ONE place practice stats are computed (heuristic-drift rule).

    Deliberately descriptive, not motivational: total sessions, total time,
    average length, and a this-month rollup. No streak, no rank, no goal — those
    fields are intentionally absent so the product can't grow an engagement loop
    around this surface.
    """
    if not owned:
        return SessionStatsOut(
            total_sessions=0,
            total_listened_ms=0,
            average_length_ms=0,
            this_month_sessions=0,
            this_month_listened_ms=0,
        )

    base = select(
        func.count(SessionPlay.id),
        func.coalesce(func.sum(SessionPlay.duration_listened_ms), 0),
    ).where(SessionPlay.user_id.in_(owned))
    total_count, total_ms = (await session.execute(base)).one()
    total_count = int(total_count or 0)
    total_ms = int(total_ms or 0)
    average_ms = total_ms // total_count if total_count else 0

    now = datetime.now(tz=timezone.utc)
    month_start = now.replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    month_stmt = base.where(SessionPlay.started_at >= month_start)
    month_count, month_ms = (await session.execute(month_stmt)).one()

    return SessionStatsOut(
        total_sessions=total_count,
        total_listened_ms=total_ms,
        average_length_ms=average_ms,
        this_month_sessions=int(month_count or 0),
        this_month_listened_ms=int(month_ms or 0),
    )
