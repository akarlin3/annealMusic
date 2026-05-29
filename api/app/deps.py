from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
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


class Identity:
    def __init__(
        self,
        anon_id: uuid.UUID | None = None,
        account_id: uuid.UUID | None = None,
        owned_anon_ids: list[uuid.UUID] | None = None,
    ) -> None:
        self.anon_id = anon_id
        self.account_id = account_id
        self.owned_anon_ids = owned_anon_ids or []


async def get_identity(request: Request, session: SessionDep) -> Identity:
    if hasattr(request.state, "identity"):
        return request.state.identity

    anon_header = request.headers.get("x-anon-id")
    anon_id = _parse_uuid(anon_header)
    if anon_id is None:
        anon_cookie = request.cookies.get(get_settings().anon_cookie_name)
        anon_id = _parse_uuid(anon_cookie)

    session_cookie = request.cookies.get(get_settings().session_cookie_name)
    session_id = _parse_uuid(session_cookie)

    account_id = None
    owned_anon_ids = []

    if session_id is not None:
        from app.models import Session as DbSession, User as DbUser
        now_dt = datetime.now(tz=timezone.utc)
        stmt = select(DbSession).where(DbSession.id == session_id, DbSession.expires_at > now_dt)
        res = await session.execute(stmt)
        db_sess = res.scalar_one_or_none()
        if db_sess is not None:
            account_id = db_sess.account_id

            # Slide session expiry if last_seen_at is older than 24 hours
            last_seen = db_sess.last_seen_at
            if last_seen.tzinfo is None:
                last_seen = last_seen.replace(tzinfo=timezone.utc)
            if (now_dt - last_seen).total_seconds() > 86400:
                db_sess.last_seen_at = now_dt
                db_sess.expires_at = now_dt + timedelta(days=30)
                await session.flush()

            # Query all owned anon IDs
            user_stmt = select(DbUser.id).where(DbUser.account_id == account_id)
            user_res = await session.execute(user_stmt)
            owned_anon_ids = list(user_res.scalars().all())

    identity = Identity(
        anon_id=anon_id,
        account_id=account_id,
        owned_anon_ids=owned_anon_ids,
    )
    request.state.identity = identity
    return identity


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

    # Claim verification: if the user's account is claimed, require session verification
    if user.account_id is not None:
        identity = await get_identity(request, session)
        if identity.account_id != user.account_id:
            from app.errors import forbidden
            raise forbidden("This device content is claimed by another account.")

    request.state.resolved_anon_id = str(anon_id)
    request.state.anon_minted = minted
    return user


async def current_user(request: Request, session: SessionDep) -> User:
    """Read context: header or cookie, minting if absent."""
    return await _resolve_user(request, session, allow_cookie=True)


async def current_writer(request: Request, session: SessionDep) -> User:
    """Write context: header only (cookie is never sufficient for a write)."""
    return await _resolve_user(request, session, allow_cookie=False)


async def optional_user(request: Request, session: SessionDep) -> User | None:
    """Resolve an *existing* user from the header/cookie without minting. Used by
    public read routes (e.g. `/r/<slug>` recording access) that must work for
    anonymous viewers but still recognize the owner of a private item."""
    anon_id = _parse_uuid(request.headers.get("x-anon-id")) or _parse_uuid(
        request.cookies.get(get_settings().anon_cookie_name)
    )
    if anon_id is None:
        return None
    user = await session.get(User, anon_id)
    if user is not None and user.account_id is not None:
        identity = await get_identity(request, session)
        if identity.account_id != user.account_id:
            return None
    return user



CurrentUser = Annotated[User, Depends(current_user)]
CurrentWriter = Annotated[User, Depends(current_writer)]
OptionalUser = Annotated[User | None, Depends(optional_user)]


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


async def get_blocked_account_ids(session: AsyncSession, account_id: uuid.UUID | None) -> set[uuid.UUID]:
    """Get the set of account IDs that either blocked or are blocked by the given account_id."""
    if not account_id:
        return set()
    from app.models import Block
    from sqlalchemy import or_
    stmt = select(Block.blocker_account_id, Block.blocked_account_id).where(
        or_(
            Block.blocker_account_id == account_id,
            Block.blocked_account_id == account_id
        )
    )
    res = await session.execute(stmt)
    blocked = set()
    for blocker, blocked_id in res.all():
        if blocker == account_id:
            blocked.add(blocked_id)
        else:
            blocked.add(blocker)
    return blocked


async def get_blocked_user_ids(session: AsyncSession, account_id: uuid.UUID | None) -> set[uuid.UUID]:
    """Get all user IDs owned by accounts that either blocked or are blocked by the given account_id."""
    if not account_id:
        return set()
    blocked_accounts = await get_blocked_account_ids(session, account_id)
    if not blocked_accounts:
        return set()
    from app.models import User
    stmt = select(User.id).where(User.account_id.in_(blocked_accounts))
    res = await session.execute(stmt)
    return set(res.scalars().all())

