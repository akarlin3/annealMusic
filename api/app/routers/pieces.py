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
)
from app.models import Piece, PieceSegment
from app.schemas import (
    PieceCreate,
    PieceUpdate,
    PieceOut,
    PieceSegmentOut,
    PieceListOut,
)
from app.slug import new_slug

router = APIRouter(prefix="/api/v1/pieces", tags=["pieces"])


def to_out(piece: Piece, segments: list[PieceSegment]) -> PieceOut:
    return PieceOut(
        id=piece.id,
        schema_ver=piece.schema_ver,
        defaults_state=piece.defaults_state,
        title=piece.title,
        description=piece.description,
        visibility=piece.visibility,
        ai_description=piece.ai_description,
        total_duration_ms=piece.total_duration_ms,
        has_open_segment=piece.has_open_segment,
        created_at=piece.created_at,
        updated_at=piece.updated_at,
        short_slug=piece.short_slug,
        segments=[
            PieceSegmentOut(
                id=seg.id,
                position=seg.position,
                type=seg.type,
                duration_ms=seg.duration_ms,
                config=seg.config,
            )
            for seg in segments
        ],
    )


async def _resolve(session: AsyncSession, id_or_slug: str) -> Piece | None:
    try:
        pid = uuid.UUID(id_or_slug)
        piece = await session.get(Piece, pid)
        if piece is not None:
            return piece
    except ValueError:
        pass
    return (
        await session.execute(select(Piece).where(Piece.short_slug == id_or_slug))
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


@router.post(
    "", response_model=PieceOut, status_code=201,
    dependencies=[Depends(rate_limit("patches"))],
)
async def create_piece(
    body: PieceCreate,
    user: CurrentWriter,
    session: SessionDep,
) -> PieceOut:
    has_open = any(seg.type == "open" for seg in body.segments)
    total_duration = None
    if not has_open:
        total_duration = sum((seg.duration_ms or 0) for seg in body.segments)

    piece = Piece(
        user_id=user.id,
        schema_ver=body.schema_ver,
        defaults_state=body.defaults_state,
        title=body.title,
        description=body.description,
        visibility=body.visibility,
        total_duration_ms=total_duration,
        has_open_segment=has_open,
        short_slug=new_slug(),
    )
    session.add(piece)
    await session.flush()

    segments = []
    for pos, seg_in in enumerate(body.segments):
        seg = PieceSegment(
            piece_id=piece.id,
            position=pos,
            type=seg_in.type,
            duration_ms=seg_in.duration_ms,
            config=seg_in.config,
        )
        session.add(seg)
        segments.append(seg)

    await session.commit()
    await session.refresh(piece)
    return to_out(piece, segments)


@router.get("/me", response_model=PieceListOut,
            dependencies=[Depends(rate_limit("get"))])
async def list_my_pieces(
    user: CurrentUser,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> PieceListOut:
    if identity.account_id is not None:
        stmt = select(Piece).where(Piece.user_id.in_(identity.owned_anon_ids))
    else:
        stmt = select(Piece).where(Piece.user_id == user.id)
    if cursor:
        before = _decode_cursor(cursor)
        if before is not None:
            stmt = stmt.where(Piece.created_at < before)
    stmt = stmt.order_by(Piece.created_at.desc()).limit(limit + 1)
    rows = (await session.execute(stmt)).scalars().all()

    next_cursor = None
    if len(rows) > limit:
        rows = rows[:limit]
        next_cursor = _encode_cursor(rows[-1].created_at)

    if not rows:
        return PieceListOut(items=[], next_cursor=None)

    piece_ids = [p.id for p in rows]
    segments_stmt = select(PieceSegment).where(PieceSegment.piece_id.in_(piece_ids)).order_by(PieceSegment.position.asc())
    all_segs = (await session.execute(segments_stmt)).scalars().all()

    from collections import defaultdict
    segs_by_piece = defaultdict(list)
    for seg in all_segs:
        segs_by_piece[seg.piece_id].append(seg)

    items = [to_out(p, segs_by_piece[p.id]) for p in rows]
    return PieceListOut(items=items, next_cursor=next_cursor)


@router.get("/{id_or_slug}", response_model=PieceOut,
            dependencies=[Depends(rate_limit("get"))])
async def get_piece(
    id_or_slug: str,
    session: SessionDep,
) -> PieceOut:
    piece = await _resolve(session, id_or_slug)
    if piece is None:
        raise not_found("piece")
    if piece.visibility == "flagged":
        # parallel to patches under review check
        raise not_found("piece")

    segments_stmt = select(PieceSegment).where(PieceSegment.piece_id == piece.id).order_by(PieceSegment.position.asc())
    segments = (await session.execute(segments_stmt)).scalars().all()

    return to_out(piece, segments)


@router.patch("/{id}", response_model=PieceOut,
              dependencies=[Depends(rate_limit("patches"))])
async def update_piece(
    id: uuid.UUID,
    body: PieceUpdate,
    user: CurrentWriter,
    session: SessionDep,
) -> PieceOut:
    piece = await session.get(Piece, id)
    if piece is None:
        raise not_found("piece")
    if piece.user_id != user.id:
        raise forbidden()

    if body.title is not None:
        piece.title = body.title
    if body.description is not None:
        piece.description = body.description
    if body.visibility is not None:
        piece.visibility = body.visibility
    if body.defaults_state is not None:
        piece.defaults_state = body.defaults_state

    if body.segments is not None:
        # Delete old segments
        await session.execute(
            delete(PieceSegment).where(PieceSegment.piece_id == piece.id)
        )

        # Add new segments
        has_open = any(seg.type == "open" for seg in body.segments)
        total_duration = None
        if not has_open:
            total_duration = sum((seg.duration_ms or 0) for seg in body.segments)

        piece.has_open_segment = has_open
        piece.total_duration_ms = total_duration

        segments = []
        for pos, seg_in in enumerate(body.segments):
            seg = PieceSegment(
                piece_id=piece.id,
                position=pos,
                type=seg_in.type,
                duration_ms=seg_in.duration_ms,
                config=seg_in.config,
            )
            session.add(seg)
            segments.append(seg)
    else:
        segments_stmt = select(PieceSegment).where(PieceSegment.piece_id == piece.id).order_by(PieceSegment.position.asc())
        segments = (await session.execute(segments_stmt)).scalars().all()

    await session.commit()
    await session.refresh(piece)
    return to_out(piece, segments)


@router.delete("/{id}", status_code=204,
               dependencies=[Depends(rate_limit("patches"))])
async def delete_piece(
    id: uuid.UUID,
    user: CurrentWriter,
    session: SessionDep,
) -> None:
    piece = await session.get(Piece, id)
    if piece is None:
        raise not_found("piece")
    if piece.user_id != user.id:
        raise forbidden()

    await session.delete(piece)
    await session.commit()
