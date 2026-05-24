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

    # Observability.
    sentry_dsn: str | None = None

    @property
    def is_prod(self) -> bool:
        return self.env == "prod"


@lru_cache
def get_settings() -> Settings:
    return Settings()
