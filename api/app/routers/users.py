from __future__ import annotations

from fastapi import APIRouter, Depends

from app.config import get_settings
from app.deps import CurrentUser, CurrentWriter, SessionDep, rate_limit
from app.schemas import QuotaOut, UserMeOut, UserOut

router = APIRouter(prefix="/api/v1/users", tags=["users"])


def _quota() -> QuotaOut:
    s = get_settings()
    return QuotaOut(
        patches=s.quota_patches,
        pieces=s.quota_pieces,
        captures=s.quota_captures,
        recordings=s.quota_recordings,
        user_sources=s.quota_user_sources,
        bytes=s.quota_bytes,
    )



@router.post("", response_model=UserMeOut, dependencies=[Depends(rate_limit("get"))])
async def create_user(user: CurrentWriter, session: SessionDep) -> UserMeOut:
    """Idempotent: returns the user for the provided ``x-anon-id``, minting one
    (echoed via header + cookie) when absent."""
    await session.commit()
    return UserMeOut(user=UserOut.model_validate(user), quota=_quota())


@router.get("/me", response_model=UserMeOut, dependencies=[Depends(rate_limit("get"))])
async def get_me(user: CurrentUser, session: SessionDep) -> UserMeOut:
    await session.commit()
    return UserMeOut(user=UserOut.model_validate(user), quota=_quota())
