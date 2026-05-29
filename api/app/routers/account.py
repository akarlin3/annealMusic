from __future__ import annotations

import re
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select, update

from app.db import get_session
from app.deps import SessionDep, get_identity, Identity
from app.errors import bad_request, forbidden, not_found
from app.models import Account, AccountProvider, User, Session as DbSession
from app.moderation import screen_publish
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/account", tags=["account"])


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=32)
    avatar_seed: str | None = Field(default=None, max_length=120)


class ConfirmDelete(BaseModel):
    confirm_email: str


class ClaimRequest(BaseModel):
    anon_id: uuid.UUID


def validate_display_name(name: str) -> None:
    # 2-32 chars, letters, numbers, spaces, hyphens, and underscores
    pattern = r"^[a-zA-Z0-9_\- ]{2,32}$"
    if not re.match(pattern, name):
        raise bad_request(
            "Display name must be 2-32 characters and only contain letters, numbers, spaces, hyphens, or underscores."
        )
    # Profanity screening
    if screen_publish(name, None):
        raise bad_request("Display name contains inappropriate terms.")


async def require_auth(identity: Identity) -> uuid.UUID:
    if identity.account_id is None:
        raise forbidden("Authentication required.")
    return identity.account_id


@router.get("/me")
async def get_my_profile(
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> dict:
    account_id = await require_auth(identity)
    stmt = select(Account).where(Account.id == account_id)
    res = await session.execute(stmt)
    account = res.scalar_one()

    return {
        "id": str(account.id),
        "email": account.email,
        "display_name": account.display_name,
        "avatar_seed": account.avatar_seed,
        "created_at": account.created_at.isoformat(),
        "last_login_at": account.last_login_at.isoformat() if account.last_login_at else None,
    }


@router.patch("/me")
async def update_my_profile(
    body: ProfileUpdate,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> dict:
    account_id = await require_auth(identity)
    stmt = select(Account).where(Account.id == account_id)
    res = await session.execute(stmt)
    account = res.scalar_one()

    if body.display_name is not None:
        name = body.display_name.strip()
        validate_display_name(name)
        account.display_name = name

    if body.avatar_seed is not None:
        account.avatar_seed = body.avatar_seed.strip()

    await session.commit()
    await session.refresh(account)

    return {
        "id": str(account.id),
        "email": account.email,
        "display_name": account.display_name,
        "avatar_seed": account.avatar_seed,
        "created_at": account.created_at.isoformat(),
        "last_login_at": account.last_login_at.isoformat() if account.last_login_at else None,
    }


@router.delete("/me", status_code=204)
async def delete_my_account(
    body: ConfirmDelete,
    response: Response,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
):
    account_id = await require_auth(identity)
    stmt = select(Account).where(Account.id == account_id)
    res = await session.execute(stmt)
    account = res.scalar_one()

    if body.confirm_email.strip().lower() != account.email.lower():
        raise bad_request("Confirmation email does not match.")

    # Cascades: disassociate all claimed anon IDs
    await session.execute(
        update(User).where(User.account_id == account_id).values(account_id=None)
    )

    # Delete Account (cascades sessions, providers, magic links)
    await session.delete(account)
    await session.commit()

    # Clear active session cookie
    from app.config import get_settings
    settings = get_settings()
    response.delete_cookie(
        key=settings.session_cookie_name,
        domain=settings.session_cookie_domain,
    )


@router.get("/me/providers")
async def get_my_providers(
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> list[str]:
    account_id = await require_auth(identity)
    stmt = select(AccountProvider.provider).where(AccountProvider.account_id == account_id)
    res = await session.execute(stmt)
    return list(res.scalars().all())


@router.delete("/me/providers/{provider}", status_code=204)
async def unlink_provider(
    provider: Literal["email", "google", "github"],
    session: SessionDep,
    identity: Identity = Depends(get_identity),
):
    account_id = await require_auth(identity)

    # Count linked providers
    count_stmt = select(AccountProvider).where(AccountProvider.account_id == account_id)
    count_res = await session.execute(count_stmt)
    all_providers = count_res.scalars().all()

    if len(all_providers) <= 1:
        raise bad_request("Cannot unlink the last credential provider.")

    # Find matching provider
    match = [p for p in all_providers if p.provider == provider]
    if not match:
        raise not_found("provider connection")

    for p in match:
        await session.delete(p)

    await session.commit()


@router.post("/me/claim")
async def claim_anon_id(
    body: ClaimRequest,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> dict:
    account_id = await require_auth(identity)

    # Fetch User (anon ID)
    stmt = select(User).where(User.id == body.anon_id)
    res = await session.execute(stmt)
    anon_user = res.scalar_one_or_none()

    if anon_user is None:
        # Proactively mint and associate the User row under this account
        anon_user = User(id=body.anon_id, account_id=account_id)
        session.add(anon_user)
        await session.commit()
        return {"success": True}

    if anon_user.account_id is not None:
        if anon_user.account_id == account_id:
            return {"success": True}  # Idempotent no-op
        # 409 Conflict
        from fastapi import HTTPException
        raise HTTPException(
            status_code=409,
            detail={
                "error": "anon_id_already_claimed",
                "message": "This device's content is already associated with another account.",
            },
        )

    anon_user.account_id = account_id
    await session.commit()
    return {"success": True}


@router.delete("/me/claim/{anon_id}", status_code=204)
async def unclaim_anon_id(
    anon_id: uuid.UUID,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
):
    account_id = await require_auth(identity)

    stmt = select(User).where(User.id == anon_id, User.account_id == account_id)
    res = await session.execute(stmt)
    anon_user = res.scalar_one_or_none()

    if anon_user is None:
        raise not_found("claimed device connection")

    anon_user.account_id = None
    await session.commit()


@router.get("/me/anon-ids")
async def list_claimed_anon_ids(
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> list[dict]:
    account_id = await require_auth(identity)

    stmt = select(User).where(User.account_id == account_id).order_by(User.created_at.desc())
    res = await session.execute(stmt)
    users = res.scalars().all()

    return [
        {
            "anon_id": str(u.id),
            "patch_count": u.patch_count,
            "capture_count": u.capture_count,
            "recording_count": u.recording_count,
            "source_count": u.source_count,
            "bytes_used": u.bytes_used,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]
