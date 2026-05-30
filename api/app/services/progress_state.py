"""v6.3 — the ONE place lesson-progress state is derived (heuristic-drift rule).

Mirrors the discipline of ``me_sessions.compute_stats``: effective-state
derivation, per-track aggregation, and the anon→authed max-merge all live here so
framing can't drift between the progress endpoints, the curriculum browser, and
the next-lesson picker.

Calm-by-design: aggregates are descriptive counts only — there is no streak, no
score, no percentage-as-pressure. ``reflection_text`` is treated as private and is
never read by the recommendation ranker.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

from sqlalchemy import select

if TYPE_CHECKING:  # pragma: no cover - typing only
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models import LessonProgress, Track

# After this many days of inactivity an in_progress lesson reads as 'abandoned'
# for the picker. It is NEVER written to the DB — the user can always resume.
ABANDON_AFTER_DAYS = 30

# Hard cap on the per-row step-actions log so it can't grow unbounded.
STEP_ACTIONS_CAP = 200

# Difficulty is a 3-value enum; the picker's "within ±1 level" band needs an
# ordinal. This map is the single definition of that ordering.
DIFFICULTY_ORDINAL: dict[str, int] = {"intro": 0, "intermediate": 1, "advanced": 2}

# Rank used to take the more-advanced of two states during cross-device de-dupe
# and the anon→authed import merge. 'abandoned' is derived, never merged.
_STATE_RANK: dict[str, int] = {"not_started": 0, "in_progress": 1, "completed": 2}


def derive_effective_state(
    stored_state: str,
    last_active_at: datetime | None,
    now: datetime | None = None,
) -> str:
    """Overlay the implicit 'abandoned' state on a stored 'in_progress' row.

    'abandoned' is computed only — the stored state stays 'in_progress' so resume
    always works. Any other stored state is returned unchanged.
    """
    if stored_state != "in_progress" or last_active_at is None:
        return stored_state
    now = now or datetime.now(tz=timezone.utc)
    la = last_active_at
    if la.tzinfo is None:
        la = la.replace(tzinfo=timezone.utc)
    if (now - la) > timedelta(days=ABANDON_AFTER_DAYS):
        return "abandoned"
    return "in_progress"


def more_advanced(a: str | None, b: str | None) -> str:
    """Return the more-advanced of two *stored* states (never 'abandoned')."""
    if a is None:
        return b or "not_started"
    if b is None:
        return a
    return a if _STATE_RANK.get(a, 0) >= _STATE_RANK.get(b, 0) else b


def append_step_actions(existing: list | None, deltas: list[dict]) -> list:
    """Append delta actions and truncate to the newest ``STEP_ACTIONS_CAP``."""
    merged = list(existing or [])
    merged.extend(deltas)
    return merged[-STEP_ACTIONS_CAP:]


def difficulty_ordinal(difficulty: str) -> int:
    return DIFFICULTY_ORDINAL.get(difficulty, 0)


async def best_progress_by_lesson(
    session: "AsyncSession", owned_user_ids: list[uuid.UUID]
) -> dict[uuid.UUID, "LessonProgress"]:
    """All of an account's progress rows de-duped to one row per lesson, keeping
    the most-advanced (then most-recently-active) row. This is how cross-device
    rows (one per anon device under the account) collapse to a single view."""
    from app.models import LessonProgress

    if not owned_user_ids:
        return {}
    rows = (
        await session.execute(
            select(LessonProgress).where(LessonProgress.user_id.in_(owned_user_ids))
        )
    ).scalars().all()
    best: dict[uuid.UUID, LessonProgress] = {}
    for r in rows:
        cur = best.get(r.lesson_id)
        if cur is None:
            best[r.lesson_id] = r
            continue
        if _STATE_RANK.get(r.state, 0) > _STATE_RANK.get(cur.state, 0):
            best[r.lesson_id] = r
        elif _STATE_RANK.get(r.state, 0) == _STATE_RANK.get(cur.state, 0):
            if (r.last_active_at or r.created_at) > (cur.last_active_at or cur.created_at):
                best[r.lesson_id] = r
    return best


async def completed_lesson_ids(
    session: "AsyncSession", owned_user_ids: list[uuid.UUID]
) -> set[uuid.UUID]:
    best = await best_progress_by_lesson(session, owned_user_ids)
    return {lid for lid, r in best.items() if r.state == "completed"}


async def compute_track_progress(
    session: "AsyncSession", owned_user_ids: list[uuid.UUID], track: "Track"
):
    """Descriptive per-track aggregate. The single computation site (the calm-by-
    design ``compute_stats`` analog) so counts can't be framed differently across
    surfaces."""
    from app.models import Lesson
    from app.schemas import TrackProgressOut

    lessons = (
        await session.execute(
            select(Lesson).where(
                Lesson.track_id == track.id, Lesson.archived_at.is_(None)
            )
        )
    ).scalars().all()
    # Only count lessons a learner can actually see (hand-authored, or a
    # generated lesson whose generation completed).
    visible_ids = {
        l.id for l in lessons if l.spec is None or l.generation_status == "ready"
    }
    total = len(visible_ids)

    completed = in_progress = 0
    if owned_user_ids and total:
        best = await best_progress_by_lesson(session, owned_user_ids)
        for lid, row in best.items():
            if lid not in visible_ids:
                continue
            eff = derive_effective_state(row.state, row.last_active_at)
            if eff == "completed":
                completed += 1
            elif eff == "in_progress":
                in_progress += 1

    return TrackProgressOut(
        track_slug=track.slug,
        track_title=track.title,
        total_lessons=total,
        completed_lessons=completed,
        in_progress_lessons=in_progress,
    )
