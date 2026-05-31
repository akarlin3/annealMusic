"""v6.3 — next-lesson recommendation ranker.

Three stages (see docs/v6.3-PLAN.md §5):

  Stage 1  deterministic candidate filtering (prereqs satisfied, ±1 difficulty,
           track scope, not-already-completed) — pure Python, no LLM.
  Stage 2  Haiku ranking of the filtered candidates into an ordered 1–3 with a
           one-sentence rationale each; output is validated against the candidate
           set (hallucinated ids are dropped) and falls back to the deterministic
           order if the model is unavailable or returns invalid JSON.
  Stage 3  the caller (the recommendations router) returns the cards.

Calm-by-design: the picker is an *offer*, never a funnel. There is no streak,
score, or urgency anywhere in the prompt or the output. ``reflection_text`` is
private and is NEVER read here — only step-action metadata becomes a signal.

Caching: a 5-minute per-process TTL cache keyed on a hash of the compact progress
state means identical state within the window returns the same recommendations
without an LLM call.
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import select

from app.schemas import RecommendationItem, RecommendationsOut
from app.services.progress_state import (
    best_progress_by_lesson,
    derive_effective_state,
    difficulty_ordinal,
)

if TYPE_CHECKING:  # pragma: no cover - typing only
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models import Lesson, Track

logger = logging.getLogger("learn.recommend")

RANKER_MODEL = "claude-haiku-4-5"
CACHE_TTL_SECONDS = 300
MAX_CANDIDATES = 8
MAX_RECOMMENDATIONS = 3

# Optional adjacency: tracks that pedagogically reinforce one another. Unknown
# tracks simply have no related set (Stage 1 then falls back to cross-track when
# same-track candidates are scarce), so this can stay a light, additive hint.
RELATED_TRACKS: dict[str, list[str]] = {
    "synthesis-fundamentals": ["composition-technique", "sound-design"],
    "composition-technique": ["synthesis-fundamentals", "ambient-history"],
    "ambient-history": ["composition-technique", "listening"],
    "listening": ["ambient-history"],
    "sound-design": ["synthesis-fundamentals"],
}


def _lesson_visible(lesson: "Lesson") -> bool:
    return lesson.spec is None or lesson.generation_status == "ready"


async def _load_curriculum(session: "AsyncSession") -> tuple[list, dict[uuid.UUID, "Track"]]:
    from app.models import Lesson, Track

    lessons = (
        await session.execute(select(Lesson).where(Lesson.archived_at.is_(None)))
    ).scalars().all()
    tracks = (
        await session.execute(select(Track).where(Track.archived_at.is_(None)))
    ).scalars().all()
    track_by_id = {t.id: t for t in tracks}
    visible = [l for l in lessons if _lesson_visible(l)]
    return visible, track_by_id


def _filter_candidates(
    visible: list,
    track_by_id: dict[uuid.UUID, "Track"],
    completed_ids: set[uuid.UUID],
    anchor: "Lesson | None",
) -> list:
    """Stage 1. Deterministic, pure. Returns at most ``MAX_CANDIDATES`` lessons."""
    anchor_diff = difficulty_ordinal(anchor.difficulty) if anchor else 0
    anchor_track_id = anchor.track_id if anchor else None
    anchor_track = track_by_id.get(anchor_track_id) if anchor_track_id else None
    related_slugs = set(RELATED_TRACKS.get(anchor_track.slug, [])) if anchor_track else set()

    eligible = []
    for l in visible:
        if l.id in completed_ids:
            continue
        # Prerequisites satisfied: every prereq is in the completed set.
        if any(p not in completed_ids for p in (l.prerequisites or [])):
            continue
        # Difficulty appropriate: within ±1 level of the anchor.
        if abs(difficulty_ordinal(l.difficulty) - anchor_diff) > 1:
            continue
        eligible.append(l)

    def _scope_rank(l) -> int:
        t = track_by_id.get(l.track_id)
        if anchor_track_id is not None and l.track_id == anchor_track_id:
            return 0  # same track
        if t is not None and t.slug in related_slugs:
            return 1  # related track
        return 2  # other track

    eligible.sort(key=lambda l: (_scope_rank(l), l.position, l.title))

    # Prefer same/related track; only widen to other tracks if we'd otherwise
    # have fewer than 3 candidates.
    focused = [l for l in eligible if _scope_rank(l) <= 1]
    chosen = focused if len(focused) >= 3 else eligible
    return chosen[:MAX_CANDIDATES]


def _state_fingerprint(
    completed_ids: set[uuid.UUID],
    anchor: "Lesson | None",
    candidates: list,
    last_active_bucket: str,
    context: str,
) -> str:
    payload = json.dumps(
        {
            "completed": sorted(str(i) for i in completed_ids),
            "anchor": str(anchor.id) if anchor else None,
            "candidates": sorted(str(l.id) for l in candidates),
            "bucket": last_active_bucket,
            "context": context,
        },
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def _time_bucket(last_active: datetime | None, now: datetime) -> str:
    if last_active is None:
        return "first visit"
    la = last_active if last_active.tzinfo else last_active.replace(tzinfo=timezone.utc)
    days = (now - la).total_seconds() / 86400
    if days < 1:
        return "same day"
    if days < 7:
        return "a few days"
    return "a few weeks"


def _step_signals(actions: list | None) -> str:
    """A compact, text-free digest of recent step actions for the LLM. Reads only
    metadata (counts / durations / positions) — never reflection content."""
    if not actions:
        return "no recent step activity recorded"
    recent = actions[-20:]
    skipped = sum(1 for a in recent if a.get("action") == "skipped")
    completed = sum(1 for a in recent if a.get("action") == "completed")
    total_ms = sum(int(a.get("ms") or 0) for a in recent)
    longest = max((int(a.get("ms") or 0) for a in recent), default=0)
    parts = [f"{completed} steps completed", f"{skipped} steps skipped"]
    if longest >= 120_000:
        parts.append(f"lingered ~{round(longest / 60000)} min on one step")
    parts.append(f"~{round(total_ms / 60000, 1)} min across recent steps")
    return "; ".join(parts)


def _build_prompt(
    *,
    anchor_track: "Track | None",
    completed_in_track: int,
    total_in_track: int,
    completed_titles: list[str],
    just_completed_title: str | None,
    time_bucket: str,
    step_signals: str,
    candidates: list,
    track_by_id: dict[uuid.UUID, "Track"],
) -> tuple[str, str]:
    system = (
        "You are the lesson-sequencing assistant for AnnealMusic, a calm, "
        "non-gamified tool for learning ambient-music synthesis and listening. "
        "Your only job is to choose, from a provided candidate list, the 1-3 "
        "lessons that best maintain pedagogical flow for this specific learner, "
        "and to write one short, warm, non-coercive sentence per pick explaining "
        "why it follows naturally.\n\n"
        "Hard rules:\n"
        "- Recommend ONLY lessons whose lesson_id appears in the candidate list. "
        "Never invent IDs.\n"
        "- Recommend at most 3. Fewer is fine if fewer fit well.\n"
        "- Prefer lessons that build directly on what the learner just completed "
        "or has been working through.\n"
        "- If the learner's recent activity suggests they struggled with or "
        "shallowly completed a prerequisite topic (e.g. they skipped steps, or "
        "spent very little time, on a foundation the candidate depends on), AVOID "
        "jumping ahead; prefer a consolidating or gentler-slope lesson instead.\n"
        "- Respect difficulty: do not leap to 'advanced' right after a struggled "
        "'intro'.\n"
        "- Tone: calm and descriptive. NO motivational language, NO "
        "streaks/goals/urgency, NO 'keep it up', NO 'don't lose momentum'. One "
        "plain sentence describing why the lesson fits - that is all.\n\n"
        "Output ONLY valid JSON, no prose, in exactly this shape:\n"
        '{"recommendations":[{"lesson_id":"<uuid from candidates>","rationale":"<one sentence>"}]}'
    )

    completed_json = json.dumps(
        [{"title": t} for t in completed_titles[:30]], ensure_ascii=False
    )
    cand_json = json.dumps(
        [
            {
                "lesson_id": str(l.id),
                "title": l.title,
                "difficulty": l.difficulty,
            }
            for l in candidates
        ],
        ensure_ascii=False,
    )
    track_line = (
        f"{anchor_track.slug} ({completed_in_track}/{total_in_track} lessons completed)"
        if anchor_track
        else "none yet"
    )
    user = (
        "LEARNER PROGRESS (metadata only):\n"
        f"- current_track: {track_line}\n"
        f"- completed_lessons: {completed_json}\n"
        f"- just_completed: {just_completed_title or 'none — arriving at /learn'}\n"
        f"- time_since_last_session: {time_bucket}\n"
        f"- recent_step_signals: {step_signals}\n\n"
        "CANDIDATE LESSONS (choose only from these):\n"
        f"{cand_json}\n\n"
        "Recommend 1-3 lessons that maintain pedagogical flow and respect the "
        "learner's recent struggles. Avoid recommending lessons whose "
        "prerequisites the learner only completed shallowly. Prefer lessons that "
        "build on what was just learned. Return JSON only."
    )
    return system, user


def _parse_recommendations(text: str, candidates: list) -> list[RecommendationItem] | None:
    """Validate model output against the candidate set. Returns None on any parse
    failure so the caller can retry / fall back."""
    raw = text.strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1] if "```" in raw[3:] else raw
        raw = raw.lstrip("json").strip().strip("`").strip()
    # Be tolerant: grab the outermost JSON object.
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        data = json.loads(raw[start : end + 1])
    except (json.JSONDecodeError, ValueError):
        return None

    by_id = {str(l.id): l for l in candidates}
    items: list[RecommendationItem] = []
    seen: set[str] = set()
    for rec in data.get("recommendations", []):
        lid = str(rec.get("lesson_id", ""))
        if lid not in by_id or lid in seen:
            continue  # drop hallucinated / duplicate ids
        seen.add(lid)
        items.append(_to_item(by_id[lid], _trim_rationale(rec.get("rationale"))))
        if len(items) >= MAX_RECOMMENDATIONS:
            break
    return items or None


def _trim_rationale(text: str | None) -> str:
    if not text:
        return "A natural next step from where you are."
    text = " ".join(str(text).split())
    return text[:240]


def _to_item(lesson, rationale: str, track_slug: str | None = None) -> RecommendationItem:
    return RecommendationItem(
        lesson_id=lesson.id,
        slug=lesson.slug,
        title=lesson.title,
        difficulty=lesson.difficulty,
        track_slug=track_slug or "",
        rationale=rationale,
    )


def _deterministic_items(candidates: list, track_by_id) -> list[RecommendationItem]:
    items = []
    for l in candidates[:MAX_RECOMMENDATIONS]:
        t = track_by_id.get(l.track_id)
        items.append(
            _to_item(l, "A natural next step from where you are.", t.slug if t else "")
        )
    return items


async def recommend_next(
    session: "AsyncSession",
    owned_user_ids: list[uuid.UUID],
    *,
    context: str,
    just_completed_lesson_id: uuid.UUID | None,
    llm,
    cache: dict | None = None,
    now: datetime | None = None,
) -> RecommendationsOut:
    from app.models import Lesson

    now = now or datetime.now(tz=timezone.utc)
    visible, track_by_id = await _load_curriculum(session)
    best = await best_progress_by_lesson(session, owned_user_ids)
    completed_ids = {lid for lid, r in best.items() if r.state == "completed"}

    # --- Onboarding: brand-new learner (nothing completed) -------------------
    if not completed_ids:
        return _onboarding(visible, track_by_id)

    # Anchor = the just-completed lesson, else the most-recently-active row.
    anchor: Lesson | None = None
    if just_completed_lesson_id is not None:
        anchor = await session.get(Lesson, just_completed_lesson_id)
    if anchor is None:
        recent = sorted(
            best.values(),
            key=lambda r: r.last_active_at or r.created_at,
            reverse=True,
        )
        if recent:
            anchor = await session.get(Lesson, recent[0].lesson_id)

    candidates = _filter_candidates(visible, track_by_id, completed_ids, anchor)
    if not candidates:
        return RecommendationsOut(items=[], source="empty")

    # --- Cache check ---------------------------------------------------------
    last_active = max(
        (r.last_active_at or r.created_at for r in best.values()), default=None
    )
    bucket = _time_bucket(last_active, now)
    fp = _state_fingerprint(completed_ids, anchor, candidates, bucket, context)
    if cache is not None:
        hit = cache.get(fp)
        if hit is not None and hit[0] > time.monotonic():
            return hit[1]

    # --- Stage 2: LLM ranking (with one retry, then deterministic fallback) --
    anchor_track = track_by_id.get(anchor.track_id) if anchor else None
    total_in_track = sum(
        1 for l in visible if anchor_track and l.track_id == anchor_track.id
    )
    completed_in_track = sum(
        1
        for lid in completed_ids
        if anchor_track
        and (lid in {l.id for l in visible if l.track_id == anchor_track.id})
    )
    completed_titles = [l.title for l in visible if l.id in completed_ids]
    anchor_actions = best[anchor.id].step_actions if anchor and anchor.id in best else None

    system, prompt = _build_prompt(
        anchor_track=anchor_track,
        completed_in_track=completed_in_track,
        total_in_track=total_in_track,
        completed_titles=completed_titles,
        just_completed_title=anchor.title if (context == "completion" and anchor) else None,
        time_bucket=bucket,
        step_signals=_step_signals(anchor_actions),
        candidates=candidates,
        track_by_id=track_by_id,
    )

    items: list[RecommendationItem] | None = None
    source = "llm"
    try:
        for attempt in range(2):
            text, _, _ = await llm.generate(
                system=system, prompt=prompt, model=RANKER_MODEL, temperature=0.2
            )
            items = _parse_recommendations(text, candidates)
            if items:
                break
    except Exception as e:  # noqa: BLE001 - any LLM/transport failure → degrade
        logger.warning("next-lesson ranker LLM failed, using deterministic order: %s", e)
        items = None

    if not items:
        items = _deterministic_items(candidates, track_by_id)
        source = "deterministic"
    else:
        # Backfill track_slug on the validated items (the parser doesn't have it).
        by_id = {str(l.id): l for l in candidates}
        for it in items:
            t = track_by_id.get(by_id[str(it.lesson_id)].track_id)
            it.track_slug = t.slug if t else ""

    result = RecommendationsOut(items=items, source=source)
    if cache is not None:
        cache[fp] = (time.monotonic() + CACHE_TTL_SECONDS, result)
    return result


def _onboarding(visible: list, track_by_id) -> RecommendationsOut:
    """One intro lesson from each of the first few tracks (by track position),
    deterministically — no LLM needed when there's no history to reason over."""
    intro_by_track: dict[uuid.UUID, object] = {}
    for l in sorted(visible, key=lambda x: x.position):
        if l.difficulty != "intro":
            continue
        if any(l.prerequisites or []):
            continue
        intro_by_track.setdefault(l.track_id, l)
    tracks_sorted = sorted(intro_by_track.keys(), key=lambda tid: (track_by_id[tid].position if tid in track_by_id else 0))
    items = []
    for tid in tracks_sorted[:MAX_RECOMMENDATIONS]:
        l = intro_by_track[tid]
        t = track_by_id.get(tid)
        items.append(
            _to_item(l, f"A gentle way into {t.title if t else 'the curriculum'}.", t.slug if t else "")
        )
    return RecommendationsOut(items=items, source="onboarding")
