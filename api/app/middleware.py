from __future__ import annotations

import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

from app.config import get_settings
from app.logging_config import get_logger

logger = get_logger("request")


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assigns/propagates a request id, logs one structured line per request,
    and applies security headers."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id
        start = time.monotonic()

        response = await call_next(request)

        elapsed_ms = round((time.monotonic() - start) * 1000, 1)
        response.headers["x-request-id"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # The embed route is the *only* surface allowed to be iframed (it's
        # designed to live on blogs/Bandcamp-style pages). Everything else stays
        # DENY. X-Frame-Options has no allow-list modern browsers honor, so for
        # the embed we drop it and use CSP frame-ancestors instead.
        if request.url.path.startswith("/embed"):
            response.headers["Content-Security-Policy"] = "frame-ancestors *"
        else:
            response.headers["X-Frame-Options"] = "DENY"

        if get_settings().is_prod:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

        anon = getattr(request.state, "resolved_anon_id", None)
        logger.info(
            "request",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "latency_ms": elapsed_ms,
                "anon_hash": (str(hash(anon)) if anon else None),
            },
        )
        return response


class AnonContextMiddleware(BaseHTTPMiddleware):
    """After a route resolves (or mints) the anon id, echo it back so the client
    can adopt a freshly minted id (header + soft-recovery cookie)."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        anon = getattr(request.state, "resolved_anon_id", None)
        if anon:
            settings = get_settings()
            response.headers["x-anon-id"] = anon
            response.set_cookie(
                key=settings.anon_cookie_name,
                value=anon,
                domain=settings.anon_cookie_domain,
                secure=settings.anon_cookie_secure,
                httponly=False,
                samesite="lax",
                max_age=60 * 60 * 24 * 365 * 2,
            )
        return response
