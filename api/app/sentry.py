from __future__ import annotations

from app.config import Settings


def init_sentry(settings: Settings) -> None:
    """No-op unless ``SENTRY_DSN`` is set. v0.8 wires real reporting by setting
    the env var; v0.7 just leaves the seam."""
    if not settings.sentry_dsn:
        return
    try:
        import sentry_sdk  # pyright: ignore[reportMissingImports]

        sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.env)
    except ImportError:
        # sentry-sdk is intentionally not a hard dependency in v0.7.
        pass
