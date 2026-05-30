from __future__ import annotations

import base64
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, BackgroundTasks
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import select, delete

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.deps import (
    CurrentUser,
    CurrentWriter,
    SessionDep,
    rate_limit,
    Identity,
    get_identity,
    OptionalUser,
    StorageDep,
)
from app.errors import (
    forbidden,
    not_found,
    quota_exceeded,
    content_rejected,
    requires_source_consent,
)
from app.models import Piece, PieceSegment, UserSource
from app.moderation import screen_publish
from app.schemas import (
    PieceCreate,
    PieceUpdate,
    PieceOut,
    PieceSegmentOut,
    PieceListOut,
)
from app.slug import new_slug

logger = logging.getLogger("pieces")
router = APIRouter(prefix="/api/v1/pieces", tags=["pieces"])


def to_out(piece: Piece, segments: list[PieceSegment], liked_by_me: bool = False) -> PieceOut:
    defaults = piece.defaults_state or {}
    clean_defaults = {k: v for k, v in defaults.items() if not k.startswith("_")}

    return PieceOut(
        id=piece.id,
        schema_ver=piece.schema_ver,
        defaults_state=clean_defaults,
        title=piece.title,
        description=piece.description,
        visibility=piece.visibility,  # type: ignore[arg-type]
        ai_description=piece.ai_description,
        ai_description_source=piece.ai_description_source,
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
        like_count=piece.like_count,
        liked_by_me=liked_by_me,
        load_count=piece.load_count,
        preview_status=piece.preview_status,  # type: ignore[arg-type]
        preview_duration_ms=piece.preview_duration_ms,
        preview_slice_start_ms=piece.preview_slice_start_ms,
        has_captures=piece.has_captures,
    )


def extract_user_sources_from_dict(d: Any) -> list[uuid.UUID]:
    ids = []
    if isinstance(d, dict):
        for k, v in d.items():
            if isinstance(v, str) and v.startswith("u:"):
                try:
                    ids.append(uuid.UUID(v[2:]))
                except ValueError:
                    pass
            else:
                ids.extend(extract_user_sources_from_dict(v))
    elif isinstance(d, list):
        for v in d:
            ids.extend(extract_user_sources_from_dict(v))
    return ids


def extract_user_sources_from_piece(defaults_state: dict, segments: list[Any]) -> list[uuid.UUID]:
    ids = []
    ids.extend(extract_user_sources_from_dict(defaults_state))
    for seg in segments:
        ids.extend(extract_user_sources_from_dict(getattr(seg, "config", {})))
    return list(set(ids))


def _publish(piece: Piece, request: Request) -> None:
    if piece.published_at is None:
        piece.published_at = datetime.now(tz=timezone.utc)
    piece.preview_status = "rendering"
    request.app.state.render_queue.enqueue(piece.id)


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
    request: Request,
    background_tasks: BackgroundTasks,
) -> PieceOut:
    settings = get_settings()
    if user.piece_count >= settings.quota_pieces:
        raise quota_exceeded("pieces", settings.quota_pieces)

    if body.visibility == "public":
        rejected = screen_publish(body.title, body.description)
        if rejected:
            raise content_rejected(rejected)

    # Bind and verify user sources referenced in the piece segments / defaults
    referenced_source_ids = extract_user_sources_from_piece(body.defaults_state, body.segments)
    loaded_sources: list[UserSource] = []
    if referenced_source_ids:
        stmt = select(UserSource).where(UserSource.id.in_(referenced_source_ids))
        loaded_sources = (await session.execute(stmt)).scalars().all()
        loaded_ids = {s.id for s in loaded_sources}
        for sid in referenced_source_ids:
            if sid not in loaded_ids:
                raise not_found("user_source")
        for src in loaded_sources:
            if src.user_id != user.id and src.visibility != "shared":
                raise forbidden()

    # Consent and transition check for public pieces
    if body.visibility == "public" and loaded_sources:
        owned_unlisted = [s for s in loaded_sources if s.user_id == user.id and s.visibility == "unlisted"]
        if owned_unlisted:
            if not body.acknowledge_source_visibility:
                raise requires_source_consent()
            for src in owned_unlisted:
                src.visibility = "shared"
                logger.info("Transitioned user source %s visibility to shared due to piece publication", src.id)

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
        has_captures=bool(referenced_source_ids),
    )
    session.add(piece)
    await session.flush()

    segments = []
    for pos, seg_in in enumerate(body.segments):
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

    if body.visibility == "public":
        _publish(piece, request)

    user.piece_count += 1
    await session.commit()
    await session.refresh(piece)

    if body.visibility == "public":
        from app.db import get_sessionmaker
        background_tasks.add_task(
            embed_piece_task,
            piece.id,
            get_sessionmaker(),
            request.app.state.llm,
            request.app.state.embeddings
        )

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

    liked_piece_ids = set()
    if user:
        from app.models import Like
        likes_stmt = select(Like.target_id).where(Like.user_id == user.id, Like.target_kind == "piece")
        likes_res = await session.execute(likes_stmt)
        liked_piece_ids = set(likes_res.scalars().all())

    items = [to_out(p, segs_by_piece[p.id], liked_by_me=p.id in liked_piece_ids) for p in rows]
    return PieceListOut(items=items, next_cursor=next_cursor)


