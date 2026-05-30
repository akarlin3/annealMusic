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
    defaults = piece.defaults_state or {}
    # Filter out hidden internal keys (prefixed by "_") from defaults_state response
    clean_defaults = {k: v for k, v in defaults.items() if not k.startswith("_")}

    return PieceOut(
        id=piece.id,
        schema_ver=piece.schema_ver,
        defaults_state=clean_defaults,
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
                config={k: v for k, v in (seg.config or {}).items() if k != "_variations"},
                variations=seg.config.get("_variations") if isinstance(seg.config, dict) else None,
            )
            for seg in segments
        ],
        movements=defaults.get("_movements"),
        tempo_bpm=defaults.get("_tempo_bpm"),
        notation=defaults.get("_notation"),
        variation_seed=defaults.get("_variation_seed"),
        variations=defaults.get("_variations"),
        automation_tracks=defaults.get("_automation_tracks"),
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

    # Store movements, tempo, notation, variations, and automation_tracks in defaults_state
    defaults_state = {
        **body.defaults_state,
        "_movements": body.movements,
        "_tempo_bpm": body.tempo_bpm,
        "_notation": body.notation,
        "_variation_seed": body.variation_seed,
        "_variations": body.variations,
        "_automation_tracks": body.automation_tracks,
    }

    piece = Piece(
        user_id=user.id,
        schema_ver=body.schema_ver,
        defaults_state=defaults_state,
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
        # Store segment-level variations inside config
        config = {**(seg_in.config or {})}
        if seg_in.variations is not None:
            config["_variations"] = seg_in.variations

        seg = PieceSegment(
            piece_id=piece.id,
            position=pos,
            type=seg_in.type,
            duration_ms=seg_in.duration_ms,
            config=config,
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
    
    # Update defaults_state keeping existing hidden attributes unless overwritten
    defaults_state = piece.defaults_state or {}
    if body.defaults_state is not None:
        defaults_state = {**body.defaults_state}
    
    # Selectively update hidden attributes if provided in update body
    if body.movements is not None:
        defaults_state["_movements"] = body.movements
    if body.tempo_bpm is not None:
        defaults_state["_tempo_bpm"] = body.tempo_bpm
    if body.notation is not None:
        defaults_state["_notation"] = body.notation
    if body.variation_seed is not None:
        defaults_state["_variation_seed"] = body.variation_seed
    if body.variations is not None:
        defaults_state["_variations"] = body.variations
    if body.automation_tracks is not None:
        defaults_state["_automation_tracks"] = body.automation_tracks

    piece.defaults_state = defaults_state

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
            # Store segment-level variations inside config
            config = {**(seg_in.config or {})}
            if seg_in.variations is not None:
                config["_variations"] = seg_in.variations

            seg = PieceSegment(
                piece_id=piece.id,
                position=pos,
                type=seg_in.type,
                duration_ms=seg_in.duration_ms,
                config=config,
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
