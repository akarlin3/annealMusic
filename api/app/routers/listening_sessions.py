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

    creator_name, creator_avatar_seed = await _get_creator_info(session, ls.user_id)

    return ListeningSessionOut(
        id=ls.id,
        user_id=ls.user_id,
        piece_id=ls.piece_id,
        schema_ver=ls.schema_ver,
        title=ls.title,
        description=ls.description,
        intention=ls.intention,
        length_category=ls.length_category,
        recommended_environment=ls.recommended_environment,
        settle_in_ms=ls.settle_in_ms,
        integration_ms=ls.integration_ms,
        opening_tone=ls.opening_tone,
        closing_tone=ls.closing_tone,
        total_duration_ms=ls.total_duration_ms,
        visibility=ls.visibility,
        short_slug=ls.short_slug,
        created_at=ls.created_at,
        updated_at=ls.updated_at,
        piece=piece_out,
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


def _calc_total_duration(piece: Piece | None, opening_tone: bool, closing_tone: bool) -> int | None:
    if piece is None or piece.total_duration_ms is None:
        return None
    bell_ms = 4000
    duration = piece.total_duration_ms
    if opening_tone:
        duration += bell_ms
    if closing_tone:
        duration += bell_ms
    return duration


@router.post(
    "", response_model=ListeningSessionOut, status_code=201,
    dependencies=[Depends(rate_limit("patches"))],
)
async def create_listening_session(
    body: ListeningSessionCreate,
    user: CurrentWriter,
    session: SessionDep,
) -> ListeningSessionOut:
    piece = await session.get(Piece, body.piece_id)
    if piece is None:
        raise not_found("piece")
    if piece.visibility == "flagged":
        raise not_found("piece")
    if piece.user_id != user.id and piece.visibility != "public":
        raise forbidden("Referenced piece must be public or owned by you")

    total_duration = _calc_total_duration(piece, body.opening_tone, body.closing_tone)

    ls = ListeningSession(
        user_id=user.id,
        piece_id=body.piece_id,
        schema_ver=body.schema_ver,
        title=body.title,
        description=body.description,
        intention=body.intention,
        length_category=body.length_category,
        recommended_environment=body.recommended_environment,
        settle_in_ms=body.settle_in_ms,
        integration_ms=body.integration_ms,
        opening_tone=body.opening_tone,
        closing_tone=body.closing_tone,
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

    if body.piece_id is not None:
        piece = await session.get(Piece, body.piece_id)
        if piece is None:
            raise not_found("piece")
        if piece.visibility == "flagged":
            raise not_found("piece")
        if piece.user_id != user.id and piece.visibility != "public":
            raise forbidden("Referenced piece must be public or owned by you")
        ls.piece_id = body.piece_id

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
    if body.opening_tone is not None:
        ls.opening_tone = body.opening_tone
    if body.closing_tone is not None:
        ls.closing_tone = body.closing_tone
    if body.visibility is not None:
        ls.visibility = body.visibility

    # Recalculate total duration
    piece = None
    if ls.piece_id is not None:
        piece = await session.get(Piece, ls.piece_id)
    ls.total_duration_ms = _calc_total_duration(piece, ls.opening_tone, ls.closing_tone)

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
