"""Admin endpoints for v6.1 LLM lesson generation.

Author a lesson *spec*, trigger generation (cached + validated), inspect status,
and manually override any step. Reuses the existing ``x-admin-key`` gate.
"""

from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import SessionDep, require_admin
from app.errors import bad_request, not_found
from app.models import Lesson, LessonStep, Track
from app.schemas import (
    LessonGenStatusOut,
    LessonGenStepOut,
    LessonSpec,
    StepOverrideIn,
)
from app.services.lesson_generation import generate_lesson

router = APIRouter(prefix="/api/v1/admin", tags=["learn-admin"], dependencies=[Depends(require_admin)])

_IDENT = re.compile(r"^[A-Za-z][\w.]{0,40}$")


def _validate_spec(spec: LessonSpec) -> str:
    """Cross-field spec validation beyond pydantic. Returns the lesson slug."""
    if "/" not in spec.id:
        raise bad_request("spec id must be 'track_slug/lesson_slug'")
    track_part, slug = spec.id.split("/", 1)
    if track_part != spec.track:
        raise bad_request("spec id prefix must equal 'track'")
    if not slug:
        raise bad_request("spec id is missing the lesson slug")
    for i, step in enumerate(spec.step_outline):
        if step.type == "demo" and not step.patch_brief:
            raise bad_request(f"step {i}: demo requires 'patch_brief'")
        if step.type == "prompt" and not step.task:
            raise bad_request(f"step {i}: prompt requires 'task'")
        if step.type in ("text", "reflection") and not step.topic:
            raise bad_request(f"step {i}: {step.type} requires 'topic'")
        if step.type == "audio-clip" and not step.clip_topic:
            raise bad_request(f"step {i}: audio-clip requires 'clip_topic'")
        if step.diagram and step.type != "text":
            raise bad_request(f"step {i}: 'diagram' is only valid on text steps")
    for c in spec.constraints_during_prompts:
        if not _IDENT.match(c):
            raise bad_request(f"invalid control key in constraints: '{c}'")
    return slug


def _step_out(step: LessonStep) -> LessonGenStepOut:
    return LessonGenStepOut.model_validate(step)


async def _status_out(session: AsyncSession, lesson: Lesson) -> LessonGenStatusOut:
    steps = (await session.execute(
        select(LessonStep).where(LessonStep.lesson_id == lesson.id).order_by(LessonStep.position.asc())
    )).scalars().all()
    return LessonGenStatusOut(
        id=lesson.id,
        track_id=lesson.track_id,
        slug=lesson.slug,
        title=lesson.title,
        difficulty=lesson.difficulty,
        generation_status=lesson.generation_status,
        generation_error=lesson.generation_error,
        spec=lesson.spec,
        steps=[_step_out(s) for s in steps],
    )


async def _resolve_prereqs(session: AsyncSession, prereq_ids: list[str]) -> list[uuid.UUID]:
    resolved: list[uuid.UUID] = []
    for pid in prereq_ids:
        if "/" not in pid:
            continue
        t_slug, l_slug = pid.split("/", 1)
        row = (await session.execute(
            select(Lesson.id).join(Track, Track.id == Lesson.track_id).where(
                Track.slug == t_slug, Lesson.slug == l_slug
            )
        )).scalar_one_or_none()
        if row is not None:
            resolved.append(row)
    return resolved


