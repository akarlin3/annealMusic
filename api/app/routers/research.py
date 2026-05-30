from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.config import get_settings

router = APIRouter(prefix="/research", tags=["research"])


def _shell() -> str:
    """Minimal HTML shell that loads the research console bundle."""
    settings = get_settings()
    asset_base = settings.embed_asset_base.rstrip("/")
    return (
        "<!doctype html><html lang=\"en\"><head>"
        "<meta charset=\"UTF-8\"/>"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"/>"
        "<title>AnnealMusic — Research Console</title>"
        "<style>"
        "html,body{margin:0;padding:0;width:100%;height:100%;background-color:#0c0a09;color:#f5f5f4;"
        "font-family:ui-sans-serif,system-ui,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"}"
        "</style>"
        "</head><body>"
        "<div id=\"research-root\"></div>"
        f"<script type=\"module\" src=\"{asset_base}/assets/research.js\"></script>"
        "</body></html>"
    )


@router.get("", response_class=HTMLResponse)
async def research_shell() -> HTMLResponse:
    """Serve the research shell."""
    return HTMLResponse(content=_shell())


@router.get("/{path:path}", response_class=HTMLResponse)
async def research_wildcard_shell(path: str) -> HTMLResponse:
    """Serve the research shell for any nested path."""
    return HTMLResponse(content=_shell())
