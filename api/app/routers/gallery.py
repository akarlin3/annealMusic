"""Public gallery: browse `visibility='public'` patches and pieces with sort, filter,
full-text search, and keyset cursor pagination. No auth required."""

from __future__ import annotations

import base64
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import SessionDep, rate_limit, OptionalUser, get_identity, Identity, get_blocked_user_ids
from app.errors import bad_request
from app.models import Patch, Piece, Like
from app.schemas import GalleryItemOut, GalleryListOut, GallerySort, PreviewStatus

router = APIRouter(prefix="/api/v1/gallery", tags=["gallery"])

PAGE_DEFAULT = 24
PAGE_MAX = 48


def _to_item(
    p: Patch,
    creator_name: str | None,
    creator_avatar_seed: str | None,
    creator_id: uuid.UUID | None,
    liked_by_me: bool = False,
) -> GalleryItemOut:
    return GalleryItemOut(
        id=p.id,
        short_slug=p.short_slug,
        title=p.title,
        description=p.description,
        state=(p.state or {}).get("payload", ""),
        engine=p.engine,
        mode=p.mode,
        has_captures=p.has_captures,
        load_count=p.load_count,
        published_at=p.published_at,
        preview_status=p.preview_status,  # type: ignore[arg-type]
        preview_duration_ms=p.preview_duration_ms,
        creator_name=creator_name,
        creator_avatar_seed=creator_avatar_seed,
        creator_id=creator_id,
        ai_description=p.ai_description,
        ai_description_source=p.ai_description_source,
        like_count=p.like_count,
        liked_by_me=liked_by_me,
        kind="patch",
        movements_count=None,
    )


def _to_piece_item(
    p: Piece,
    creator_name: str | None,
    creator_avatar_seed: str | None,
    creator_id: uuid.UUID | None,
    liked_by_me: bool = False,
) -> GalleryItemOut:
    # Reconstruct flat state parameters to drive the card visual correctly
    params = p.defaults_state.get("params", {})
    engine_id = p.defaults_state.get("engineId", "sine")
    flat_parts = ["kind=piece", f"e={engine_id}"]
    for k, v in params.items():
        if not k.startswith("_"):
            flat_parts.append(f"{k}={v}")
    state_str = "&".join(flat_parts)

    movements = p.defaults_state.get("_movements") or []
    movements_count = len(movements) if isinstance(movements, list) else 0

    return GalleryItemOut(
        id=p.id,
        short_slug=p.short_slug,
        title=p.title,
        description=p.description,
        state=state_str,
        engine=engine_id,
        mode="piece",
        has_captures=p.has_captures,
        load_count=p.load_count,
        published_at=p.published_at,
        preview_status=p.preview_status,  # type: ignore[arg-type]
        preview_duration_ms=p.preview_duration_ms,
        creator_name=creator_name,
        creator_avatar_seed=creator_avatar_seed,
        creator_id=creator_id,
        ai_description=p.ai_description,
        ai_description_source=p.ai_description_source,
        like_count=p.like_count,
        liked_by_me=liked_by_me,
        kind="piece",
        movements_count=movements_count,
    )


def _encode_cursor(sort: str, keys: list[Any]) -> str:
    raw = json.dumps({"s": sort, "k": keys}).encode()
    return base64.urlsafe_b64encode(raw).decode()


def _decode_cursor(cursor: str, sort: str) -> list[Any]:
    try:
        data = json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
    except (ValueError, TypeError):
        raise bad_request("malformed cursor")
    if data.get("s") != sort:
        raise bad_request("cursor does not match sort")
    return data["k"]


def _search_clause(model: type[Patch] | type[Piece], q: str, dialect: str):
    """Postgres: full-text (title weighted over description). SQLite: LIKE."""
    if dialect == "postgresql":
        vector = func.to_tsvector(
            "english",
            func.coalesce(model.title, "") + " " + func.coalesce(model.description, ""),
        )
        return vector.op("@@")(func.plainto_tsquery("english", q))
    like = f"%{q}%"
    return or_(
        func.coalesce(model.title, "").ilike(like),
        func.coalesce(model.description, "").ilike(like),
    )


@router.get("", response_model=GalleryListOut,
            dependencies=[Depends(rate_limit("get"))])
