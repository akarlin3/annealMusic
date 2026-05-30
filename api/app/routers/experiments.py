from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.deps import (
    CurrentUser,
    CurrentWriter,
    OptionalUser,
    SessionDep,
    Identity,
    get_identity,
    rate_limit,
)
from app.errors import forbidden, not_found, quota_exceeded
from app.models import Experiment
from app.schemas import (
    ExperimentCreate,
    ExperimentUpdate,
    ExperimentOut,
    ExperimentListOut,
)
from app.slug import new_slug

router = APIRouter(prefix="/api/v1/experiments", tags=["experiments"])


def to_out(exp: Experiment) -> ExperimentOut:
    return ExperimentOut(
        id=exp.id,
        user_id=exp.user_id,
        title=exp.title,
        definition=exp.definition,
        description=exp.description,
        short_slug=exp.short_slug,
        created_at=exp.created_at,
        updated_at=exp.updated_at,
    )


async def _resolve(session: AsyncSession, id_or_slug: str) -> Experiment | None:
    try:
        pid = uuid.UUID(id_or_slug)
        exp = await session.get(Experiment, pid)
        if exp is not None:
            return exp
    except ValueError:
        pass
    return (
        await session.execute(
            select(Experiment).where(Experiment.short_slug == id_or_slug)
        )
    ).scalar_one_or_none()


@router.post(
    "",
    response_model=ExperimentOut,
    status_code=201,
    dependencies=[Depends(rate_limit("scripts"))],
)
async def create_experiment(
    body: ExperimentCreate,
    user: CurrentWriter,
    session: SessionDep,
) -> ExperimentOut:
    settings = get_settings()

    # Query existing count for quota validation
    stmt = select(Experiment).where(Experiment.user_id == user.id)
    existing_count = len((await session.execute(stmt)).scalars().all())

    if existing_count >= settings.quota_experiments:
        raise quota_exceeded("experiments", settings.quota_experiments)

    exp = Experiment(
        user_id=user.id,
        title=body.title,
        definition=body.definition,
        description=body.description,
        short_slug=new_slug(),
    )
    session.add(exp)
    await session.flush()
    await session.commit()
    await session.refresh(exp)

    return to_out(exp)


@router.get(
    "/me",
    response_model=ExperimentListOut,
    dependencies=[Depends(rate_limit("get"))],
)
async def list_my_experiments(
    user: CurrentUser,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> ExperimentListOut:
    if identity.account_id is not None:
        stmt = select(Experiment).where(Experiment.user_id.in_(identity.owned_anon_ids))
    else:
        stmt = select(Experiment).where(Experiment.user_id == user.id)

    stmt = stmt.order_by(Experiment.created_at.desc())
    rows = (await session.execute(stmt)).scalars().all()
    await session.commit()

    return ExperimentListOut(items=[to_out(e) for e in rows])


@router.get(
    "/{id_or_slug}",
    response_model=ExperimentOut,
    dependencies=[Depends(rate_limit("get"))],
)
async def get_experiment(
    id_or_slug: str,
    session: SessionDep,
) -> ExperimentOut:
    # Public endpoint: anyone can retrieve the experiment configuration to participate!
    exp = await _resolve(session, id_or_slug)
    if exp is None:
        raise not_found("experiment")

    await session.commit()
    return to_out(exp)


@router.patch(
    "/{id}",
    response_model=ExperimentOut,
    dependencies=[Depends(rate_limit("scripts"))],
)
async def update_experiment(
    id: uuid.UUID,
    body: ExperimentUpdate,
    user: CurrentWriter,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> ExperimentOut:
    exp = await session.get(Experiment, id)
    if exp is None:
        raise not_found("experiment")

    # Verify ownership
    owner_ids = identity.owned_anon_ids if identity.account_id is not None else [user.id]
    if exp.user_id not in owner_ids:
        raise forbidden()

    if body.title is not None:
        exp.title = body.title
    if body.definition is not None:
        exp.definition = body.definition
    if body.description is not None:
        exp.description = body.description

    await session.commit()
    await session.refresh(exp)

    return to_out(exp)


@router.delete(
    "/{id}",
    status_code=204,
    dependencies=[Depends(rate_limit("scripts"))],
)
async def delete_experiment(
    id: uuid.UUID,
    user: CurrentWriter,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> None:
    exp = await session.get(Experiment, id)
    if exp is None:
        raise not_found("experiment")

    # Verify ownership
    owner_ids = identity.owned_anon_ids if identity.account_id is not None else [user.id]
    if exp.user_id not in owner_ids:
        raise forbidden()

    await session.delete(exp)
    await session.commit()
