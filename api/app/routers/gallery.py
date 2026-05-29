"""Public gallery: browse `visibility='public'` patches with sort, filter,
full-text search, and keyset cursor pagination. No auth required."""

from __future__ import annotations

import base64
import json
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import SessionDep, rate_limit, OptionalUser, get_identity, Identity, get_blocked_user_ids
from app.errors import bad_request
from app.models import Patch, Like
from app.schemas import GalleryItemOut, GalleryListOut, GallerySort

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
        # A cursor is bound to its sort mode (the keyset shape differs).
        raise bad_request("cursor does not match sort")
    return data["k"]


def _search_clause(q: str, dialect: str):
    """Postgres: full-text (title weighted over description). SQLite: LIKE."""
    if dialect == "postgresql":
        vector = func.to_tsvector(
            "english",
            func.coalesce(Patch.title, "") + " " + func.coalesce(Patch.description, ""),
        )
        return vector.op("@@")(func.plainto_tsquery("english", q))
    like = f"%{q}%"
    return or_(
        func.coalesce(Patch.title, "").ilike(like),
        func.coalesce(Patch.description, "").ilike(like),
    )


@router.get("", response_model=GalleryListOut,
            dependencies=[Depends(rate_limit("get"))])
async def list_gallery(
    session: SessionDep,
    response: Response,
    user: OptionalUser,
    identity: Identity = Depends(get_identity),
    sort: GallerySort = Query(default="newest"),
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
    stmt = (
        select(Patch, Account.display_name, Account.avatar_seed, Account.id)
        .outerjoin(User, User.id == Patch.user_id)
        .outerjoin(Account, Account.id == User.account_id)
        .where(Patch.visibility == "public")
    )

    # Block filtering
    blocked_user_ids = await get_blocked_user_ids(session, identity.account_id)
    if blocked_user_ids:
        stmt = stmt.where(~Patch.user_id.in_(blocked_user_ids))

    if followed_only:
        if identity.account_id is None:
            raise bad_request("You must be logged in to filter by followed accounts.")
        from app.models import Follow
        followed_subq = select(Follow.followed_account_id).where(
            Follow.follower_account_id == identity.account_id
        )
        followed_users_subq = select(User.id).where(User.account_id.in_(followed_subq))
        stmt = stmt.where(Patch.user_id.in_(followed_users_subq))

    if engine:
        stmt = stmt.where(Patch.engine == engine)
    if mode:
        stmt = stmt.where(Patch.mode == mode)
    if has_captures is not None:
        stmt = stmt.where(Patch.has_captures.is_(has_captures))
    if q:
        stmt = stmt.where(_search_clause(q, dialect))

    # Sort + keyset cursor. `id` is the tiebreak for a total order.
    if sort == "most_loaded":
        order = (Patch.load_count.desc(), Patch.published_at.desc(), Patch.id.desc())
        if cursor:
            lc, pub, pid = _decode_cursor(cursor, sort)
            stmt = stmt.where(
                _tuple_lt(
                    (Patch.load_count, Patch.published_at, cast(Patch.id, String)),
                    (lc, _parse_pub(pub), pid),
                )
            )
    elif sort == "most_liked":
        order = (Patch.like_count.desc(), Patch.published_at.desc(), Patch.id.desc())
        if cursor:
            lc, pub, pid = _decode_cursor(cursor, sort)
            stmt = stmt.where(
                _tuple_lt(
                    (Patch.like_count, Patch.published_at, cast(Patch.id, String)),
                    (lc, _parse_pub(pub), pid),
                )
            )
    elif sort == "oldest":
        order = (Patch.published_at.asc(), Patch.id.asc())
        if cursor:
            pub, pid = _decode_cursor(cursor, sort)
            stmt = stmt.where(
                _tuple_gt(
                    (Patch.published_at, cast(Patch.id, String)),
                    (_parse_pub(pub), pid),
                )
            )
    else:  # newest
        order = (Patch.published_at.desc(), Patch.id.desc())
        if cursor:
            pub, pid = _decode_cursor(cursor, sort)
            stmt = stmt.where(
                _tuple_lt(
                    (Patch.published_at, cast(Patch.id, String)),
                    (_parse_pub(pub), pid),
                )
            )

    stmt = stmt.order_by(*order).limit(limit + 1)
    rows = (await session.execute(stmt)).all()

    next_cursor: str | None = None
    if len(rows) > limit:
        rows = rows[:limit]
        last = rows[-1][0]
        pub_iso = last.published_at.isoformat() if last.published_at else None
        if sort == "most_loaded":
            keys: list[Any] = [last.load_count, pub_iso, str(last.id)]
        elif sort == "most_liked":
            keys = [last.like_count, pub_iso, str(last.id)]
        else:
            keys = [pub_iso, str(last.id)]
        next_cursor = _encode_cursor(sort, keys)

    liked_patch_ids = set()
    if user:
        likes_stmt = select(Like.target_id).where(Like.user_id == user.id, Like.target_kind == "patch")
        likes_res = await session.execute(likes_stmt)
        liked_patch_ids = set(likes_res.scalars().all())

    response.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=60"
    return GalleryListOut(
        items=[_to_item(row[0], row[1], row[2], row[3], row[0].id in liked_patch_ids) for row in rows],
        next_cursor=next_cursor
    )


def _tuple_lt(cols: tuple, vals: tuple):
    """Lexicographic ``cols < vals`` for DESC keyset paging (rows strictly after
    the cursor). Implemented as an OR-chain so it runs on SQLite and Postgres."""
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
