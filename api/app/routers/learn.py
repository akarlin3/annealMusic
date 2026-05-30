from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import SessionDep, require_admin, rate_limit
from app.errors import not_found, bad_request
from app.models import Track, Lesson, LessonStep
from app.schemas import (
    TrackCreate,
    TrackUpdate,
    TrackOut,
    TrackListOut,
    LessonCreate,
    LessonUpdate,
    LessonOut,
    LessonStepCreate,
    LessonStepUpdate,
    LessonStepOut,
)

router = APIRouter(prefix="/api/v1", tags=["learn"])


# Helper function to convert Step model to Out schema
def step_to_out(step: LessonStep) -> LessonStepOut:
    return LessonStepOut(
        id=step.id,
        lesson_id=step.lesson_id,
        position=step.position,
        type=step.type,
        config=step.config,
    )


# Helper function to convert Lesson model to Out schema
async def lesson_to_out(session: AsyncSession, lesson: Lesson) -> LessonOut:
    steps_stmt = (
        select(LessonStep)
        .where(LessonStep.lesson_id == lesson.id)
        .order_by(LessonStep.position.asc())
    )
    steps = (await session.execute(steps_stmt)).scalars().all()
    steps_out = [step_to_out(s) for s in steps]

    return LessonOut(
        id=lesson.id,
        track_id=lesson.track_id,
        slug=lesson.slug,
        title=lesson.title,
        description=lesson.description,
        difficulty=lesson.difficulty,
        estimated_minutes=lesson.estimated_minutes,
        position=lesson.position,
        prerequisites=lesson.prerequisites,
        created_at=lesson.created_at,
        updated_at=lesson.updated_at,
        steps=steps_out,
    )


# Helper function to convert Track model to Out schema
async def track_to_out(session: AsyncSession, track: Track) -> TrackOut:
    lessons_stmt = (
        select(Lesson)
        .where(Lesson.track_id == track.id, Lesson.archived_at.is_(None))
        .order_by(Lesson.position.asc())
    )
    lessons = (await session.execute(lessons_stmt)).scalars().all()
    lessons_out = [await lesson_to_out(session, l) for l in lessons]

    return TrackOut(
        id=track.id,
        slug=track.slug,
        title=track.title,
        description=track.description,
        position=track.position,
        color=track.color,
        created_at=track.created_at,
        lessons=lessons_out,
    )


# --- Public Endpoints --------------------------------------------------------

@router.get("/tracks", response_model=TrackListOut, dependencies=[Depends(rate_limit("get"))])
async def list_tracks(session: SessionDep) -> TrackListOut:
    """List all public active tracks with their public lessons in sorted order."""
    stmt = (
        select(Track)
        .where(Track.archived_at.is_(None))
        .order_by(Track.position.asc())
    )
    tracks = (await session.execute(stmt)).scalars().all()
    items = [await track_to_out(session, t) for t in tracks]
    return TrackListOut(items=items)


@router.get("/tracks/{slug}", response_model=TrackOut, dependencies=[Depends(rate_limit("get"))])
async def get_track(slug: str, session: SessionDep) -> TrackOut:
    """Retrieve a single track with its lessons by slug."""
    stmt = (
        select(Track)
        .where(Track.slug == slug, Track.archived_at.is_(None))
    )
    track = (await session.execute(stmt)).scalar_one_or_none()
    if track is None:
        raise not_found("track")
    return await track_to_out(session, track)


@router.get("/lessons/{track_slug}/{lesson_slug}", response_model=LessonOut, dependencies=[Depends(rate_limit("get"))])
async def get_lesson(track_slug: str, lesson_slug: str, session: SessionDep) -> LessonOut:
    """Fetch a specific lesson with all its nested steps."""
    track_stmt = (
        select(Track)
        .where(Track.slug == track_slug, Track.archived_at.is_(None))
    )
    track = (await session.execute(track_stmt)).scalar_one_or_none()
    if track is None:
        raise not_found("track")

    lesson_stmt = (
        select(Lesson)
        .where(
            Lesson.track_id == track.id,
            Lesson.slug == lesson_slug,
            Lesson.archived_at.is_(None),
        )
    )
    lesson = (await session.execute(lesson_stmt)).scalar_one_or_none()
    if lesson is None:
        raise not_found("lesson")

    return await lesson_to_out(session, lesson)


# --- Admin Endpoints ---------------------------------------------------------

@router.post("/admin/tracks", response_model=TrackOut, status_code=201, dependencies=[Depends(require_admin)])
async def create_track(body: TrackCreate, session: SessionDep) -> TrackOut:
    """Create a new track."""
    # Check if slug is unique
    existing_stmt = select(Track).where(Track.slug == body.slug)
    existing = (await session.execute(existing_stmt)).scalar_one_or_none()
    if existing is not None:
        raise bad_request("Track slug must be unique")

    track = Track(
        slug=body.slug,
        title=body.title,
        description=body.description,
        position=body.position,
        color=body.color,
    )
    session.add(track)
    await session.commit()
    await session.refresh(track)
    return await track_to_out(session, track)


