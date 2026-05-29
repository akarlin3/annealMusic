from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from app.config import get_settings
from app.db import get_session
from app.deps import SessionDep, _client_ip, get_identity, Identity
from app.errors import bad_request, rate_limited
from app.models import Account, AccountProvider, MagicLink, Session
from app.services.email import get_email_client
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class EmailRequest(BaseModel):
    email: EmailStr
    intent: Literal["login", "signup", "add-email-to-account"]


@router.post("/email/request", status_code=202)
async def request_magic_link(
    body: EmailRequest,
    request: Request,
    session: SessionDep,
) -> dict[str, str]:
    settings = get_settings()
    ip = _client_ip(request)

    # 1. Sliding window rate limits: 5 magic links per email per hour, 20 per IP per hour.
    if settings.rate_limit_enabled:
        limiter = request.app.state.rate_limiter
        if not limiter.allow_email(body.email, ip):
            raise rate_limited()

    email_lower = body.email.lower()

    # 2. Check if account already exists
    stmt = select(Account).where(Account.email == email_lower)
    res = await session.execute(stmt)
    account = res.scalar_one_or_none()

    # 3. If intent is add-email-to-account, check if already exists
    if body.intent == "add-email-to-account" and account is not None:
        raise bad_request("Email is already registered to an account.")

    # 4. Generate magic link token
    token = uuid.uuid4()
    expires_at = datetime.now(tz=timezone.utc) + timedelta(minutes=15)

    magic_link = MagicLink(
        token=token,
        email=email_lower,
        intent=body.intent,
        account_id=account.id if account is not None else None,
        expires_at=expires_at,
    )
    session.add(magic_link)
    await session.commit()

    # 5. Build verification URL
    # e.g., http://localhost:8000/api/v1/auth/email/verify?token=uuid
    # Note: request.base_url holds the backend API origin.
    verify_url = f"{request.base_url}api/v1/auth/email/verify?token={token}"

    # 6. Deliver the email using the email service
    email_client = get_email_client()
    try:
        await email_client.send_magic_link(email_lower, verify_url)
    except Exception:
        # Avoid leaking deliverability exceptions to client. Keep the response 202.
        pass

    return {"message": "If the email is valid, a link has been sent."}


@router.get("/email/verify")
async def verify_magic_link(
    request: Request,
    response: Response,
    session: SessionDep,
    token: uuid.UUID = Query(...),
):
    settings = get_settings()
    now_dt = datetime.now(tz=timezone.utc)

    # 1. Fetch MagicLink
    stmt = select(MagicLink).where(MagicLink.token == token)
    res = await session.execute(stmt)
    link = res.scalar_one_or_none()

    if link is not None:
        link_expires = link.expires_at
        if link_expires.tzinfo is None:
            link_expires = link_expires.replace(tzinfo=timezone.utc)
    else:
        link_expires = None

    if (
        link is None
        or link.consumed_at is not None
        or link_expires < now_dt
    ):
        return RedirectResponse(
            url=f"{settings.client_app_url}?error=invalid_token",
            status_code=302,
        )

    # 2. Consume link
    link.consumed_at = now_dt

    # 3. Resolve Account (case-insensitive email)
    account_stmt = select(Account).where(Account.email == link.email)
    account_res = await session.execute(account_stmt)
    account = account_res.scalar_one_or_none()

    if account is None:
        # Create a new Account on signup/login
        account = Account(
            id=uuid.uuid4(),
            email=link.email,
            email_verified=True,
            display_name=None,
            avatar_seed=str(uuid.uuid4()),
        )
        session.add(account)
        await session.flush()

        # Add provider credentials
        provider = AccountProvider(
            account_id=account.id,
            provider="email",
            subject=link.email,
        )
        session.add(provider)
        await session.flush()
    else:
        account.email_verified = True
        account.last_login_at = now_dt

    # 4. Create Session
    session_id = uuid.uuid4()
    expires_at = now_dt + timedelta(days=30)
    ip = _client_ip(request)
    ip_hash = hashlib.sha256(ip.encode()).hexdigest()

    db_sess = Session(
        id=session_id,
        account_id=account.id,
        expires_at=expires_at,
        user_agent=request.headers.get("user-agent"),
        ip_hash=ip_hash,
    )
    session.add(db_sess)
    await session.commit()

    # 5. Redirect and set HttpOnly session cookie
    redirect = RedirectResponse(
        url=f"{settings.client_app_url}?signed_in=1",
        status_code=302,
    )
    redirect.set_cookie(
        key=settings.session_cookie_name,
        value=str(session_id),
        domain=settings.session_cookie_domain,
        secure=settings.session_cookie_secure,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 30, # 30 days
    )
    return redirect


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    session: SessionDep,
):
    settings = get_settings()
    session_cookie = request.cookies.get(settings.session_cookie_name)
    session_id = _parse_uuid(session_cookie)

    if session_id is not None:
        stmt = select(Session).where(Session.id == session_id)
        res = await session.execute(stmt)
        db_sess = res.scalar_one_or_none()
        if db_sess is not None:
            await session.delete(db_sess)
            await session.commit()

    response.delete_cookie(
        key=settings.session_cookie_name,
        domain=settings.session_cookie_domain,
    )


@router.get("/session")
async def get_session_info(
    session: SessionDep,
    identity: Identity = Depends(get_identity),
) -> dict:
    if identity.account_id is None:
        return {"account": None}

    stmt = select(Account).where(Account.id == identity.account_id)
    res = await session.execute(stmt)
    account = res.scalar_one()

    return {
        "account": {
            "id": str(account.id),
            "email": account.email,
            "display_name": account.display_name,
            "avatar_seed": account.avatar_seed,
            "email_verified": account.email_verified,
            "created_at": account.created_at.isoformat(),
        }
    }


def _parse_uuid(value: str | None) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except ValueError:
        return None
