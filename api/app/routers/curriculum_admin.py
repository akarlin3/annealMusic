"""Admin endpoints for v6.4 curriculum authoring tooling.

Scaffold specs, batch-generate, run quality checks, and edit the prerequisite
graph. All gated by the existing ``x-admin-key`` header. The heavy lifting lives
in services (``spec_generator``, ``curriculum_qa``); these endpoints are thin
orchestration over the existing v6.1 generation pipeline.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import SessionDep, require_admin
from app.errors import bad_request, not_found
from app.models import AudioClip, Lesson, LessonStep, Track
from app.schemas import (
    BatchGenerateIn,
    BatchGenerateItem,
    BatchGenerateOut,
    CurriculumQAOut,
    LessonQAOut,
    PrereqEdge,
    PrereqGraphIn,
    PrereqGraphOut,
    PrereqNode,
    SpecGenerateIn,
    SpecGenerateOut,
)
from app.services import curriculum_qa as qa
from app.services.lesson_generation import generate_lesson
from app.services.spec_generator import generate_spec

router = APIRouter(
    prefix="/api/v1/admin/curriculum",
    tags=["curriculum-admin"],
    dependencies=[Depends(require_admin)],
)


# --- Shared helpers ----------------------------------------------------------


async def _track_slug_by_id(session: AsyncSession) -> dict[uuid.UUID, str]:
    rows = (await session.execute(select(Track.id, Track.slug))).all()
    return {r[0]: r[1] for r in rows}


async def _known_track_slugs(session: AsyncSession) -> set[str]:
    rows = (await session.execute(
        select(Track.slug).where(Track.archived_at.is_(None))
    )).scalars().all()
    return set(rows)


async def _available_clip_slugs(session: AsyncSession) -> set[str]:
    rows = (await session.execute(
        select(AudioClip.slug).where(AudioClip.archived_at.is_(None))
    )).scalars().all()
    return set(rows)


def _spec_id(track_slug: str, lesson: Lesson) -> str:
    return f"{track_slug}/{lesson.slug}"


async def _lesson_steps(session: AsyncSession, lesson_id: uuid.UUID) -> list[LessonStep]:
    return list((await session.execute(
        select(LessonStep).where(LessonStep.lesson_id == lesson_id).order_by(LessonStep.position.asc())
    )).scalars().all())


def _manifest_version() -> int:
    from app.validation import load_manifest
    return int(load_manifest().get("schemaVersion", 7))


# --- Spec generator ----------------------------------------------------------


@router.post("/spec-generate", response_model=SpecGenerateOut)
async def spec_generate(body: SpecGenerateIn, request: Request, session: SessionDep) -> SpecGenerateOut:
    if body.track not in await _known_track_slugs(session):
        raise bad_request(f"unknown track '{body.track}'")
    try:
        spec = await generate_spec(
            request.app.state.llm,
            topic=body.topic,
            track=body.track,
            outline=body.outline,
            difficulty=body.difficulty,
        )
    except ValueError as e:
        raise bad_request(str(e))
    return SpecGenerateOut(spec=spec)


# --- Batch generation --------------------------------------------------------


@router.post("/batch-generate", response_model=BatchGenerateOut)
async def batch_generate(body: BatchGenerateIn, request: Request, session: SessionDep) -> BatchGenerateOut:
    if body.lesson_ids:
        lessons = [await session.get(Lesson, lid) for lid in body.lesson_ids]
        lessons = [l for l in lessons if l is not None]
    else:
        statuses = ["pending"]
        if body.include_failed:
            statuses.append("generation_failed")
        lessons = list((await session.execute(
            select(Lesson).where(
                Lesson.spec.is_not(None),
                Lesson.generation_status.in_(statuses),
            ).order_by(Lesson.position.asc())
        )).scalars().all())

    results: list[BatchGenerateItem] = []
    for lesson in lessons:
        if not lesson.spec:
            results.append(BatchGenerateItem(
                id=lesson.id, slug=lesson.slug, title=lesson.title,
                generation_status="skipped", generation_error="no spec",
            ))
            continue
        try:
            await generate_lesson(
                session, request.app.state.llm, lesson,
                embeddings=request.app.state.embeddings,
            )
        except Exception as e:  # noqa: BLE001 - one bad lesson shouldn't sink the batch
            lesson.generation_status = "generation_failed"
            lesson.generation_error = str(e)[:500]
            await session.commit()
        await session.refresh(lesson)
        results.append(BatchGenerateItem(
            id=lesson.id, slug=lesson.slug, title=lesson.title,
            generation_status=lesson.generation_status,
            generation_error=lesson.generation_error,
        ))
    return BatchGenerateOut(requested=len(lessons), results=results)


# --- Quality checks ----------------------------------------------------------


def _to_qa_input(spec_id: str, lesson: Lesson, steps: list[LessonStep]) -> qa.LessonQAInput:
    return qa.LessonQAInput(
        id=spec_id,
        title=lesson.title,
        difficulty=lesson.difficulty,
        spec=lesson.spec,
        steps=[
            {"type": s.type, "config": s.config, "override": s.manual_override_content}
            for s in steps
        ],
    )


async def _qa_one(
    session: AsyncSession, lesson: Lesson, *,
    track_slugs: dict[uuid.UUID, str], clips: set[str],
    known_tracks: set[str], manifest_version: int,
) -> LessonQAOut:
    spec_id = _spec_id(track_slugs.get(lesson.track_id, "?"), lesson)
    steps = await _lesson_steps(session, lesson.id)
    inp = _to_qa_input(spec_id, lesson, steps)
    findings = qa.check_lesson(
        inp, available_clip_slugs=clips,
        manifest_version=manifest_version, known_track_slugs=known_tracks,
    )
    summary = qa.summarize(findings)
    return LessonQAOut(
        id=lesson.id, spec_id=spec_id, slug=lesson.slug, title=lesson.title,
        status=summary["status"], errors=summary["errors"], warnings=summary["warnings"],
        findings=summary["findings"],
    )


@router.get("/qa/{lesson_id}", response_model=LessonQAOut)
async def qa_lesson(lesson_id: uuid.UUID, session: SessionDep) -> LessonQAOut:
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise not_found("lesson")
    return await _qa_one(
        session, lesson,
        track_slugs=await _track_slug_by_id(session),
        clips=await _available_clip_slugs(session),
        known_tracks=await _known_track_slugs(session),
        manifest_version=_manifest_version(),
    )


@router.get("/qa", response_model=CurriculumQAOut)
async def qa_all(session: SessionDep) -> CurriculumQAOut:
    track_slugs = await _track_slug_by_id(session)
    clips = await _available_clip_slugs(session)
    known_tracks = await _known_track_slugs(session)
    mv = _manifest_version()

    lessons = list((await session.execute(
        select(Lesson).order_by(Lesson.position.asc(), Lesson.slug.asc())
    )).scalars().all())

    lesson_outs: list[LessonQAOut] = []
    difficulty_by_id: dict[str, str] = {}
    for lesson in lessons:
        spec_id = _spec_id(track_slugs.get(lesson.track_id, "?"), lesson)
        difficulty_by_id[spec_id] = lesson.difficulty
        lesson_outs.append(await _qa_one(
            session, lesson, track_slugs=track_slugs, clips=clips,
            known_tracks=known_tracks, manifest_version=mv,
        ))

    edges = await _resolve_edges(session, lessons, track_slugs)
    graph_findings = qa.check_prereq_graph(
        edges, known_ids=set(difficulty_by_id.keys())
    )
    graph_findings += qa.check_difficulty_monotonicity(difficulty_by_id, edges)

    worst = "pass"
    levels = {"pass": 0, "warn": 1, "fail": 2}
    for lo in lesson_outs:
        if levels[lo.status] > levels[worst]:
            worst = lo.status
    if any(f.level == "error" for f in graph_findings):
        worst = "fail"
    elif graph_findings and worst == "pass":
        worst = "warn"

    return CurriculumQAOut(
        status=worst,
        graph_findings=[{"rule": f.rule, "level": f.level, "message": f.message} for f in graph_findings],
        lessons=lesson_outs,
    )


# --- Prerequisite graph ------------------------------------------------------


async def _resolve_edges(
    session: AsyncSession, lessons: list[Lesson], track_slugs: dict[uuid.UUID, str]
) -> list[tuple[str, str]]:
    by_uuid = {l.id: _spec_id(track_slugs.get(l.track_id, "?"), l) for l in lessons}
    edges: list[tuple[str, str]] = []
    for lesson in lessons:
        lesson_sid = by_uuid[lesson.id]
        for pre_uuid in (lesson.prerequisites or []):
            pre_sid = by_uuid.get(pre_uuid)
            if pre_sid:
                edges.append((pre_sid, lesson_sid))
    return edges


@router.get("/prereqs", response_model=PrereqGraphOut)
async def get_prereqs(session: SessionDep) -> PrereqGraphOut:
    track_slugs = await _track_slug_by_id(session)
    lessons = list((await session.execute(
        select(Lesson).order_by(Lesson.position.asc())
    )).scalars().all())
    nodes = [
        PrereqNode(
            id=_spec_id(track_slugs.get(l.track_id, "?"), l),
            lesson_id=l.id, track=track_slugs.get(l.track_id, "?"),
            title=l.title, difficulty=l.difficulty,
        )
        for l in lessons
    ]
    edges = [
        PrereqEdge(prerequisite=p, lesson=lsn)
        for (p, lsn) in await _resolve_edges(session, lessons, track_slugs)
    ]
    return PrereqGraphOut(nodes=nodes, edges=edges)


@router.put("/prereqs", response_model=PrereqGraphOut)
async def put_prereqs(body: PrereqGraphIn, session: SessionDep) -> PrereqGraphOut:
    track_slugs = await _track_slug_by_id(session)
    lessons = list((await session.execute(select(Lesson))).scalars().all())
    sid_to_uuid = {_spec_id(track_slugs.get(l.track_id, "?"), l): l.id for l in lessons}
    known = set(sid_to_uuid.keys())

    raw_edges = [(e.prerequisite, e.lesson) for e in body.edges]
    # Reject unknown ids up front for a clear error.
    for pre, lsn in raw_edges:
        if pre not in known or lsn not in known:
            raise bad_request(f"edge references unknown lesson: {pre} -> {lsn}")

    findings = qa.check_prereq_graph(raw_edges, known_ids=known)
    errors = [f for f in findings if f.level == "error"]
    if errors:
        raise bad_request("; ".join(f.message for f in errors))

    # Apply: rebuild each lesson's prerequisites array from the edge set.
    by_uuid = {l.id: l for l in lessons}
    new_prereqs: dict[uuid.UUID, list[uuid.UUID]] = {l.id: [] for l in lessons}
    for pre, lsn in raw_edges:
        new_prereqs[sid_to_uuid[lsn]].append(sid_to_uuid[pre])
    for lid, pres in new_prereqs.items():
        by_uuid[lid].prerequisites = pres
    await session.commit()

    return await get_prereqs(session)
