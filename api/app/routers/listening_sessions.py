from __future__ import annotations

import base64
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select, delete

from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import (
    CurrentUser,
    CurrentWriter,
    SessionDep,
    rate_limit,
    Identity,
    get_identity,
)
from app.errors import (
    forbidden,
    not_found,
    bad_request,
)
from app.models import ListeningSession, Piece, User, Account
from app.schemas import (
    ListeningSessionCreate,
    ListeningSessionUpdate,
    ListeningSessionOut,
    ListeningSessionListOut,
)
from app.slug import new_slug
from app.routers.pieces import to_out as piece_to_out


router = APIRouter(prefix="/api/v1/listening-sessions", tags=["listening-sessions"])


async def _get_creator_info(session: AsyncSession, user_id: uuid.UUID) -> tuple[str | None, str | None]:
    stmt = (
        select(Account.display_name, Account.avatar_seed)
        .select_from(User)
        .join(Account, User.account_id == Account.id)
        .where(User.id == user_id)
    )
    res = (await session.execute(stmt)).first()
    if res:
        return res[0], res[1]
    return None, None


async def to_out(
    session: AsyncSession,
    ls: ListeningSession,
) -> ListeningSessionOut:
    piece_out = None
    piece_creator_name = None
    patch_out = None
    
    if ls.piece_id is not None:
        piece = await session.get(Piece, ls.piece_id)
        if piece is not None and piece.visibility != "flagged":
            from app.models import PieceSegment
            segments_stmt = select(PieceSegment).where(PieceSegment.piece_id == piece.id).order_by(PieceSegment.position.asc())
            segments = (await session.execute(segments_stmt)).scalars().all()
            piece_out = piece_to_out(piece, segments)
            
            # Get Piece creator name
            p_creator_name, _ = await _get_creator_info(session, piece.user_id)
            piece_creator_name = p_creator_name

    if ls.patch_id is not None:
        patch = await session.get(Patch, ls.patch_id)
        if patch is not None and patch.visibility != "flagged":
            from app.routers.patches import to_out as patch_to_out
            patch_out = patch_to_out(patch)

    creator_name, creator_avatar_seed = await _get_creator_info(session, ls.user_id)

    return ListeningSessionOut(
        id=ls.id,
        user_id=ls.user_id,
        piece_id=ls.piece_id,
        patch_id=ls.patch_id,
        schema_ver=ls.schema_ver,
        title=ls.title,
        description=ls.description,
        intention=ls.intention,
        length_category=ls.length_category,
        recommended_environment=ls.recommended_environment,
        settle_in_ms=ls.settle_in_ms,
        integration_ms=ls.integration_ms,
        bell_schedule=ls.bell_schedule,
        breath_pattern=ls.breath_pattern,
        total_duration_ms=ls.total_duration_ms,
        visibility=ls.visibility,
        short_slug=ls.short_slug,
        created_at=ls.created_at,
        updated_at=ls.updated_at,
        piece=piece_out,
        patch=patch_out,
        creator_name=creator_name,
        creator_avatar_seed=creator_avatar_seed,
        piece_creator_name=piece_creator_name,
    )


async def _resolve(session: AsyncSession, id_or_slug: str) -> ListeningSession | None:
    try:
        ls_id = uuid.UUID(id_or_slug)
        ls = await session.get(ListeningSession, ls_id)
        if ls is not None:
            return ls
    except ValueError:
        pass
    return (
        await session.execute(select(ListeningSession).where(ListeningSession.short_slug == id_or_slug))
    ).scalar_one_or_none()


def _encode_cursor(dt: datetime) -> str:
    return base64.urlsafe_b64encode(dt.isoformat().encode()).decode()


def _decode_cursor(cursor: str) -> datetime | None:
    try:
        return datetime.fromisoformat(
            base64.urlsafe_b64decode(cursor.encode()).decode()
        )
    except (ValueError, TypeError):
        return None


def _calc_total_duration(piece: Piece | None) -> int | None:
    if piece is None or piece.total_duration_ms is None:
        return None
    return piece.total_duration_ms


@router.post(
    "", response_model=ListeningSessionOut, status_code=201,
    dependencies=[Depends(rate_limit("patches"))],
)
async def create_listening_session(
    body: ListeningSessionCreate,
    user: CurrentWriter,
    session: SessionDep,
) -> ListeningSessionOut:
    if (body.piece_id is not None) == (body.patch_id is not None):
        raise bad_request("Exactly one of piece_id or patch_id must be provided")

    total_duration = None

    if body.piece_id is not None:
        piece = await session.get(Piece, body.piece_id)
        if piece is None or piece.visibility == "flagged":
            raise not_found("piece")
        if piece.user_id != user.id and piece.visibility != "public":
            raise forbidden("Referenced piece must be public or owned by you")
        total_duration = _calc_total_duration(piece)
    else:
        from app.models import Patch
        patch = await session.get(Patch, body.patch_id)
        if patch is None or patch.visibility == "flagged":
            raise not_found("patch")
        if patch.user_id != user.id and patch.visibility != "public":
            raise forbidden("Referenced patch must be public or owned by you")
        if patch.mode != "drone":
            raise bad_request("Referenced patch must be a drone patch")
        
        # Calculate drone duration based on length category
        drone_duration = 30 * 60 * 1000 # default to 30 mins
        if body.length_category == "short":
            drone_duration = 10 * 60 * 1000
        elif body.length_category == "medium":
            drone_duration = 20 * 60 * 1000
        elif body.length_category == "long":
            drone_duration = 30 * 60 * 1000
        elif body.length_category == "extended":
            drone_duration = 60 * 60 * 1000
        
        total_duration = drone_duration

    ls = ListeningSession(
        user_id=user.id,
        piece_id=body.piece_id,
        patch_id=body.patch_id,
        schema_ver=body.schema_ver,
        title=body.title,
        description=body.description,
        intention=body.intention,
        length_category=body.length_category,
        recommended_environment=body.recommended_environment,
        settle_in_ms=body.settle_in_ms,
        integration_ms=body.integration_ms,
        bell_schedule=body.bell_schedule,
        breath_pattern=body.breath_pattern,
        total_duration_ms=total_duration,
        visibility=body.visibility,
        short_slug=new_slug(),
    )
    session.add(ls)
    await session.commit()
    await session.refresh(ls)

    return await to_out(session, ls)


