"""v6.3 — private, cross-device lesson progress.

Calm-by-design: this surface records a user's own lesson progress so they can
resume and so the next-lesson picker has signal. It is strictly private (no public
route), and like v4.5 Session History it merges across an account's devices via
``Identity.owned_anon_ids``. Effective state and per-track aggregates are derived
in exactly one place (``app/services/progress_state.py``) — never re-implemented
here — so framing can't drift. There is no streak/score/level anywhere.

Anonymous progress is kept client-side (localStorage) and is never written here by
the client; the endpoints still function for an anon writer, but cross-device
persistence and the import flow require an account.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import (
    CurrentWriter,
    Identity,
    SessionDep,
    get_identity,
    rate_limit,
)
from app.errors import not_found, unauthorized
from app.models import Lesson, LessonProgress, Track, User
from app.schemas import (
    LessonProgressListOut,
    LessonProgressOut,
    LessonProgressUpsert,
    ProgressImportIn,
    TrackProgressOut,
)
from app.services.progress_state import (
    append_step_actions,
    best_progress_by_lesson,
    compute_track_progress,
    derive_effective_state,
    more_advanced,
)

router = APIRouter(prefix="/api/v1/lesson-progress", tags=["learn"])


def _require_account(identity: Identity) -> None:
    """Cross-device progress is account-only. Anonymous callers get a 401 the
    client renders as the gentle, once-per-session "sign in to keep your progress"
    nudge — never a nag, never guilt-framed."""
    if identity.account_id is None:
        raise unauthorized()


async def _owned_user_ids(identity: Identity, writer: User) -> list[uuid.UUID]:
    ids = set(identity.owned_anon_ids or [])
    ids.add(writer.id)
    return list(ids)


def _to_out(row: LessonProgress) -> LessonProgressOut:
    return LessonProgressOut(
        lesson_id=row.lesson_id,
        state=derive_effective_state(row.state, row.last_active_at),
        current_step_position=row.current_step_position,
        scroll_ratio=row.scroll_ratio,
        started_at=row.started_at,
        last_active_at=row.last_active_at,
        completed_at=row.completed_at,
        reflection_text=row.reflection_text,
    )


async def _owned_row_for_lesson(
    session: AsyncSession, lesson_id: uuid.UUID, owned: list[uuid.UUID]
) -> LessonProgress | None:
    """The single canonical row for a lesson across the account's devices: the
    most-advanced (then most-recently-active) owned row, if any."""
    if not owned:
        return None
    rows = (
        await session.execute(
            select(LessonProgress).where(
                LessonProgress.user_id.in_(owned),
                LessonProgress.lesson_id == lesson_id,
            )
        )
    ).scalars().all()
    if not rows:
        return None
    return max(
        rows,
        key=lambda r: (
            {"not_started": 0, "in_progress": 1, "completed": 2}.get(r.state, 0),
            r.last_active_at or r.created_at,
        ),
    )


def _serialize_actions(actions, now: datetime) -> list[dict]:
    return [
        {
            "step_position": a.step_position,
            "action": a.action,
            "ms": a.ms,
            "at": (a.at or now).isoformat(),
        }
        for a in actions
    ]


@router.post(
    "", response_model=LessonProgressOut,
    dependencies=[Depends(rate_limit("patches"))],
)
async def upsert_progress(
    body: LessonProgressUpsert,
    writer: CurrentWriter,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> LessonProgressOut:
    lesson = await session.get(Lesson, body.lesson_id)
    if lesson is None or lesson.archived_at is not None:
        raise not_found("lesson")

    now = datetime.now(tz=timezone.utc)
    owned = await _owned_user_ids(identity, writer)
    row = await _owned_row_for_lesson(session, body.lesson_id, owned)
    if row is None:
        row = LessonProgress(
            user_id=writer.id,
            lesson_id=body.lesson_id,
            state="not_started",
            started_at=now,
        )
        session.add(row)

    if row.started_at is None:
        row.started_at = now
    row.last_active_at = now
    if body.current_step_position is not None:
        row.current_step_position = body.current_step_position
    if body.scroll_ratio is not None:
        row.scroll_ratio = body.scroll_ratio
    if body.reflection_text is not None:
        text = body.reflection_text.strip()
        row.reflection_text = text or None

    # State only ever advances; re-reading a completed lesson never un-completes it.
    if body.state == "completed":
        row.state = "completed"
        row.completed_at = row.completed_at or now
    elif row.state == "not_started":
        row.state = "in_progress"

    if body.step_actions:
        row.step_actions = append_step_actions(
            row.step_actions, _serialize_actions(body.step_actions, now)
        )

    await session.commit()
    await session.refresh(row)
    return _to_out(row)


@router.get(
    "", response_model=LessonProgressListOut,
    dependencies=[Depends(rate_limit("get"))],
)
async def list_progress(
    writer: CurrentWriter,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> LessonProgressListOut:
    owned = await _owned_user_ids(identity, writer)
    best = await best_progress_by_lesson(session, owned)
    return LessonProgressListOut(items=[_to_out(r) for r in best.values()])


@router.get(
    "/me/track/{slug}", response_model=TrackProgressOut,
    dependencies=[Depends(rate_limit("get"))],
)
async def track_summary(
    slug: str,
    writer: CurrentWriter,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> TrackProgressOut:
    track = (
        await session.execute(select(Track).where(Track.slug == slug))
    ).scalar_one_or_none()
    if track is None or track.archived_at is not None:
        raise not_found("track")
    owned = await _owned_user_ids(identity, writer)
    return await compute_track_progress(session, owned, track)


@router.post(
    "/import", response_model=LessonProgressListOut,
    dependencies=[Depends(rate_limit("patches"))],
)
async def import_progress(
    body: ProgressImportIn,
    writer: CurrentWriter,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> LessonProgressListOut:
    """Anon→authed one-shot migration of localStorage progress on first sign-in.

    Idempotent max-merge: never downgrades a completed lesson, takes the max step
    position / latest timestamps, concatenates+caps step actions, and keeps an
    existing reflection over an imported one (private text is never concatenated).
    """
    _require_account(identity)
    owned = await _owned_user_ids(identity, writer)

    out: list[LessonProgress] = []
    for item in body.items:
        lesson = await session.get(Lesson, item.lesson_id)
        if lesson is None or lesson.archived_at is not None:
            continue
        row = await _owned_row_for_lesson(session, item.lesson_id, owned)
        if row is None:
            row = LessonProgress(
                user_id=writer.id, lesson_id=item.lesson_id, state="not_started"
            )
            session.add(row)

        row.state = more_advanced(row.state, item.state)
        row.current_step_position = max(
            row.current_step_position or 0, item.current_step_position
        )
        row.scroll_ratio = max(row.scroll_ratio or 0.0, item.scroll_ratio or 0.0)
        row.started_at = _min_dt(row.started_at, item.started_at)
        row.last_active_at = _max_dt(row.last_active_at, item.last_active_at)
        if row.state == "completed":
            row.completed_at = row.completed_at or item.completed_at or _now()
        if not row.reflection_text and item.reflection_text:
            row.reflection_text = item.reflection_text.strip() or None
        if item.step_actions:
            row.step_actions = _merge_sorted_actions(
                row.step_actions, _serialize_actions(item.step_actions, _now())
            )
        out.append(row)

    await session.commit()
    for r in out:
        await session.refresh(r)
    return LessonProgressListOut(items=[_to_out(r) for r in out])


@router.get(
    "/{lesson_id}", response_model=LessonProgressOut,
    dependencies=[Depends(rate_limit("get"))],
)
async def get_progress(
    lesson_id: uuid.UUID,
    writer: CurrentWriter,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> LessonProgressOut:
    owned = await _owned_user_ids(identity, writer)
    row = await _owned_row_for_lesson(session, lesson_id, owned)
    if row is None:
        # A lesson never opened reads as a clean not_started — no row required.
        return LessonProgressOut(
            lesson_id=lesson_id,
            state="not_started",
            current_step_position=0,
            scroll_ratio=0.0,
        )
    return _to_out(row)


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _max_dt(a: datetime | None, b: datetime | None) -> datetime | None:
    a, b = _aware(a), _aware(b)
    if a is None:
        return b
    if b is None:
        return a
    return max(a, b)


def _min_dt(a: datetime | None, b: datetime | None) -> datetime | None:
    a, b = _aware(a), _aware(b)
    if a is None:
        return b
    if b is None:
        return a
    return min(a, b)


def _merge_sorted_actions(existing: list | None, incoming: list[dict]) -> list:
    merged = list(existing or []) + list(incoming)
    merged.sort(key=lambda e: e.get("at") or "")
    from app.services.progress_state import STEP_ACTIONS_CAP

    return merged[-STEP_ACTIONS_CAP:]