async def list_gallery(
    session: SessionDep,
    response: Response,
    user: OptionalUser,
    identity: Identity = Depends(get_identity),
    sort: GallerySort = Query(default="newest"),
    type: Literal["both", "patches", "pieces"] = Query(default="both"),
    engine: str | None = Query(default=None),
    mode: str | None = Query(default=None),
    has_captures: bool | None = Query(default=None),
    followed_only: bool = Query(default=False),
    q: str | None = Query(default=None, max_length=128),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=PAGE_DEFAULT, ge=1, le=PAGE_MAX),
) -> GalleryListOut:
    dialect = session.bind.dialect.name if session.bind is not None else "sqlite"
    from app.models import User, Account

    blocked_user_ids = await get_blocked_user_ids(session, identity.account_id)

    # 1. Fetch Patches if requested
    patches_rows = []
    if type in ("both", "patches"):
        p_stmt = (
            select(Patch, Account.display_name, Account.avatar_seed, Account.id)
            .outerjoin(User, User.id == Patch.user_id)
            .outerjoin(Account, Account.id == User.account_id)
            .where(Patch.visibility == "public")
        )
        if blocked_user_ids:
            p_stmt = p_stmt.where(~Patch.user_id.in_(blocked_user_ids))

        if followed_only:
            if identity.account_id is None:
                raise bad_request("You must be logged in to filter by followed accounts.")
            from app.models import Follow
            followed_subq = select(Follow.followed_account_id).where(
                Follow.follower_account_id == identity.account_id
            )
            followed_users_subq = select(User.id).where(User.account_id.in_(followed_subq))
            p_stmt = p_stmt.where(Patch.user_id.in_(followed_users_subq))

        if engine:
            p_stmt = p_stmt.where(Patch.engine == engine)
        if mode:
            p_stmt = p_stmt.where(Patch.mode == mode)
        if has_captures is not None:
            p_stmt = p_stmt.where(Patch.has_captures.is_(has_captures))
        if q:
            p_stmt = p_stmt.where(_search_clause(Patch, q, dialect))

        # Keyset sorting constraints
        if sort == "most_loaded":
            order = (Patch.load_count.desc(), Patch.published_at.desc(), Patch.id.desc())
            if cursor:
                lc, pub, pid = _decode_cursor(cursor, sort)
                p_stmt = p_stmt.where(
                    _tuple_lt(
                        (Patch.load_count, Patch.published_at, cast(Patch.id, String)),
                        (lc, _parse_pub(pub), pid),
                    )
                )
        elif sort == "most_liked":
            order = (Patch.like_count.desc(), Patch.published_at.desc(), Patch.id.desc())
            if cursor:
                lc, pub, pid = _decode_cursor(cursor, sort)
                p_stmt = p_stmt.where(
                    _tuple_lt(
                        (Patch.like_count, Patch.published_at, cast(Patch.id, String)),
                        (lc, _parse_pub(pub), pid),
                    )
                )
        elif sort == "oldest":
            order = (Patch.published_at.asc(), Patch.id.asc())
            if cursor:
                pub, pid = _decode_cursor(cursor, sort)
                p_stmt = p_stmt.where(
                    _tuple_gt(
                        (Patch.published_at, cast(Patch.id, String)),
                        (_parse_pub(pub), pid),
                    )
                )
        else:  # newest
            order = (Patch.published_at.desc(), Patch.id.desc())
            if cursor:
                pub, pid = _decode_cursor(cursor, sort)
                p_stmt = p_stmt.where(
                    _tuple_lt(
                        (Patch.published_at, cast(Patch.id, String)),
                        (_parse_pub(pub), pid),
                    )
                )

        p_stmt = p_stmt.order_by(*order).limit(limit + 1)
        patches_rows = (await session.execute(p_stmt)).all()

    # 2. Fetch Pieces if requested
    pieces_rows = []
    # If user filtered by a specific mode other than "piece", pieces won't match anyway
    if type in ("both", "pieces") and (mode is None or mode == "piece"):
        p_stmt = (
            select(Piece, Account.display_name, Account.avatar_seed, Account.id)
            .outerjoin(User, User.id == Piece.user_id)
            .outerjoin(Account, Account.id == User.account_id)
            .where(Piece.visibility == "public")
        )
        if blocked_user_ids:
            p_stmt = p_stmt.where(~Piece.user_id.in_(blocked_user_ids))

        if followed_only:
            if identity.account_id is None:
                raise bad_request("You must be logged in to filter by followed accounts.")
            from app.models import Follow
            followed_subq = select(Follow.followed_account_id).where(
                Follow.follower_account_id == identity.account_id
            )
            followed_users_subq = select(User.id).where(User.account_id.in_(followed_subq))
            p_stmt = p_stmt.where(Piece.user_id.in_(followed_users_subq))

        if engine:
            if dialect == "postgresql":
                p_stmt = p_stmt.where(Piece.defaults_state["engineId"].astext == engine)
            else:
                p_stmt = p_stmt.where(func.json_extract(Piece.defaults_state, "$.engineId") == engine)

        if has_captures is not None:
            p_stmt = p_stmt.where(Piece.has_captures.is_(has_captures))
        if q:
            p_stmt = p_stmt.where(_search_clause(Piece, q, dialect))

        # Keyset sorting constraints
        if sort == "most_loaded":
            order = (Piece.load_count.desc(), Piece.published_at.desc(), Piece.id.desc())
            if cursor:
                lc, pub, pid = _decode_cursor(cursor, sort)
                p_stmt = p_stmt.where(
                    _tuple_lt(
                        (Piece.load_count, Piece.published_at, cast(Piece.id, String)),
                        (lc, _parse_pub(pub), pid),
                    )
                )
        elif sort == "most_liked":
            order = (Piece.like_count.desc(), Piece.published_at.desc(), Piece.id.desc())
            if cursor:
                lc, pub, pid = _decode_cursor(cursor, sort)
                p_stmt = p_stmt.where(
                    _tuple_lt(
                        (Piece.like_count, Piece.published_at, cast(Piece.id, String)),
                        (lc, _parse_pub(pub), pid),
                    )
                )
        elif sort == "oldest":
            order = (Piece.published_at.asc(), Piece.id.asc())
            if cursor:
                pub, pid = _decode_cursor(cursor, sort)
                p_stmt = p_stmt.where(
                    _tuple_gt(
                        (Piece.published_at, cast(Piece.id, String)),
                        (_parse_pub(pub), pid),
                    )
                )
        else:  # newest
            order = (Piece.published_at.desc(), Piece.id.desc())
            if cursor:
                pub, pid = _decode_cursor(cursor, sort)
                p_stmt = p_stmt.where(
                    _tuple_lt(
                        (Piece.published_at, cast(Piece.id, String)),
                        (_parse_pub(pub), pid),
                    )
                )

        p_stmt = p_stmt.order_by(*order).limit(limit + 1)
        pieces_rows = (await session.execute(p_stmt)).all()

    # 3. Resolve Liked status
    liked_patch_ids = set()
    liked_piece_ids = set()
    if user:
        likes_p_stmt = select(Like.target_id).where(Like.user_id == user.id, Like.target_kind == "patch")
        likes_p_res = await session.execute(likes_p_stmt)
        liked_patch_ids = set(likes_p_res.scalars().all())

        likes_pi_stmt = select(Like.target_id).where(Like.user_id == user.id, Like.target_kind == "piece")
        likes_pi_res = await session.execute(likes_pi_stmt)
        liked_piece_ids = set(likes_pi_res.scalars().all())

    # 4. Map DB rows to GalleryItemOut and merge
    merged_items = []
    for r in patches_rows:
        merged_items.append((r[0].published_at, r[0].like_count, r[0].load_count, r[0].id, _to_item(r[0], r[1], r[2], r[3], r[0].id in liked_patch_ids)))
    for r in pieces_rows:
        merged_items.append((r[0].published_at, r[0].like_count, r[0].load_count, r[0].id, _to_piece_item(r[0], r[1], r[2], r[3], r[0].id in liked_piece_ids)))

    # 5. Sort in-memory
    def sort_key(item):
        pub_at = item[0] or datetime.min.replace(tzinfo=timezone.utc) if sort != "oldest" else item[0] or datetime.max.replace(tzinfo=timezone.utc)
        likes = item[1]
        loads = item[2]
        uid = str(item[3])

        if sort == "most_loaded":
            return (loads, pub_at, uid)
        elif sort == "most_liked":
            return (likes, pub_at, uid)
        elif sort == "oldest":
            return (pub_at, uid)
        else:  # newest
            return (pub_at, uid)

    reverse_order = sort != "oldest"
    merged_items.sort(key=sort_key, reverse=reverse_order)

    # 6. Apply pagination limit and construct next cursor
    next_cursor: str | None = None
    if len(merged_items) > limit:
        last = merged_items[limit - 1][4]
        pub_iso = last.published_at.isoformat() if last.published_at else None
        if sort == "most_loaded":
            keys: list[Any] = [last.load_count, pub_iso, str(last.id)]
        elif sort == "most_liked":
            keys = [last.like_count, pub_iso, str(last.id)]
        else:
            keys = [pub_iso, str(last.id)]
        next_cursor = _encode_cursor(sort, keys)
        merged_items = merged_items[:limit]

    response.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=60"
    return GalleryListOut(
        items=[x[4] for x in merged_items],
        next_cursor=next_cursor
    )


def _tuple_lt(cols: tuple, vals: tuple):
    return _tuple_cmp(cols, vals, less=True)


def _tuple_gt(cols: tuple, vals: tuple):
    return _tuple_cmp(cols, vals, less=False)


def _tuple_cmp(cols: tuple, vals: tuple, *, less: bool):
    clauses = []
    for i in range(len(cols)):
        eqs = [cols[j] == vals[j] for j in range(i)]
        cmp = cols[i] < vals[i] if less else cols[i] > vals[i]
        clauses.append(_and_all(eqs + [cmp]))
    return or_(*clauses)


def _and_all(items: list):
    from sqlalchemy import and_
    return and_(*items) if items else True


def _parse_pub(v: str | None) -> datetime | None:
    return datetime.fromisoformat(v) if v else None
