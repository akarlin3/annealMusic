from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.db import get_sessionmaker
from app.errors import ApiError
from app.logging_config import configure_logging
from app.middleware import AnonContextMiddleware, RequestContextMiddleware
from app.rate_limit import RateLimiter
from app.render import RenderQueue
from app.routers import (
    admin,
    captures,
    embed,
    gallery,
    health,
    patches,
    recordings,
    reports,
    user_sources,
    users,
    auth,
    account,
    profiles,
    ai,
    jam,
    social,
    pieces,
    listening_sessions,
    custom_tunings,
    me_sessions,
    library,
    research,
    user_scripts,
    experiments,
    learn,
    sonifications,
    lesson_admin,
    curriculum_admin,
    analytics_admin,
    clips,
    lesson_progress,
    recommendations,
    studies,
    clinical,
    mapping_templates,
    biofeedback,
    renders,
    accessibility,
    observability,
)


from app.sentry import init_sentry
from app.storage import make_storage
from app.services.llm import AnthropicClient
from app.services.embeddings import OpenAIEmbeddingClient


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    queue: RenderQueue = app.state.render_queue
    if settings.render_enabled and settings.render_backend == "inprocess":
        from app.renderer_playwright import PlaywrightRenderer

        await queue.start(
            get_sessionmaker(), app.state.storage, PlaywrightRenderer(settings)
        )
    yield
    await queue.stop()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging()
    init_sentry(settings)

    app = FastAPI(title="AnnealMusic API", version="1.0.0", lifespan=lifespan)
    app.state.storage = make_storage(settings)
    app.state.rate_limiter = RateLimiter()
    app.state.llm = AnthropicClient()
    app.state.embeddings = OpenAIEmbeddingClient()
    app.state.render_queue = RenderQueue(settings)

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
    app.include_router(user_sources.router)
    app.include_router(user_sources.render_router)
    app.include_router(recordings.router)
    app.include_router(gallery.router)
    app.include_router(reports.router)
    app.include_router(admin.router)
    app.include_router(embed.router)
    app.include_router(research.router)
    app.include_router(auth.router)
    app.include_router(account.router)
    app.include_router(profiles.router)
    app.include_router(ai.router)
    app.include_router(jam.router)
    app.include_router(social.router)
    app.include_router(pieces.router)
    app.include_router(listening_sessions.router)
    app.include_router(custom_tunings.router)
    app.include_router(me_sessions.router)
    app.include_router(library.router)
    app.include_router(user_scripts.router)
    app.include_router(experiments.router)
    app.include_router(learn.router)
    app.include_router(lesson_admin.router)
    app.include_router(curriculum_admin.router)
    app.include_router(analytics_admin.router)
    app.include_router(clips.router)
    app.include_router(clips.admin_router)
    app.include_router(lesson_progress.router)
    app.include_router(recommendations.router)
    app.include_router(studies.router)
    app.include_router(studies.study_exports_router)
    app.include_router(studies.reproduce_router)
    app.include_router(learn.html_router)
    app.include_router(sonifications.router)
    app.include_router(clinical.router)
    app.include_router(clinical.session_record_router)
    app.include_router(biofeedback.router)
    app.include_router(mapping_templates.router)
    app.include_router(mapping_templates.admin_router)
    app.include_router(mapping_templates.instantiate_router)
    app.include_router(renders.router)
    app.include_router(accessibility.router)
    app.include_router(observability.router)

    return app


app = create_app()
