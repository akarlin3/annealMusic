from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from app.deps import (
    SessionDep,
    Identity,
    get_identity,
    OptionalUser,
    get_blocked_account_ids,
    get_blocked_user_ids,
)
from app.errors import not_found, forbidden
from app.models import Account, Patch, Recording, User, Follow, Like
from app.schemas import GalleryListOut, RecordingListOut, RecordingOut

router = APIRouter(prefix="/api/v1/profiles", tags=["profiles"])


async def _assert_not_blocked(session: SessionDep, viewer_account_id: uuid.UUID | None, target_account_id: uuid.UUID) -> None:
    if viewer_account_id:
        blocked = await get_blocked_account_ids(session, viewer_account_id)
        if target_account_id in blocked:
            raise not_found("profile")


@router.get("/{account_id}")
async def get_public_profile(
    account_id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> dict:
    await _assert_not_blocked(session, identity.account_id, account_id)

    stmt = select(Account).where(Account.id == account_id)
    res = await session.execute(stmt)
    account = res.scalar_one_or_none()

    if account is None or account.suspended:
        raise not_found("profile")

    # Get all claimed anon IDs for this account
    anon_stmt = select(User.id).where(User.account_id == account_id)
    anon_res = await session.execute(anon_stmt)
    anon_ids = list(anon_res.scalars().all())

    # Get counts of public patches and public recordings
    patches_count = 0
    recordings_count = 0

    if anon_ids:
        patches_stmt = select(func.count(Patch.id)).where(
            Patch.user_id.in_(anon_ids), Patch.visibility == "public"
        )
        patches_res = await session.execute(patches_stmt)
        patches_count = patches_res.scalar() or 0

        recordings_stmt = select(func.count(Recording.id)).where(
            Recording.user_id.in_(anon_ids), Recording.visibility == "public"
        )
        recordings_res = await session.execute(recordings_stmt)
        recordings_count = recordings_res.scalar() or 0

    # Check if viewer is following this account
    following = False
    if identity.account_id is not None:
        f_stmt = select(Follow).where(
            Follow.follower_account_id == identity.account_id,
            Follow.followed_account_id == account_id,
        )
        f_res = await session.execute(f_stmt)
        following = f_res.scalar_one_or_none() is not None

    return {
        "id": str(account.id),
        "display_name": account.display_name,
        "avatar_seed": account.avatar_seed,
        "bio": account.bio,
        "created_at": account.created_at.isoformat(),
        "follower_count": account.follower_count,
        "following_count": account.following_count,
        "likes_public": account.likes_public,
        "follows_public": account.follows_public,
        "following": following,
        "counts": {
            "patches": patches_count,
            "recordings": recordings_count,
        },
    }


@router.get("/{account_id}/patches", response_model=GalleryListOut)
async def get_profile_patches(
    account_id: uuid.UUID,
    session: SessionDep,
    user: OptionalUser,
    identity: Identity = Depends(get_identity),
    limit: int = Query(default=24, ge=1, le=100),
    cursor: str | None = Query(default=None),
) -> GalleryListOut:
    await _assert_not_blocked(session, identity.account_id, account_id)

    account = await session.get(Account, account_id)
    if account is None or account.suspended:
        raise not_found("profile")

    # Get claimed anon IDs
    anon_stmt = select(User.id).where(User.account_id == account_id)
    anon_res = await session.execute(anon_stmt)
    anon_ids = list(anon_res.scalars().all())

    if not anon_ids:
        return GalleryListOut(items=[], next_cursor=None)

    # Fetch public patches
    from app.models import User as DbUser, Account as DbAccount
    stmt = (
        select(Patch, DbAccount.display_name, DbAccount.avatar_seed, DbAccount.id)
        .outerjoin(DbUser, DbUser.id == Patch.user_id)
        .outerjoin(DbAccount, DbAccount.id == DbUser.account_id)
        .where(
            Patch.visibility == "public",
            Patch.user_id.in_(anon_ids),
        )
    )

    # Keyset cursor pagination (similar to gallery)
    if cursor:
        from app.routers.gallery import _decode_cursor, _tuple_lt, _parse_pub
        from sqlalchemy import cast, String
        pub, pid = _decode_cursor(cursor, "newest")
        stmt = stmt.where(
            _tuple_lt(
                (Patch.published_at, cast(Patch.id, String)),
                (_parse_pub(pub), pid),
            )
        )

    stmt = stmt.order_by(Patch.published_at.desc(), Patch.id.desc()).limit(limit + 1)
    rows = (await session.execute(stmt)).all()

    next_cursor = None
    if len(rows) > limit:
        from app.routers.gallery import _encode_cursor
        rows = rows[:limit]
        last = rows[-1][0]
        pub_iso = last.published_at.isoformat() if last.published_at else None
        keys = [pub_iso, str(last.id)]
        next_cursor = _encode_cursor("newest", keys)

    # Resolve liked_by_me
    liked_patch_ids = set()
    if user:
        likes_stmt = select(Like.target_id).where(Like.user_id == user.id, Like.target_kind == "patch")
        likes_res = await session.execute(likes_stmt)
        liked_patch_ids = set(likes_res.scalars().all())

    from app.routers.gallery import _to_item
    return GalleryListOut(
        items=[_to_item(row[0], row[1], row[2], row[3], row[0].id in liked_patch_ids) for row in rows],
        next_cursor=next_cursor,
    )


@router.get("/{account_id}/recordings", response_model=RecordingListOut)
async def get_profile_recordings(
    account_id: uuid.UUID,
    session: SessionDep,
    user: OptionalUser,
    identity: Identity = Depends(get_identity),
) -> RecordingListOut:
    await _assert_not_blocked(session, identity.account_id, account_id)

    account = await session.get(Account, account_id)
    if account is None or account.suspended:
        raise not_found("profile")

    # Get claimed anon IDs
    anon_stmt = select(User.id).where(User.account_id == account_id)
    anon_res = await session.execute(anon_stmt)
    anon_ids = list(anon_res.scalars().all())

    if not anon_ids:
        return RecordingListOut(items=[])

    stmt = (
        select(Recording)
        .where(
            Recording.visibility == "public",
            Recording.user_id.in_(anon_ids),
        )
        .order_by(Recording.created_at.desc())
    )
    rows = (await session.execute(stmt)).scalars().all()

    liked_rec_ids = set()
    if user:
        likes_stmt = select(Like.target_id).where(Like.user_id == user.id, Like.target_kind == "recording")
        likes_res = await session.execute(likes_stmt)
        liked_rec_ids = set(likes_res.scalars().all())

    items = []
    for r in rows:
        out = RecordingOut.model_validate(r)
        out.liked_by_me = r.id in liked_rec_ids
        items.append(out)

    return RecordingListOut(items=items)


@router.get("/{account_id}/liked", response_model=GalleryListOut)
async def get_profile_liked_patches(
    account_id: uuid.UUID,
    session: SessionDep,
    user: OptionalUser,
    identity: Identity = Depends(get_identity),
    limit: int = Query(default=24, ge=1, le=100),
    cursor: str | None = Query(default=None),
) -> GalleryListOut:
    await _assert_not_blocked(session, identity.account_id, account_id)

    account = await session.get(Account, account_id)
    if account is None or account.suspended:
        raise not_found("profile")

    # If likes are not public, and requester is not the owner -> 403 Forbidden
    if not account.likes_public and identity.account_id != account_id:
        raise forbidden("Likes are private.")

    # Get claimed anon IDs
    anon_stmt = select(User.id).where(User.account_id == account_id)
    anon_res = await session.execute(anon_stmt)
    anon_ids = list(anon_res.scalars().all())

    if not anon_ids:
        return GalleryListOut(items=[], next_cursor=None)

    # Blocked user IDs for the viewer
    blocked_user_ids = await get_blocked_user_ids(session, identity.account_id)

    # Fetch public patches liked by this profile
    from app.models import User as DbUser, Account as DbAccount
    stmt = (
        select(Patch, DbAccount.display_name, DbAccount.avatar_seed, DbAccount.id)
        .join(Like, Like.target_id == Patch.id)
        .outerjoin(DbUser, DbUser.id == Patch.user_id)
        .outerjoin(DbAccount, DbAccount.id == DbUser.account_id)
        .where(
            Like.user_id.in_(anon_ids),
            Like.target_kind == "patch",
            Patch.visibility == "public",
        )
    )

    if blocked_user_ids:
        stmt = stmt.where(~Patch.user_id.in_(blocked_user_ids))

    if cursor:
        from app.routers.gallery import _decode_cursor, _tuple_lt, _parse_pub
        from sqlalchemy import cast, String
        pub, pid = _decode_cursor(cursor, "newest")
        stmt = stmt.where(
            _tuple_lt(
                (Patch.published_at, cast(Patch.id, String)),
                (_parse_pub(pub), pid),
            )
        )

    stmt = stmt.order_by(Patch.published_at.desc(), Patch.id.desc()).limit(limit + 1)
    rows = (await session.execute(stmt)).all()

    next_cursor = None
    if len(rows) > limit:
        from app.routers.gallery import _encode_cursor
        rows = rows[:limit]
        last = rows[-1][0]
        pub_iso = last.published_at.isoformat() if last.published_at else None
        keys = [pub_iso, str(last.id)]
        next_cursor = _encode_cursor("newest", keys)

    # Resolve liked_by_me for the viewer
    liked_patch_ids = set()
    if user:
        likes_stmt = select(Like.target_id).where(Like.user_id == user.id, Like.target_kind == "patch")
        likes_res = await session.execute(likes_stmt)
        liked_patch_ids = set(likes_res.scalars().all())

    from app.routers.gallery import _to_item
    return GalleryListOut(
        items=[_to_item(row[0], row[1], row[2], row[3], row[0].id in liked_patch_ids) for row in rows],
        next_cursor=next_cursor,
    )
