"""v6.5 lesson analytics — aggregate, anonymized rollups for the admin surface.

Privacy: every function here aggregates (counts / averages) before returning.
No ``user_id`` or other per-user identifier ever crosses a return boundary —
analytics are aggregate-only by construction (see ``docs/PRIVACY.md``).

Portability: the queries run on SQLite (dev/test) and Postgres (prod). The hot
rollup also exists as a Postgres ``MATERIALIZED VIEW`` (migration
``0024_v6_5_lesson_analytics``) for production performance / external BI, but the
endpoints compute live here so there is a single, tested code path. The pure
``compute_*`` helpers take plain dicts so they unit-test without a DB.

``step_actions`` entries are ``{step_position, action, ms}``. The v6.3 client
emits navigation actions ``'started'`` / ``'completed'`` (and ``'skipped'``);
v6.5 additively emits ``'clip_play'`` / ``'clip_replay'`` (audio-clip steps) and
``'prompt_tried'`` / ``'prompt_skipped'`` (prompt steps). Metrics for
not-yet-emitted actions degrade to a truthful 0.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from statistics import median

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Lesson, LessonProgress, LessonStep, Track
from app.services.progress_state import derive_effective_state

# Audio-clip step type has appeared as both spellings across the curriculum.
CLIP_STEP_TYPES = {"audio-clip", "audio_clip"}
# Navigation actions that mark a step as reached and carry time-on-step (`ms`).
NAV_ACTIONS = {"started", "completed", "skipped"}
# Discard time-on-step gaps longer than this as walk-aways (calm-by-design:
# pausing is fine, it is not an engagement signal).
MAX_STEP_MS = 30 * 60 * 1000


# --------------------------------------------------------------------------- #
# Pure helpers (no DB) — directly unit-testable.
# --------------------------------------------------------------------------- #
def _reached_positions(step_actions: list[dict]) -> set[int]:
    """Step positions the learner reached (any action referencing them)."""
    return {
        a["step_position"]
        for a in step_actions
        if isinstance(a.get("step_position"), int)
    }


def _max_reached(step_actions: list[dict]) -> int:
    reached = _reached_positions(step_actions)
    return max(reached) if reached else -1


def compute_dropoff(actions_per_progress: list[list[dict]], total_steps: int) -> list[float]:
    """Fraction of starts that *reached* each step index, normalized to step 0.

    ``reached[i]`` counts progress rows whose furthest reached step is >= i. The
    curve starts at 1.0 and is non-increasing; the steepest drop is the abandon
    cliff.
    """
    if total_steps <= 0:
        return []
    reached = [0] * total_steps
    for actions in actions_per_progress:
        furthest = _max_reached(actions)
        for i in range(total_steps):
            if i <= furthest:
                reached[i] += 1
    base = reached[0] or 0
    if base == 0:
        return [0.0] * total_steps
    return [round(r / base, 4) for r in reached]


def compute_step_times(actions_per_progress: list[list[dict]], total_steps: int) -> list[dict]:
    """Per-step time-on-step distribution (mean / median / p90) in ms, from the
    ``ms`` carried on navigation actions."""
    buckets: dict[int, list[int]] = {}
    for actions in actions_per_progress:
        for a in actions:
            if a.get("action") not in NAV_ACTIONS:
                continue
            pos = a.get("step_position")
            ms = a.get("ms")
            if not isinstance(pos, int) or not isinstance(ms, (int, float)) or isinstance(ms, bool):
                continue
            if 0 < ms <= MAX_STEP_MS:
                buckets.setdefault(pos, []).append(int(ms))
    out: list[dict] = []
    for pos in range(total_steps):
        vals = sorted(buckets.get(pos, []))
        if not vals:
            out.append({"step_position": pos, "count": 0, "mean_ms": 0, "median_ms": 0, "p90_ms": 0})
            continue
        idx = min(len(vals) - 1, int(0.9 * (len(vals) - 1)))
        out.append(
            {
                "step_position": pos,
                "count": len(vals),
                "mean_ms": round(sum(vals) / len(vals)),
                "median_ms": round(median(vals)),
                "p90_ms": vals[idx],
            }
        )
    return out


def compute_prompt_stats(actions_per_progress: list[list[dict]], prompt_positions: set[int]) -> dict:
    """'I tried it' vs skip for prompt steps, from the additively-emitted
    ``prompt_tried`` / ``prompt_skipped`` actions."""
    tried = 0
    skipped = 0
    per_step: dict[int, dict[str, int]] = {}
    for actions in actions_per_progress:
        for a in actions:
            act = a.get("action")
            pos = a.get("step_position")
            if act == "prompt_tried":
                tried += 1
                per_step.setdefault(pos, {"tried": 0, "skipped": 0})["tried"] += 1
            elif act == "prompt_skipped":
                skipped += 1
                per_step.setdefault(pos, {"tried": 0, "skipped": 0})["skipped"] += 1
    total = tried + skipped
    return {
        "prompt_steps": sorted(int(p) for p in prompt_positions),
        "tried": tried,
        "skipped": skipped,
        "tried_ratio": round(tried / total, 4) if total else 0.0,
        "per_step": [
            {"step_position": p, **per_step[p]}
            for p in sorted(per_step, key=lambda x: (x is None, x))
        ],
    }


def accumulate_clip_actions(
    progress_rows: list[tuple],
    clip_by_lesson_pos: dict[tuple, str],
    stats: dict[str, dict[str, int]],
) -> None:
    """Fold ``(lesson_id, step_actions)`` rows into per-clip counters.

    *Exposure* = a learner reached the audio-clip step (deduped per progress
    row). ``clip_play`` / ``clip_replay`` are the explicit (v6.5) play / replay
    signals.
    """
    for lesson_id, step_actions in progress_rows:
        exposed: set[str] = set()
        for a in step_actions or []:
            pos = a.get("step_position")
            slug = clip_by_lesson_pos.get((lesson_id, pos))
            if not slug:
                continue
            s = stats.setdefault(slug, {"exposures": 0, "plays": 0, "replays": 0})
            act = a.get("action")
            if act in NAV_ACTIONS:
                exposed.add(slug)
            elif act == "clip_play":
                s["plays"] += 1
            elif act == "clip_replay":
                s["replays"] += 1
        for slug in exposed:
            stats[slug]["exposures"] += 1


def _finalize_clip(slug: str, s: dict[str, int]) -> dict:
    exposures = s["exposures"]
    skips = max(exposures - s["plays"], 0)
    return {
        "clip_slug": slug,
        "exposures": exposures,
        "plays": s["plays"],
        "replays": s["replays"],
        "skips": skips,
        "skip_rate": round(skips / exposures, 4) if exposures else 0.0,
    }


def _ms_between(start: datetime | None, end: datetime | None) -> int | None:
    if start is None or end is None:
        return None
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return int((end - start).total_seconds() * 1000)


def _new_acc() -> dict:
    return {"views": 0, "completions": 0, "abandonments": 0, "reflections": 0, "_durations": []}


def _finalize_rollup(lesson_id, acc: dict) -> dict:
    views = acc["views"]
    durations = acc["_durations"]
    return {
        "lesson_id": str(lesson_id),
        "views": views,
        "completions": acc["completions"],
        "completion_rate": round(acc["completions"] / views, 4) if views else 0.0,
        "avg_completion_ms": round(sum(durations) / len(durations)) if durations else 0,
        "abandonments": acc["abandonments"],
        "reflections": acc["reflections"],
        "reflection_rate": round(acc["reflections"] / views, 4) if views else 0.0,
    }


def _fold_progress(acc: dict, state, started, completed, last_active, refl, now) -> None:
    acc["views"] += 1
    if state == "completed":
        acc["completions"] += 1
        ms = _ms_between(started, completed)
        if ms is not None and ms >= 0:
            acc["_durations"].append(ms)
    if derive_effective_state(state, last_active, now) == "abandoned":
        acc["abandonments"] += 1
    if refl and str(refl).strip():
        acc["reflections"] += 1


# --------------------------------------------------------------------------- #
# DB-backed queries.
# --------------------------------------------------------------------------- #
async def lesson_rollups(session: AsyncSession) -> list[dict]:
    """Per-lesson rollup for every lesson that has progress, plus lesson labels."""
    now = datetime.now(timezone.utc)
    rows = (
        await session.execute(
            select(
                LessonProgress.lesson_id,
                LessonProgress.state,
                LessonProgress.started_at,
                LessonProgress.completed_at,
                LessonProgress.last_active_at,
                LessonProgress.reflection_text,
            )
        )
    ).all()
    accs: dict[uuid.UUID, dict] = {}
    for lid, state, started, completed, last_active, refl in rows:
        _fold_progress(accs.setdefault(lid, _new_acc()), state, started, completed, last_active, refl, now)

    labels = {
        lid: (slug, title, str(track_id))
        for lid, slug, title, track_id in (
            await session.execute(select(Lesson.id, Lesson.slug, Lesson.title, Lesson.track_id))
        ).all()
    }
    out: list[dict] = []
    for lid, acc in accs.items():
        roll = _finalize_rollup(lid, acc)
        slug, title, track_id = labels.get(lid, (None, None, None))
        roll.update({"slug": slug, "title": title, "track_id": track_id})
        out.append(roll)
    out.sort(key=lambda r: r["views"], reverse=True)
    return out


async def lesson_detail(session: AsyncSession, lesson_id: uuid.UUID) -> dict | None:
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        return None
    steps = (
        await session.execute(
            select(LessonStep.position, LessonStep.type, LessonStep.config)
            .where(LessonStep.lesson_id == lesson_id)
            .order_by(LessonStep.position)
        )
    ).all()
    total_steps = len(steps)
    prompt_positions = {pos for pos, typ, _cfg in steps if typ == "prompt"}
    clip_by_lesson_pos = {
        (lesson_id, pos): _clip_ref(cfg)
        for pos, typ, cfg in steps
        if typ in CLIP_STEP_TYPES and _clip_ref(cfg)
    }

    prog = (
        await session.execute(
            select(
                LessonProgress.state,
                LessonProgress.started_at,
                LessonProgress.completed_at,
                LessonProgress.last_active_at,
                LessonProgress.reflection_text,
                LessonProgress.step_actions,
            ).where(LessonProgress.lesson_id == lesson_id)
        )
    ).all()

    now = datetime.now(timezone.utc)
    acc = _new_acc()
    actions_per_progress: list[list[dict]] = []
    clip_progress_rows: list[tuple] = []
    for state, started, completed, last_active, refl, actions in prog:
        _fold_progress(acc, state, started, completed, last_active, refl, now)
        actions = actions or []
        actions_per_progress.append(actions)
        clip_progress_rows.append((lesson_id, actions))

    clip_stats: dict[str, dict[str, int]] = {}
    accumulate_clip_actions(clip_progress_rows, clip_by_lesson_pos, clip_stats)

    rollup = _finalize_rollup(lesson_id, acc)
    rollup.update({"slug": lesson.slug, "title": lesson.title, "track_id": str(lesson.track_id)})
    return {
        "rollup": rollup,
        "total_steps": total_steps,
        "dropoff": compute_dropoff(actions_per_progress, total_steps),
        "step_times": compute_step_times(actions_per_progress, total_steps),
        "prompt_stats": compute_prompt_stats(actions_per_progress, prompt_positions),
        "clip_stats": [_finalize_clip(s, clip_stats[s]) for s in sorted(clip_stats)],
    }


def _clip_ref(config: dict | None) -> str | None:
    """The clip the audio-clip step references. The curriculum uses ``clip_id``
    (a clip slug); accept ``clip_slug`` as a fallback."""
    cfg = config or {}
    return cfg.get("clip_id") or cfg.get("clip_slug")


async def track_rollups(session: AsyncSession) -> list[dict]:
    """Per-track aggregate completion + observed path popularity."""
    tracks = (
        await session.execute(
            select(Track).where(Track.archived_at.is_(None)).order_by(Track.position)
        )
    ).scalars().all()
    lessons = (
        await session.execute(
            select(Lesson.id, Lesson.track_id, Lesson.slug, Lesson.prerequisites)
        )
    ).all()
    track_of: dict[uuid.UUID, uuid.UUID] = {}
    slug_of: dict[uuid.UUID, str] = {}
    prereqs_of: dict[uuid.UUID, set] = {}
    lessons_in_track: dict[uuid.UUID, set] = {}
    for lid, track_id, slug, prereqs in lessons:
        track_of[lid] = track_id
        slug_of[lid] = slug
        prereqs_of[lid] = set(prereqs or [])
        lessons_in_track.setdefault(track_id, set()).add(lid)

    prog = (
        await session.execute(
            select(
                LessonProgress.user_id,
                LessonProgress.lesson_id,
                LessonProgress.state,
                LessonProgress.started_at,
            )
        )
    ).all()

    completed_by_track: dict[uuid.UUID, int] = {}
    started_by_track: dict[uuid.UUID, int] = {}
    seqs: dict[tuple, list] = {}
    for user_id, lid, state, started in prog:
        track_id = track_of.get(lid)
        if track_id is None:
            continue
        started_by_track[track_id] = started_by_track.get(track_id, 0) + 1
        if state == "completed":
            completed_by_track[track_id] = completed_by_track.get(track_id, 0) + 1
        seqs.setdefault((user_id, track_id), []).append((started, lid))

    transitions: dict[uuid.UUID, dict[tuple, int]] = {}
    for (_user_id, track_id), items in seqs.items():
        ordered = [lid for _started, lid in sorted(items, key=lambda x: (x[0] is None, x[0]))]
        bucket = transitions.setdefault(track_id, {})
        for frm, to in zip(ordered, ordered[1:]):
            bucket[(frm, to)] = bucket.get((frm, to), 0) + 1

    out: list[dict] = []
    for track in tracks:
        starts = started_by_track.get(track.id, 0)
        comps = completed_by_track.get(track.id, 0)
        paths = [
            {
                "from": slug_of.get(frm),
                "to": slug_of.get(to),
                "count": count,
                "on_graph": frm in prereqs_of.get(to, set()),
            }
            for (frm, to), count in sorted(
                transitions.get(track.id, {}).items(), key=lambda kv: kv[1], reverse=True
            )
        ]
        out.append(
            {
                "track_id": str(track.id),
                "slug": track.slug,
                "title": track.title,
                "lessons": len(lessons_in_track.get(track.id, set())),
                "starts": starts,
                "completions": comps,
                "completion_rate": round(comps / starts, 4) if starts else 0.0,
                "top_paths": paths[:20],
                "off_graph_paths": [p for p in paths if not p["on_graph"]][:20],
            }
        )
    return out


async def clip_rollups(session: AsyncSession) -> list[dict]:
    """Per-clip play / replay / skip / exposure counts across all lessons."""
    steps = (
        await session.execute(
            select(LessonStep.lesson_id, LessonStep.position, LessonStep.type, LessonStep.config)
        )
    ).all()
    clip_by_lesson_pos: dict[tuple, str] = {}
    lesson_ids_with_clips: set = set()
    for lesson_id, pos, typ, cfg in steps:
        ref = _clip_ref(cfg)
        if typ in CLIP_STEP_TYPES and ref:
            clip_by_lesson_pos[(lesson_id, pos)] = ref
            lesson_ids_with_clips.add(lesson_id)
    if not clip_by_lesson_pos:
        return []

    prog = (
        await session.execute(
            select(LessonProgress.lesson_id, LessonProgress.step_actions).where(
                LessonProgress.lesson_id.in_(lesson_ids_with_clips)
            )
        )
    ).all()
    stats: dict[str, dict[str, int]] = {}
    accumulate_clip_actions(prog, clip_by_lesson_pos, stats)
    return [_finalize_clip(s, stats[s]) for s in sorted(stats)]


async def refresh_materialized_view(session: AsyncSession) -> bool:
    """Refresh the Postgres rollup view. No-op (returns False) on SQLite."""
    try:
        bind = session.get_bind()
        dialect = bind.dialect.name if bind is not None else ""
    except Exception:
        dialect = ""
    if dialect != "postgresql":
        return False
    from sqlalchemy import text

    try:
        await session.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY lesson_analytics"))
    except Exception:
        await session.execute(text("REFRESH MATERIALIZED VIEW lesson_analytics"))
    await session.commit()
    return True
