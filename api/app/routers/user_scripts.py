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
from app.models import UserScript
from app.schemas import (
    UserScriptCreate,
    UserScriptUpdate,
    UserScriptOut,
    UserScriptListOut,
)

router = APIRouter(prefix="/api/v1/scripts", tags=["scripts"])


def to_out(script: UserScript) -> UserScriptOut:
    return UserScriptOut(
        id=script.id,
        user_id=script.user_id,
        name=script.name,
        source=script.source,
        language=script.language,
        visibility=script.visibility,  # type: ignore[arg-type]
        created_at=script.created_at,
        updated_at=script.updated_at,
    )


@router.post(
    "",
    response_model=UserScriptOut,
    status_code=201,
    dependencies=[Depends(rate_limit("scripts"))],
)
async def create_script(
    body: UserScriptCreate,
    user: CurrentWriter,
    session: SessionDep,
) -> UserScriptOut:
    settings = get_settings()

    # Query scripts count for quota validation
    stmt = select(UserScript).where(UserScript.user_id == user.id)
    existing_count = len((await session.execute(stmt)).scalars().all())

    if existing_count >= settings.quota_scripts:
        raise quota_exceeded("scripts", settings.quota_scripts)

    script = UserScript(
        user_id=user.id,
        name=body.name,
        source=body.source,
        language=body.language,
        visibility=body.visibility,
    )
    session.add(script)
    await session.flush()
    await session.commit()
    await session.refresh(script)

    return to_out(script)


@router.get(
    "/me",
    response_model=UserScriptListOut,
    dependencies=[Depends(rate_limit("get"))],
)
async def list_my_scripts(
    user: CurrentUser,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> UserScriptListOut:
    if identity.account_id is not None:
        stmt = select(UserScript).where(UserScript.user_id.in_(identity.owned_anon_ids))
    else:
        stmt = select(UserScript).where(UserScript.user_id == user.id)

    stmt = stmt.order_by(UserScript.created_at.desc())
    rows = (await session.execute(stmt)).scalars().all()
    await session.commit()

    return UserScriptListOut(items=[to_out(s) for s in rows])


@router.get(
    "/{id}",
    response_model=UserScriptOut,
    dependencies=[Depends(rate_limit("get"))],
)
async def get_script(
    id: uuid.UUID,
    session: SessionDep,
    user: OptionalUser,
    identity: Identity = Depends(get_identity),
) -> UserScriptOut:
    script = await session.get(UserScript, id)
    if script is None:
        raise not_found("script")

    # Access control
    if script.visibility == "private":
        if user is None:
            raise forbidden()
        # Verify ownership
        owner_ids = identity.owned_anon_ids if identity.account_id is not None else [user.id]
        if script.user_id not in owner_ids:
            raise forbidden()

    return to_out(script)


@router.patch(
    "/{id}",
    response_model=UserScriptOut,
    dependencies=[Depends(rate_limit("scripts"))],
)
async def update_script(
    id: uuid.UUID,
    body: UserScriptUpdate,
    user: CurrentWriter,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> UserScriptOut:
    script = await session.get(UserScript, id)
    if script is None:
        raise not_found("script")

    # Verify ownership
    owner_ids = identity.owned_anon_ids if identity.account_id is not None else [user.id]
    if script.user_id not in owner_ids:
        raise forbidden()

    if body.name is not None:
        script.name = body.name
    if body.source is not None:
        script.source = body.source
    if body.language is not None:
        script.language = body.language
    if body.visibility is not None:
        script.visibility = body.visibility

    await session.commit()
    await session.refresh(script)

    return to_out(script)


@router.delete(
    "/{id}",
    status_code=204,
    dependencies=[Depends(rate_limit("scripts"))],
)
async def delete_script(
    id: uuid.UUID,
    user: CurrentWriter,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> None:
    script = await session.get(UserScript, id)
    if script is None:
        raise not_found("script")

    # Verify ownership
    owner_ids = identity.owned_anon_ids if identity.account_id is not None else [user.id]
    if script.user_id not in owner_ids:
        raise forbidden()

    await session.delete(script)
    await session.commit()