@router.get("/{id_or_slug}", response_model=PieceOut,
            dependencies=[Depends(rate_limit("get"))])
async def get_piece(
    id_or_slug: str,
    session: SessionDep,
    user: OptionalUser,
) -> PieceOut:
    piece = await _resolve(session, id_or_slug)
    if piece is None:
        raise not_found("piece")
    if piece.visibility == "flagged":
        raise not_found("piece")

    segments_stmt = select(PieceSegment).where(PieceSegment.piece_id == piece.id).order_by(PieceSegment.position.asc())
    segments = (await session.execute(segments_stmt)).scalars().all()

    liked_by_me = False
    if user:
        from app.models import Like
        stmt = select(Like).where(Like.user_id == user.id, Like.target_kind == "piece", Like.target_id == piece.id)
        res = await session.execute(stmt)
        liked_by_me = res.scalar_one_or_none() is not None

    return to_out(piece, segments, liked_by_me=liked_by_me)


@router.get("/{id_or_slug}/preview", dependencies=[Depends(rate_limit("get"))])
async def get_preview(
    id_or_slug: str, request: Request, session: SessionDep, storage: StorageDep
):
    """Stream the audio thumbnail of the piece."""
    piece = await _resolve(session, id_or_slug)
    if piece is None or piece.visibility != "public":
        raise not_found("preview")

    if piece.preview_status == "ready" and piece.preview_storage_key:
        url = await storage.presigned_get_url(piece.preview_storage_key)
        return RedirectResponse(
            url=url, status_code=302,
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )
    if piece.preview_status == "failed":
        return JSONResponse(
            status_code=503, content={"error": "preview_failed"},
            headers={"Cache-Control": "no-store"},
        )
    # none or rendering -> enqueue render
    request.app.state.render_queue.enqueue(piece.id)
    return JSONResponse(
        status_code=202, content={"status": "rendering"},
        headers={"Cache-Control": "no-store"},
    )


@router.patch("/{id}", response_model=PieceOut,
              dependencies=[Depends(rate_limit("patches"))])
async def update_piece(
    id: uuid.UUID,
    body: PieceUpdate,
    user: CurrentWriter,
    session: SessionDep,
    request: Request,
    background_tasks: BackgroundTasks,
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

    going_public = body.visibility == "public" and piece.visibility != "public"
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

    # Manage user sources consent if public
    if going_public:
        if body.segments is not None:
            active_segments = body.segments
        else:
            segments_stmt = select(PieceSegment).where(PieceSegment.piece_id == piece.id).order_by(PieceSegment.position.asc())
            active_segments = (await session.execute(segments_stmt)).scalars().all()
        referenced_source_ids = extract_user_sources_from_piece(defaults_state, active_segments)
        if referenced_source_ids:
            stmt = select(UserSource).where(UserSource.id.in_(referenced_source_ids))
            loaded_sources = (await session.execute(stmt)).scalars().all()
            owned_unlisted = [s for s in loaded_sources if s.user_id == user.id and s.visibility == "unlisted"]
            if owned_unlisted:
                if not body.acknowledge_source_visibility:
                    raise requires_source_consent()
                for src in owned_unlisted:
                    src.visibility = "shared"
                    logger.info("Transitioned user source %s visibility to shared due to piece publication update", src.id)

        rejected = screen_publish(piece.title, piece.description)
        if rejected:
            raise content_rejected(rejected)
        _publish(piece, request)

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

    # Re-evaluate captures flag based on user sources
    referenced_source_ids = extract_user_sources_from_piece(defaults_state, segments)
    piece.has_captures = bool(referenced_source_ids)

    description_changed = body.description is not None and body.description != piece.description

    await session.commit()
    await session.refresh(piece)

    if going_public or (piece.visibility == "public" and description_changed):
        from app.db import get_sessionmaker
        background_tasks.add_task(
            embed_piece_task,
            piece.id,
            get_sessionmaker(),
            request.app.state.llm,
            request.app.state.embeddings
        )

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


async def embed_piece_task(
    piece_id: uuid.UUID,
    session_maker: Any,
    llm: Any,
    embeddings: Any,
) -> None:
    """Background task to generate AI description and embeddings for a public piece."""
    async with session_maker() as session:
        piece = await session.get(Piece, piece_id)
        if not piece or piece.visibility != "public":
            return

        if not piece.description:
            try:
                from app.routers.ai import generate_ai_piece_description_internal
                desc = await generate_ai_piece_description_internal(piece, llm)
                piece.description = desc
                piece.ai_description = desc
                piece.ai_description_source = "ai"
                await session.flush()
            except Exception:
                logger.error("Failed to generate AI description in background for piece %s", piece_id, exc_info=True)
                return

        # Generate embedding for the description
        try:
            vector = await embeddings.embed(piece.description)
            piece.ai_description_embedding = vector
            await session.commit()
            logger.info("Successfully generated and saved embedding for piece %s", piece_id)
        except Exception:
            logger.error("Failed to generate embedding in background for piece %s", piece_id, exc_info=True)
