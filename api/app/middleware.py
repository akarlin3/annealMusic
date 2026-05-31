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


def _resolve_slo_route(method: str, path: str) -> str | None:
    # 1. Patch Save: POST to /api/v1/patches
    if method == "POST" and path == "/api/v1/patches":
        return "patch_save"
    # 2. Patch Load: GET to /api/v1/patches/{slug}
    if method == "GET" and path.startswith("/api/v1/patches/"):
        return "patch_load"
    # 3. Gallery List: GET to /api/v1/gallery
    if method == "GET" and path == "/api/v1/gallery":
        return "gallery_list"
    # 4. Render Submit: POST to /api/v1/renders
    if method == "POST" and path == "/api/v1/renders":
        return "render_submit"
    # 5. Render Complete: GET to /api/v1/renders/
    if method == "GET" and path.startswith("/api/v1/renders/"):
        return "render_complete"
    # 6. LLM Generate: POST to /api/v1/ai/generate
    if method == "POST" and path == "/api/v1/ai/generate":
        return "llm_generate"
    return None


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assigns/propagates a request id, logs one structured line per request,
    and applies security headers."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id
        start = time.monotonic()

        response = await call_next(request)

        elapsed_ms = round((time.monotonic() - start) * 1000, 1)

        # Track Service Level Objectives (SLOs)
        slo_route = _resolve_slo_route(request.method, request.url.path)
        if slo_route:
            from app.services.observability.metrics import tracker
            from app.services.observability.alerting import check_slos_and_alert
            import asyncio

            tracker.record_latency(slo_route, elapsed_ms)
            asyncio.create_task(check_slos_and_alert())

        response.headers["x-request-id"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # The embed route is the *only* surface allowed to be iframed (it's
        # designed to live on blogs/Bandcamp-style pages). Everything else stays
        # DENY. X-Frame-Options has no allow-list modern browsers honor, so for
        # the embed we drop it and use CSP frame-ancestors instead.
        if request.url.path.startswith("/embed"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data:; "
                "frame-ancestors *; "
                "block-all-mixed-content;"
            )
        else:
            response.headers["X-Frame-Options"] = "DENY"
            if request.url.path.startswith(("/learn", "/research")):
                response.headers["Content-Security-Policy"] = (
                    "default-src 'self'; "
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
                    "style-src 'self' 'unsafe-inline'; "
                    "img-src 'self' data:; "
                    "frame-ancestors 'none'; "
                    "block-all-mixed-content;"
                )

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