@router.get("/{id_or_slug}", response_model=ListeningSessionOut,
            dependencies=[Depends(rate_limit("get"))])
async def get_listening_session(
    id_or_slug: str,
    session: SessionDep,
) -> ListeningSessionOut:
    ls = await _resolve(session, id_or_slug)
    if ls is None:
        raise not_found("listening_session")
    if ls.visibility == "flagged":
        raise not_found("listening_session")
        
    return await to_out(session, ls)


@router.patch("/{id}", response_model=ListeningSessionOut,
              dependencies=[Depends(rate_limit("patches"))])
async def update_listening_session(
    id: uuid.UUID,
    body: ListeningSessionUpdate,
    user: CurrentWriter,
    session: SessionDep,
) -> ListeningSessionOut:
    ls = await session.get(ListeningSession, id)
    if ls is None:
        raise not_found("listening_session")
    if ls.user_id != user.id:
        raise forbidden()

    if body.piece_id is not None and body.patch_id is not None:
        raise bad_request("Exactly one of piece_id or patch_id must be provided")

    if body.piece_id is not None:
        piece = await session.get(Piece, body.piece_id)
        if piece is None or piece.visibility == "flagged":
            raise not_found("piece")
        if piece.user_id != user.id and piece.visibility != "public":
            raise forbidden("Referenced piece must be public or owned by you")
        ls.piece_id = body.piece_id
        ls.patch_id = None
    elif body.patch_id is not None:
        from app.models import Patch
        patch = await session.get(Patch, body.patch_id)
        if patch is None or patch.visibility == "flagged":
            raise not_found("patch")
        if patch.user_id != user.id and patch.visibility != "public":
            raise forbidden("Referenced patch must be public or owned by you")
        if patch.mode != "drone":
            raise bad_request("Referenced patch must be a drone patch")
        ls.patch_id = body.patch_id
        ls.piece_id = None

    if body.title is not None:
        ls.title = body.title
    if body.description is not None:
        ls.description = body.description
    if body.intention is not None:
        ls.intention = body.intention
    if body.length_category is not None:
        ls.length_category = body.length_category
    if body.recommended_environment is not None:
        ls.recommended_environment = body.recommended_environment
    if body.settle_in_ms is not None:
        ls.settle_in_ms = body.settle_in_ms
    if body.integration_ms is not None:
        ls.integration_ms = body.integration_ms
    if body.bell_schedule is not None:
        ls.bell_schedule = body.bell_schedule
    # Allow explicit null to clear the breath pattern (presence, not non-None).
    if "breath_pattern" in body.model_fields_set:
        ls.breath_pattern = body.breath_pattern
    if body.visibility is not None:
        ls.visibility = body.visibility

    # Recalculate total duration
    if ls.piece_id is not None:
        piece = await session.get(Piece, ls.piece_id)
        ls.total_duration_ms = _calc_total_duration(piece)
    elif ls.patch_id is not None:
        # Calculate drone duration based on length category
        drone_duration = 30 * 60 * 1000 # default to 30 mins
        if ls.length_category == "short":
            drone_duration = 10 * 60 * 1000
        elif ls.length_category == "medium":
            drone_duration = 20 * 60 * 1000
        elif ls.length_category == "long":
            drone_duration = 30 * 60 * 1000
        elif ls.length_category == "extended":
            drone_duration = 60 * 60 * 1000
        
        ls.total_duration_ms = drone_duration
    else:
        ls.total_duration_ms = None

    await session.commit()
    await session.refresh(ls)

    return await to_out(session, ls)


@router.delete("/{id}", status_code=204,
               dependencies=[Depends(rate_limit("patches"))])
async def delete_listening_session(
    id: uuid.UUID,
    user: CurrentWriter,
    session: SessionDep,
) -> None:
    ls = await session.get(ListeningSession, id)
    if ls is None:
        raise not_found("listening_session")
    if ls.user_id != user.id:
        raise forbidden()

    await session.delete(ls)
    await session.commit()


@router.get("/me", response_model=ListeningSessionListOut,
            dependencies=[Depends(rate_limit("get"))])
async def list_my_listening_sessions(
    user: CurrentUser,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> ListeningSessionListOut:
    if identity.account_id is not None:
        stmt = select(ListeningSession).where(ListeningSession.user_id.in_(identity.owned_anon_ids))
    else:
        stmt = select(ListeningSession).where(ListeningSession.user_id == user.id)
        
    if cursor:
        before = _decode_cursor(cursor)
        if before is not None:
            stmt = stmt.where(ListeningSession.created_at < before)
            
    stmt = stmt.order_by(ListeningSession.created_at.desc()).limit(limit + 1)
    rows = (await session.execute(stmt)).scalars().all()

    next_cursor = None
    if len(rows) > limit:
        rows = rows[:limit]
        next_cursor = _encode_cursor(rows[-1].created_at)

    if not rows:
        return ListeningSessionListOut(items=[], next_cursor=None)

    items = []
    for ls in rows:
        items.append(await to_out(session, ls))

    return ListeningSessionListOut(items=items, next_cursor=next_cursor)
