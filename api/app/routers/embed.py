from __future__ import annotations

import html

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.config import get_settings
from app.deps import SessionDep
from app.routers.patches import _resolve

# Not under /api/v1: this is a user-facing HTML surface (the iframe target). The
# security middleware exempts the /embed prefix from X-Frame-Options and sets
# `Content-Security-Policy: frame-ancestors *` so it can be embedded anywhere.
router = APIRouter(prefix="/embed", tags=["embed"])


def _shell(slug: str, *, gated: bool) -> str:
    """Minimal HTML shell that loads the tiny static embed bundle. The bundle
    reads the slug from the `/embed/<slug>` path and the `?theme=` query."""
    settings = get_settings()
    asset_base = settings.embed_asset_base.rstrip("/")
    safe_slug = html.escape(slug)
    note = (
        "<noscript>This patch is not public.</noscript>" if gated else "<noscript>This embed needs JavaScript.</noscript>"
    )
    return (
        "<!doctype html><html lang=\"en\"><head>"
        "<meta charset=\"UTF-8\"/>"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"/>"
        f"<title>AnnealMusic — {safe_slug}</title>"
        "<style>html,body{margin:0;padding:0}</style>"
        "</head><body>"
        "<div id=\"embed-root\"></div>"
        f"{note}"
        f"<script type=\"module\" src=\"{asset_base}/assets/embed.js\"></script>"
        "</body></html>"
    )


@router.get("/{id_or_slug}", response_class=HTMLResponse)
async def embed_shell(id_or_slug: str, session: SessionDep) -> HTMLResponse:
    """Serve the embed shell. Always 200 (the client renders a polite gated
    state for non-public patches); the iframe headers are applied by middleware."""
    patch = await _resolve(session, id_or_slug)
    gated = patch is None or patch.visibility != "public"
    return HTMLResponse(content=_shell(id_or_slug, gated=gated))
