"""v6.3 — next-lesson recommendations.

A thin HTTP wrapper over ``services/next_lesson_ranker.recommend_next``. Works for
anonymous callers too (so the onboarding picker and a freshly-signed-in learner
both get suggestions), merging an account's devices via ``Identity.owned_anon_ids``.

Calm-by-design: this is an *offer*, not a funnel — the client always pairs the
cards with a "browse freely" escape, and the response carries no streak/score.
Called at most ~once per session (completion or /learn arrival); a 5-minute TTL
cache (held on ``app.state.recommend_cache``) returns identical state without an
LLM call.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: F401 - typing parity

from app.deps import CurrentWriter, Identity, SessionDep, get_identity, rate_limit
from app.models import User
from app.schemas import RecommendationRequest, RecommendationsOut
from app.services.next_lesson_ranker import recommend_next

router = APIRouter(prefix="/api/v1/recommendations", tags=["learn"])


async def _owned_user_ids(identity: Identity, writer: User) -> list[uuid.UUID]:
    ids = set(identity.owned_anon_ids or [])
    ids.add(writer.id)
    return list(ids)


@router.post(
    "/next", response_model=RecommendationsOut,
    dependencies=[Depends(rate_limit("recommendations"))],
)
async def next_lessons(
    body: RecommendationRequest,
    request: Request,
    writer: CurrentWriter,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> RecommendationsOut:
    owned = await _owned_user_ids(identity, writer)

    cache = getattr(request.app.state, "recommend_cache", None)
    if cache is None:
        cache = {}
        request.app.state.recommend_cache = cache

    return await recommend_next(
        session,
        owned,
        context=body.context,
        just_completed_lesson_id=body.just_completed_lesson_id,
        llm=request.app.state.llm,
        cache=cache,
    )
