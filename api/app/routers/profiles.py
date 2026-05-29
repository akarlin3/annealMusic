from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from app.deps import SessionDep
from app.errors import not_found
from app.models import Account, Patch, Recording, User

router = APIRouter(prefix="/api/v1/profiles", tags=["profiles"])


@router.get("/{account_id}")
async def get_public_profile(
    account_id: uuid.UUID,
    session: SessionDep,
) -> dict:
    stmt = select(Account).where(Account.id == account_id)
    res = await session.execute(stmt)
    account = res.scalar_one_or_none()

    if account is None:
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

    return {
        "id": str(account.id),
        "display_name": account.display_name,
        "avatar_seed": account.avatar_seed,
        "created_at": account.created_at.isoformat(),
        "counts": {
            "patches": patches_count,
            "recordings": recordings_count,
        },
    }
