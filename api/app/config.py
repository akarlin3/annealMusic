from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, sourced from environment variables (or a .env)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "dev"

    # Database. Async driver URLs: postgresql+asyncpg://… (prod) or
    # sqlite+aiosqlite://… (tests).
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/annealmusic"

    # CORS allow-list (exact origins; no wildcard when credentials are on).
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173"]
    )

    # Anon-id soft-recovery cookie.
    anon_cookie_name: str = "am_anon"
    anon_cookie_domain: str | None = None
    anon_cookie_secure: bool = False  # True in prod (HTTPS only)

    # Object storage (S3-compatible: Cloudflare R2 in prod, MinIO locally).
    s3_endpoint: str | None = None
    s3_region: str = "auto"
    s3_bucket: str = "annealmusic"
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_presign_ttl_seconds: int = 3600
    # When false (or no creds), use the in-memory storage adapter (tests/local).
    storage_backend: str = "memory"  # "memory" | "s3"

    # ffmpeg transcode (captures WAV -> Opus). Disabled in tests / when absent.
    transcode_enabled: bool = False
    opus_bitrate_kbps: int = 96

    # Rate limiting.
    rate_limit_enabled: bool = True
    rate_limit_backend: str = "memory"  # "memory" | "redis" (future)

    # Quotas (per anon user).
    quota_patches: int = 100
    quota_captures: int = 50
    quota_recordings: int = 10
    quota_bytes: int = 1024 * 1024 * 1024  # 1 GiB

    # Capture upload limits.
    max_capture_seconds: int = 60
    max_capture_bytes: int = 30 * 1024 * 1024  # generous WAV ceiling

    # --- v0.8 gallery ---------------------------------------------------------
    # Moderation: a small static term list lives in app/moderation.py; this is a
    # comma-separated env extension (heuristic-drift rule: one home, two inputs).
    moderation_extra_terms: str = ""
    # Admin panel auth. When unset, the admin endpoints are disabled (404).
    admin_key: str | None = None
    # Server-side preview rendering (headless Chromium). Off in tests/local.
    render_enabled: bool = False
    render_backend: str = "inprocess"  # "inprocess" | "external" (future)
    render_concurrency: int = 2
    preview_duration_sec: int = 20
    preview_bitrate_kbps: int = 96
    # A render stuck in 'rendering' longer than this is re-enqueued (restart sweep).
    render_stale_seconds: int = 300
    # Hard wall-clock cap for a single render before it's failed.
    render_timeout_seconds: int = 45
    # URL the headless harness is loaded from. The web build emits it at
    # `/render.html`; in prod set this to the web origin (e.g.
    # https://annealmusic.web.app/render.html). See docs/DEPLOY.md.
    render_harness_url: str = "http://localhost:5173/render.html"

    # Observability.
    sentry_dsn: str | None = None

    @property
    def is_prod(self) -> bool:
        return self.env == "prod"


@lru_cache
def get_settings() -> Settings:
    return Settings()