@router.patch("/admin/tracks/{id}", response_model=TrackOut, dependencies=[Depends(require_admin)])
async def update_track(id: uuid.UUID, body: TrackUpdate, session: SessionDep) -> TrackOut:
    """Update track parameters."""
    track = await session.get(Track, id)
    if track is None:
        raise not_found("track")

    if body.slug is not None:
        # Check slug unique
        existing_stmt = select(Track).where(Track.slug == body.slug, Track.id != id)
        existing = (await session.execute(existing_stmt)).scalar_one_or_none()
        if existing is not None:
            raise bad_request("Track slug must be unique")
        track.slug = body.slug

    if body.title is not None:
        track.title = body.title
    if body.description is not None:
        track.description = body.description
    if body.position is not None:
        track.position = body.position
    if "color" in body.model_fields_set:
        track.color = body.color

    await session.commit()
    await session.refresh(track)
    return await track_to_out(session, track)


@router.post("/admin/lessons", response_model=LessonOut, status_code=201, dependencies=[Depends(require_admin)])
async def create_lesson(body: LessonCreate, session: SessionDep) -> LessonOut:
    """Create a new lesson."""
    track = await session.get(Track, body.track_id)
    if track is None:
        raise not_found("track")

    # Check slug uniqueness within track
    existing_stmt = select(Lesson).where(Lesson.track_id == body.track_id, Lesson.slug == body.slug)
    existing = (await session.execute(existing_stmt)).scalar_one_or_none()
    if existing is not None:
        raise bad_request("Lesson slug must be unique within track")

    lesson = Lesson(
        track_id=body.track_id,
        slug=body.slug,
        title=body.title,
        description=body.description,
        difficulty=body.difficulty,
        estimated_minutes=body.estimated_minutes,
        position=body.position,
        prerequisites=body.prerequisites,
    )
    session.add(lesson)
    await session.commit()
    await session.refresh(lesson)
    return await lesson_to_out(session, lesson)


@router.patch("/admin/lessons/{id}", response_model=LessonOut, dependencies=[Depends(require_admin)])
async def update_lesson(id: uuid.UUID, body: LessonUpdate, session: SessionDep) -> LessonOut:
    """Update lesson parameters."""
    lesson = await session.get(Lesson, id)
    if lesson is None:
        raise not_found("lesson")

    if body.slug is not None:
        existing_stmt = select(Lesson).where(
            Lesson.track_id == lesson.track_id, Lesson.slug == body.slug, Lesson.id != id
        )
        existing = (await session.execute(existing_stmt)).scalar_one_or_none()
        if existing is not None:
            raise bad_request("Lesson slug must be unique within track")
        lesson.slug = body.slug

    if body.title is not None:
        lesson.title = body.title
    if body.description is not None:
        lesson.description = body.description
    if body.difficulty is not None:
        lesson.difficulty = body.difficulty
    if body.estimated_minutes is not None:
        lesson.estimated_minutes = body.estimated_minutes
    if body.position is not None:
        lesson.position = body.position
    if body.prerequisites is not None:
        lesson.prerequisites = body.prerequisites

    await session.commit()
    await session.refresh(lesson)
    return await lesson_to_out(session, lesson)


@router.post("/admin/lesson-steps", response_model=LessonStepOut, status_code=201, dependencies=[Depends(require_admin)])
async def create_lesson_step(body: LessonStepCreate, lesson_id: uuid.UUID = Query(...), session: SessionDep = None) -> LessonStepOut:
    """Add a new step to a lesson."""
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise not_found("lesson")

    # Check unique position within lesson
    existing_stmt = select(LessonStep).where(LessonStep.lesson_id == lesson_id, LessonStep.position == body.position)
    existing = (await session.execute(existing_stmt)).scalar_one_or_none()
    if existing is not None:
        raise bad_request("Step position must be unique within lesson")

    step = LessonStep(
        lesson_id=lesson_id,
        position=body.position,
        type=body.type,
        config=body.config,
    )
    session.add(step)
    await session.commit()
    await session.refresh(step)
    return step_to_out(step)


@router.patch("/admin/lesson-steps/{id}", response_model=LessonStepOut, dependencies=[Depends(require_admin)])
async def update_lesson_step(id: uuid.UUID, body: LessonStepUpdate, session: SessionDep) -> LessonStepOut:
    """Update an existing lesson step."""
    step = await session.get(LessonStep, id)
    if step is None:
        raise not_found("lesson_step")

    if body.position is not None:
        existing_stmt = select(LessonStep).where(
            LessonStep.lesson_id == step.lesson_id,
            LessonStep.position == body.position,
            LessonStep.id != id,
        )
        existing = (await session.execute(existing_stmt)).scalar_one_or_none()
        if existing is not None:
            raise bad_request("Step position must be unique within lesson")
        step.position = body.position

    if body.type is not None:
        step.type = body.type
    if body.config is not None:
        step.config = body.config

    await session.commit()
    await session.refresh(step)
    return step_to_out(step)
