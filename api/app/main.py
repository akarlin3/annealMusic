from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.errors import ApiError
from app.logging_config import configure_logging
from app.middleware import AnonContextMiddleware, RequestContextMiddleware
from app.rate_limit import RateLimiter
from app.routers import captures, health, patches, recordings, users
from app.sentry import init_sentry
from app.storage import make_storage


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging()
    init_sentry(settings)

    app = FastAPI(title="AnnealMusic API", version="0.7.0")
    app.state.storage = make_storage(settings)
    app.state.rate_limiter = RateLimiter()

    # Order matters: CORS outermost, then request context, then anon echo
    # (innermost so it runs after the route has resolved the id).
    app.add_middleware(AnonContextMiddleware)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["x-anon-id", "content-type", "x-request-id"],
        expose_headers=["x-anon-id", "x-request-id"],
    )

    @app.exception_handler(ApiError)
    async def _api_error_handler(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)

    app.include_router(health.router)
    app.include_router(users.router)
    app.include_router(patches.router)
    app.include_router(captures.router)
    app.include_router(recordings.router)

    return app


app = create_app()