async def _upsert_lesson(session: AsyncSession, spec: LessonSpec, slug: str) -> Lesson:
    track = (await session.execute(
        select(Track).where(Track.slug == spec.track, Track.archived_at.is_(None))
    )).scalar_one_or_none()
    if track is None:
        raise not_found("track")

    spec_dict = spec.model_dump()
    prereqs = await _resolve_prereqs(session, spec.prerequisites)

    lesson = (await session.execute(
        select(Lesson).where(Lesson.track_id == track.id, Lesson.slug == slug)
    )).scalar_one_or_none()
    if lesson is None:
        lesson = Lesson(
            track_id=track.id, slug=slug, title=spec.title,
            description=spec.description, difficulty=spec.difficulty,
            estimated_minutes=spec.estimated_minutes, position=spec.position,
            prerequisites=prereqs,
        )
        session.add(lesson)
        await session.flush()
    else:
        lesson.title = spec.title
        lesson.description = spec.description
        lesson.difficulty = spec.difficulty
        lesson.estimated_minutes = spec.estimated_minutes
        lesson.position = spec.position
        lesson.prerequisites = prereqs

    lesson.spec = spec_dict
    lesson.generation_status = "pending"
    lesson.generation_error = None

    # Rebuild the step skeleton from the outline, preserving manual overrides.
    existing = {
        s.position: s
        for s in (await session.execute(
            select(LessonStep).where(LessonStep.lesson_id == lesson.id)
        )).scalars().all()
    }
    outline = spec.step_outline
    for i, item in enumerate(outline):
        step = existing.pop(i, None)
        if step is not None and step.manual_override_content:
            step.type = item.type  # keep override content; only sync the type
            continue
        if step is None:
            step = LessonStep(lesson_id=lesson.id, position=i, type=item.type, config={})
            session.add(step)
        else:
            step.type = item.type
            step.config = {}
            step.generation_id = None
            step.prompt_version = None
            step.model_id = None
            step.generated_at = None
    # Drop steps beyond the new outline length.
    for leftover in existing.values():
        await session.delete(leftover)

    await session.commit()
    await session.refresh(lesson)
    return lesson


@router.post("/lessons/generate", response_model=LessonGenStatusOut, status_code=201)
async def generate_lesson_endpoint(
    spec: LessonSpec, request: Request, session: SessionDep
) -> LessonGenStatusOut:
    slug = _validate_spec(spec)
    lesson = await _upsert_lesson(session, spec, slug)
    await generate_lesson(session, request.app.state.llm, lesson, embeddings=request.app.state.embeddings)
    await session.refresh(lesson)
    return await _status_out(session, lesson)


@router.post("/lessons/{lesson_id}/regenerate", response_model=LessonGenStatusOut)
async def regenerate_lesson_endpoint(
    lesson_id: uuid.UUID, request: Request, session: SessionDep
) -> LessonGenStatusOut:
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise not_found("lesson")
    if not lesson.spec:
        raise bad_request("lesson has no spec to regenerate from")
    await generate_lesson(session, request.app.state.llm, lesson, embeddings=request.app.state.embeddings)
    await session.refresh(lesson)
    return await _status_out(session, lesson)


@router.get("/lessons", response_model=list[LessonGenStatusOut])
async def list_lessons_status(session: SessionDep) -> list[LessonGenStatusOut]:
    """All lessons with their generation status (for the admin dashboard)."""
    lessons = (await session.execute(
        select(Lesson).order_by(Lesson.position.asc(), Lesson.slug.asc())
    )).scalars().all()
    return [await _status_out(session, l) for l in lessons]


@router.get("/lessons/{lesson_id}/status", response_model=LessonGenStatusOut)
async def lesson_status_endpoint(lesson_id: uuid.UUID, session: SessionDep) -> LessonGenStatusOut:
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise not_found("lesson")
    return await _status_out(session, lesson)


@router.put("/lesson-steps/{step_id}/override", response_model=LessonGenStepOut)
async def set_step_override(
    step_id: uuid.UUID, body: StepOverrideIn, session: SessionDep
) -> LessonGenStepOut:
    step = await session.get(LessonStep, step_id)
    if step is None:
        raise not_found("lesson_step")
    # Demo overrides must carry a schema-valid patch.
    if step.type == "demo":
        payload = body.content.get("payload") or _payload_from_patch(body.content.get("patch"))
        if payload is None:
            raise bad_request("demo override must include a 'payload' or 'patch'")
        from app.validation import load_manifest, validate_payload
        errs = validate_payload(payload, int(load_manifest().get("schemaVersion", 7)))
        if errs:
            raise bad_request(f"invalid demo patch: {'; '.join(errs)}")
    step.manual_override_content = body.content
    await session.commit()
    await session.refresh(step)
    return _step_out(step)


@router.delete("/lesson-steps/{step_id}/override", response_model=LessonGenStepOut)
async def clear_step_override(step_id: uuid.UUID, session: SessionDep) -> LessonGenStepOut:
    step = await session.get(LessonStep, step_id)
    if step is None:
        raise not_found("lesson_step")
    step.manual_override_content = None
    await session.commit()
    await session.refresh(step)
    return _step_out(step)


def _payload_from_patch(patch: dict | None) -> str | None:
    if not patch:
        return None
    return "&".join(f"{k}={v}" for k, v in patch.items())
