from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.errors import rate_limited
from app.models import User
from app.storage import StorageClient


def _parse_uuid(value: str | None) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


SettingsDep = Annotated[Settings, Depends(get_settings)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_storage(request: Request) -> StorageClient:
    return request.app.state.storage


StorageDep = Annotated[StorageClient, Depends(get_storage)]


def get_render_queue(request: Request):
    return request.app.state.render_queue


def require_admin(request: Request) -> None:
    """Gate admin endpoints on ``x-admin-key``. When ``ADMIN_KEY`` is unset the
    endpoints behave as if absent (404) — no oracle that a panel exists."""
    import secrets

    from app.errors import not_found, unauthorized

    key = get_settings().admin_key
    if not key:
        raise not_found("resource")
    provided = request.headers.get("x-admin-key") or ""
    if not secrets.compare_digest(provided, key):
        raise unauthorized()


async def _resolve_user(
    request: Request, session: AsyncSession, *, allow_cookie: bool
) -> User:
    """Resolve (or mint) the anon user for this request.

    Header ``x-anon-id`` is authoritative. The ``am_anon`` cookie is a
    soft-recovery mirror used for reads only — never sufficient for a write.
    A missing id mints a fresh user; the resolved id is echoed back (header +
    cookie) by ``AnonContextMiddleware``.
    """
    anon_id = _parse_uuid(request.headers.get("x-anon-id"))
    if anon_id is None and allow_cookie:
        anon_id = _parse_uuid(request.cookies.get(get_settings().anon_cookie_name))

    minted = False
    if anon_id is None:
        anon_id = uuid.uuid4()
        minted = True

    user = await session.get(User, anon_id)
    if user is None:
        user = User(id=anon_id)
        session.add(user)
        await session.flush()
    else:
        user.last_seen_at = datetime.now(tz=timezone.utc)

    request.state.resolved_anon_id = str(anon_id)
    request.state.anon_minted = minted
    return user


async def current_user(request: Request, session: SessionDep) -> User:
    """Read context: header or cookie, minting if absent."""
    return await _resolve_user(request, session, allow_cookie=True)


async def current_writer(request: Request, session: SessionDep) -> User:
    """Write context: header only (cookie is never sufficient for a write)."""
    return await _resolve_user(request, session, allow_cookie=False)


CurrentUser = Annotated[User, Depends(current_user)]
CurrentWriter = Annotated[User, Depends(current_writer)]


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(action: str):
    """Dependency factory enforcing a rate-limit bucket for ``action``."""

    async def _dep(request: Request) -> None:
        settings = get_settings()
        if not settings.rate_limit_enabled:
            return
        limiter = request.app.state.rate_limiter
        anon_id = _parse_uuid(request.headers.get("x-anon-id"))
        ok = limiter.allow(
            action=action,
            anon_id=str(anon_id) if anon_id else None,
            ip=_client_ip(request),
        )
        if not ok:
            raise rate_limited()

    return _dep
