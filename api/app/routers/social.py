from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession
import sqlalchemy as sa

from app.deps import (
    CurrentUser,
    CurrentWriter,
    OptionalUser,
    SessionDep,
    Identity,
    get_identity,
    rate_limit,
    get_blocked_account_ids,
    get_blocked_user_ids,
)
from app.errors import bad_request, forbidden, not_found
from app.models import Like, Follow, Block, Mute, Account, Patch, Recording, User, FeaturedPick
from app.schemas import (
    LikeCreate,
    LikeStatusOut,
    FollowStatusOut,
    RelationshipListOut,
    RelationshipItem,
    FeedListOut,
    FeedItemOut,
    FeaturedPickOut,
)

router = APIRouter(prefix="/api/v1", tags=["social"])


async def require_auth(identity: Identity) -> uuid.UUID:
    if identity.account_id is None:
        raise forbidden("Authentication required.")
    return identity.account_id


# --- Likes Endpoints ---------------------------------------------------------

@router.post(
    "/likes",
    response_model=LikeStatusOut,
    dependencies=[Depends(rate_limit("likes"))],
)
async def add_like(
    body: LikeCreate,
    user: CurrentWriter,
    session: SessionDep,
) -> LikeStatusOut:
    if body.target_kind == "patch":
        target = await session.get(Patch, body.target_id)
        if target is None or target.visibility == "flagged":
            raise not_found("patch")
    elif body.target_kind == "recording":
        target = await session.get(Recording, body.target_id)
        if target is None or target.visibility == "flagged":
            raise not_found("recording")
    else:
        raise bad_request("Invalid target kind.")

    # Block check if the target has an owner
    target_owner_id = getattr(target, "user_id", None)
    if target_owner_id:
        # Get target account ID
        owner = await session.get(User, target_owner_id)
        if owner and owner.account_id:
            # Check if this owner has blocked the user or user has blocked owner
            # (only if user is authenticated)
            from app.deps import get_blocked_account_ids
            user_account_id = user.account_id
            if user_account_id:
                blocked = await get_blocked_account_ids(session, user_account_id)
                if owner.account_id in blocked:
                    raise not_found(body.target_kind)

    # Idempotent insert
    stmt = select(Like).where(
        Like.user_id == user.id,
        Like.target_kind == body.target_kind,
        Like.target_id == body.target_id,
    )
    res = await session.execute(stmt)
    existing = res.scalar_one_or_none()

    if existing is None:
        like = Like(
            user_id=user.id,
            target_kind=body.target_kind,
            target_id=body.target_id,
        )
        session.add(like)
        await session.commit()

    return LikeStatusOut(liked=True)


@router.delete(
    "/likes/{target_kind}/{target_id}",
    response_model=LikeStatusOut,
    dependencies=[Depends(rate_limit("likes"))],
)
async def remove_like(
    target_kind: Literal["patch", "recording"],
    target_id: uuid.UUID,
    user: CurrentWriter,
    session: SessionDep,
) -> LikeStatusOut:
    stmt = select(Like).where(
        Like.user_id == user.id,
        Like.target_kind == target_kind,
        Like.target_id == target_id,
    )
    res = await session.execute(stmt)
    like = res.scalar_one_or_none()

    if like is not None:
        await session.delete(like)
        await session.commit()

    return LikeStatusOut(liked=False)


@router.get("/likes/status", response_model=LikeStatusOut)
async def check_like_status(
    target_kind: Literal["patch", "recording"],
    target_id: uuid.UUID,
    user: CurrentUser,
    session: SessionDep,
) -> LikeStatusOut:
    stmt = select(Like).where(
        Like.user_id == user.id,
        Like.target_kind == target_kind,
        Like.target_id == target_id,
    )
    res = await session.execute(stmt)
    like = res.scalar_one_or_none()
    return LikeStatusOut(liked=like is not None)


# --- Follows Endpoints -------------------------------------------------------

