from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession
import sqlalchemy as sa

from app.deps import (
    CurrentUser,
    CurrentWriter,
    SessionDep,
    Identity,
    get_identity,
    rate_limit,
    get_blocked_account_ids,
)
from app.errors import bad_request, forbidden, not_found
from app.models import Like, Follow, Block, Mute, Account, Patch, Recording, User
from app.schemas import (
    LikeCreate,
    LikeStatusOut,
    FollowStatusOut,
    RelationshipListOut,
    RelationshipItem,
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


@router.get("/mutes/me", response_model=RelationshipListOut)
async def list_my_muted_accounts(
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> RelationshipListOut:
    my_account_id = await require_auth(identity)

    stmt = (
        select(Account)
        .join(Mute, Mute.muted_account_id == Account.id)
        .where(Mute.muter_account_id == my_account_id)
        .order_by(Mute.created_at.desc())
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