@router.post(
    "/follows/{account_id}",
    response_model=FollowStatusOut,
    dependencies=[Depends(rate_limit("follows"))],
)
async def follow_account(
    account_id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> FollowStatusOut:
    my_account_id = await require_auth(identity)

    if my_account_id == account_id:
        raise bad_request("You cannot follow yourself.")

    # Check target account exists and is not suspended
    target = await session.get(Account, account_id)
    if target is None or target.suspended:
        raise not_found("account")

    # Check blocks
    blocked = await get_blocked_account_ids(session, my_account_id)
    if account_id in blocked:
        raise not_found("account")

    # Idempotent insert
    stmt = select(Follow).where(
        Follow.follower_account_id == my_account_id,
        Follow.followed_account_id == account_id,
    )
    res = await session.execute(stmt)
    existing = res.scalar_one_or_none()

    if existing is None:
        follow = Follow(
            follower_account_id=my_account_id,
            followed_account_id=account_id,
        )
        session.add(follow)
        await session.commit()

    return FollowStatusOut(following=True)


@router.delete(
    "/follows/{account_id}",
    response_model=FollowStatusOut,
    dependencies=[Depends(rate_limit("follows"))],
)
async def unfollow_account(
    account_id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> FollowStatusOut:
    my_account_id = await require_auth(identity)

    stmt = select(Follow).where(
        Follow.follower_account_id == my_account_id,
        Follow.followed_account_id == account_id,
    )
    res = await session.execute(stmt)
    follow = res.scalar_one_or_none()

    if follow is not None:
        await session.delete(follow)
        await session.commit()

    return FollowStatusOut(following=False)


# --- Blocks Endpoints --------------------------------------------------------

@router.post(
    "/blocks/{account_id}",
    dependencies=[Depends(rate_limit("blocks"))],
)
async def block_account(
    account_id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> dict:
    my_account_id = await require_auth(identity)

    if my_account_id == account_id:
        raise bad_request("You cannot block yourself.")

    target = await session.get(Account, account_id)
    if target is None:
        raise not_found("account")

    # Idempotent insert
    stmt = select(Block).where(
        Block.blocker_account_id == my_account_id,
        Block.blocked_account_id == account_id,
    )
    res = await session.execute(stmt)
    existing = res.scalar_one_or_none()

    if existing is None:
        block = Block(
            blocker_account_id=my_account_id,
            blocked_account_id=account_id,
        )
        session.add(block)

        # Auto-unfollow in both directions
        await session.execute(
            delete(Follow).where(
                or_(
                    sa.and_(Follow.follower_account_id == my_account_id, Follow.followed_account_id == account_id),
                    sa.and_(Follow.follower_account_id == account_id, Follow.followed_account_id == my_account_id),
                )
            )
        )
        await session.commit()

    return {"success": True}


@router.delete(
    "/blocks/{account_id}",
    dependencies=[Depends(rate_limit("blocks"))],
)
async def unblock_account(
    account_id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> dict:
    my_account_id = await require_auth(identity)

    stmt = select(Block).where(
        Block.blocker_account_id == my_account_id,
        Block.blocked_account_id == account_id,
    )
    res = await session.execute(stmt)
    block = res.scalar_one_or_none()

    if block is not None:
        await session.delete(block)
        await session.commit()

    return {"success": True}


@router.get("/blocks/me", response_model=RelationshipListOut)
async def list_my_blocked_accounts(
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> RelationshipListOut:
    my_account_id = await require_auth(identity)

    stmt = (
        select(Account)
        .join(Block, Block.blocked_account_id == Account.id)
        .where(Block.blocker_account_id == my_account_id)
        .order_by(Block.created_at.desc())
    )
    res = await session.execute(stmt)
    accounts = res.scalars().all()

    return RelationshipListOut(
        items=[
            RelationshipItem(
                id=a.id,
                display_name=a.display_name,
                avatar_seed=a.avatar_seed,
            )
            for a in accounts
        ]
    )


# --- Mutes Endpoints ---------------------------------------------------------

@router.post("/mutes/{account_id}")
async def mute_account(
    account_id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> dict:
    my_account_id = await require_auth(identity)

    if my_account_id == account_id:
        raise bad_request("You cannot mute yourself.")

    target = await session.get(Account, account_id)
    if target is None:
        raise not_found("account")

    stmt = select(Mute).where(
        Mute.muter_account_id == my_account_id,
        Mute.muted_account_id == account_id,
    )
    res = await session.execute(stmt)
    existing = res.scalar_one_or_none()

    if existing is None:
        mute = Mute(
            muter_account_id=my_account_id,
            muted_account_id=account_id,
        )
        session.add(mute)
        await session.commit()

    return {"success": True}


@router.delete("/mutes/{account_id}")
async def unmute_account(
    account_id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> dict:
    my_account_id = await require_auth(identity)

    stmt = select(Mute).where(
        Mute.muter_account_id == my_account_id,
        Mute.muted_account_id == account_id,
    )
    res = await session.execute(stmt)
    mute = res.scalar_one_or_none()

    if mute is not None:
        await session.delete(mute)
        await session.commit()

    return {"success": True}


    return RelationshipListOut(
        items=[
            RelationshipItem(
                id=a.id,
                display_name=a.display_name,
                avatar_seed=a.avatar_seed,
            )
            for a in accounts
        ]
    )


# --- Feed Endpoint -----------------------------------------------------------

@router.get("/feed", response_model=FeedListOut)
async def get_activity_feed(
    session: SessionDep,
    user: CurrentUser,
    identity: Identity = Depends(get_identity),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=24, ge=1, le=50),
) -> FeedListOut:
    my_account_id = await require_auth(identity)

    # 1. Get followed user IDs
    followed_accs = select(Follow.followed_account_id).where(Follow.follower_account_id == my_account_id)
    followed_users_stmt = select(User.id).where(User.account_id.in_(followed_accs))
    res = await session.execute(followed_users_stmt)
    followed_user_ids = set(res.scalars().all())

    if not followed_user_ids:
        return FeedListOut(items=[], next_cursor=None)

    # 2. Get muted user IDs
    muted_accs = select(Mute.muted_account_id).where(Mute.muter_account_id == my_account_id)
    muted_users_stmt = select(User.id).where(User.account_id.in_(muted_accs))
    res_muted = await session.execute(muted_users_stmt)
    muted_user_ids = set(res_muted.scalars().all())

    # 3. Get blocked user IDs
    blocked_user_ids = await get_blocked_user_ids(session, my_account_id)

    # Exclude muted + blocked
    active_user_ids = followed_user_ids - muted_user_ids - blocked_user_ids
    if not active_user_ids:
        return FeedListOut(items=[], next_cursor=None)

    # 4. Resolve cursor
    cursor_dt = None
    if cursor:
        try:
            cursor_dt = datetime.fromisoformat(cursor)
        except ValueError:
            pass

    # 5. Fetch public patches
    p_stmt = (
        select(Patch, Account.display_name, Account.avatar_seed, Account.id)
        .outerjoin(User, User.id == Patch.user_id)
        .outerjoin(Account, Account.id == User.account_id)
        .where(
            Patch.visibility == "public",
            Patch.user_id.in_(active_user_ids),
        )
    )
    if cursor_dt:
        p_stmt = p_stmt.where(Patch.created_at < cursor_dt)
    p_stmt = p_stmt.order_by(Patch.created_at.desc()).limit(limit + 1)
    p_rows = (await session.execute(p_stmt)).all()

    # 6. Fetch public recordings
    r_stmt = (
        select(Recording, Account.display_name, Account.avatar_seed, Account.id)
        .outerjoin(User, User.id == Recording.user_id)
        .outerjoin(Account, Account.id == User.account_id)
        .where(
            Recording.visibility == "public",
            Recording.user_id.in_(active_user_ids),
        )
    )
    if cursor_dt:
        r_stmt = r_stmt.where(Recording.created_at < cursor_dt)
    r_stmt = r_stmt.order_by(Recording.created_at.desc()).limit(limit + 1)
    r_rows = (await session.execute(r_stmt)).all()

    # 7. Merge in-memory and sort
    merged = []
    
    # Resolve current user's liked status for all items
    liked_patch_ids = set()
    liked_rec_ids = set()
    if user:
        likes_p_stmt = select(Like.target_id).where(Like.user_id == user.id, Like.target_kind == "patch")
        likes_p_res = await session.execute(likes_p_stmt)
        liked_patch_ids = set(likes_p_res.scalars().all())

        likes_r_stmt = select(Like.target_id).where(Like.user_id == user.id, Like.target_kind == "recording")
        likes_r_res = await session.execute(likes_r_stmt)
        liked_rec_ids = set(likes_r_res.scalars().all())

    for p, c_name, c_avatar, c_id in p_rows:
        merged.append(
            FeedItemOut(
                kind="patch",
                id=p.id,
                short_slug=p.short_slug,
                title=p.title,
                description=p.description,
                created_at=p.created_at,
                like_count=p.like_count,
                liked_by_me=p.id in liked_patch_ids,
                state=(p.state or {}).get("payload", ""),
                engine=p.engine,
                mode=p.mode,
                has_captures=p.has_captures,
                creator_name=c_name,
                creator_avatar_seed=c_avatar,
                creator_id=c_id,
            )
        )

    for r, c_name, c_avatar, c_id in r_rows:
        merged.append(
            FeedItemOut(
                kind="recording",
                id=r.id,
                short_slug=r.short_slug,
                title=r.title,
                description=None,
                created_at=r.created_at,
                like_count=r.like_count,
                liked_by_me=r.id in liked_rec_ids,
                duration_ms=r.duration_ms,
                format=r.format,
                creator_name=c_name,
                creator_avatar_seed=c_avatar,
                creator_id=c_id,
            )
        )

    # Sort descending
    merged.sort(key=lambda x: x.created_at, reverse=True)

    next_cursor = None
    if len(merged) > limit:
        # We fetch more than limit to see if there is more
        next_item = merged[limit]
        next_cursor = next_item.created_at.isoformat()
        merged = merged[:limit]

    return FeedListOut(items=merged, next_cursor=next_cursor)


# --- Featured Endpoints ------------------------------------------------------

@router.get("/featured", response_model=list[FeaturedPickOut])
async def get_current_featured_picks(
    session: SessionDep,
    user: OptionalUser,
) -> list[FeaturedPickOut]:
    # Determine current week's Monday
    today = date.today()
    current_monday = today - timedelta(days=today.weekday())

    # Check if there are picks for this week
    stmt = select(FeaturedPick).where(FeaturedPick.week_starting == current_monday).order_by(FeaturedPick.position.asc())
    res = await session.execute(stmt)
    picks = res.scalars().all()

    if not picks:
        # Fallback to the latest curated week
        latest_week_stmt = select(FeaturedPick.week_starting).order_by(FeaturedPick.week_starting.desc()).limit(1)
        res_week = await session.execute(latest_week_stmt)
        latest_week = res_week.scalar_one_or_none()
        if latest_week:
            stmt = select(FeaturedPick).where(FeaturedPick.week_starting == latest_week).order_by(FeaturedPick.position.asc())
            res = await session.execute(stmt)
            picks = res.scalars().all()

    if not picks:
        return []

    # Get patches details
    patch_ids = [p.patch_id for p in picks]
    
    # Query details
    from app.models import User, Account
    p_stmt = (
        select(Patch, Account.display_name, Account.avatar_seed, Account.id)
        .outerjoin(User, User.id == Patch.user_id)
        .outerjoin(Account, Account.id == User.account_id)
        .where(
            Patch.id.in_(patch_ids),
            Patch.visibility == "public"
        )
    )
    p_res = await session.execute(p_stmt)
    p_rows = p_res.all()
    p_map = {row[0].id: row for row in p_rows}

    liked_patch_ids = set()
    if user:
        likes_stmt = select(Like.target_id).where(Like.user_id == user.id, Like.target_kind == "patch")
        likes_res = await session.execute(likes_stmt)
        liked_patch_ids = set(likes_res.scalars().all())

    from app.routers.gallery import _to_item
    out = []
    for p in picks:
        p_row = p_map.get(p.patch_id)
        patch_out = None
        if p_row:
            patch_out = _to_item(p_row[0], p_row[1], p_row[2], p_row[3], p_row[0].id in liked_patch_ids)
        out.append(
            FeaturedPickOut(
                id=p.id,
                week_starting=p.week_starting.isoformat(),
                patch_id=p.patch_id,
                position=p.position,
                curator_note=p.curator_note,
                patch=patch_out,
            )
        )
    return out


@router.get("/featured/history", response_model=list[FeaturedPickOut])
async def get_featured_picks_history(
    session: SessionDep,
    user: OptionalUser,
    limit: int = Query(default=48, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[FeaturedPickOut]:
    stmt = (
        select(FeaturedPick)
        .order_by(FeaturedPick.week_starting.desc(), FeaturedPick.position.asc())
        .limit(limit)
        .offset(offset)
    )
    res = await session.execute(stmt)
    picks = res.scalars().all()

    if not picks:
        return []

    # Get patches details
    patch_ids = [p.patch_id for p in picks]
    from app.models import User, Account
    p_stmt = (
        select(Patch, Account.display_name, Account.avatar_seed, Account.id)
        .outerjoin(User, User.id == Patch.user_id)
        .outerjoin(Account, Account.id == User.account_id)
        .where(
            Patch.id.in_(patch_ids),
            Patch.visibility == "public"
        )
    )
    p_res = await session.execute(p_stmt)
    p_rows = p_res.all()
    p_map = {row[0].id: row for row in p_rows}

    liked_patch_ids = set()
    if user:
        likes_stmt = select(Like.target_id).where(Like.user_id == user.id, Like.target_kind == "patch")
        likes_res = await session.execute(likes_stmt)
        liked_patch_ids = set(likes_res.scalars().all())

    from app.routers.gallery import _to_item
    out = []
    for p in picks:
        p_row = p_map.get(p.patch_id)
        patch_out = None
        if p_row:
            patch_out = _to_item(p_row[0], p_row[1], p_row[2], p_row[3], p_row[0].id in liked_patch_ids)
        out.append(
            FeaturedPickOut(
                id=p.id,
                week_starting=p.week_starting.isoformat(),
                patch_id=p.patch_id,
                position=p.position,
                curator_note=p.curator_note,
                patch=patch_out,
            )
        )
    return out

