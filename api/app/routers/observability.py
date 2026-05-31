from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel

from app.deps import rate_limit
from app.logging_config import get_logger

logger = get_logger("observability")

router = APIRouter(prefix="/api/v1/observability", tags=["observability"])


class CrashReportIn(BaseModel):
    message: str
    stack: Optional[str] = None
    version: str
    buildSha: str
    browserOS: str
    sanitizedUrl: str
    context: Optional[str] = None
    timestamp: str


@router.post(
    "/crash-reports",
    status_code=204,
    dependencies=[Depends(rate_limit("crash_reports"))],
)
async def ingest_crash_report(body: CrashReportIn, request: Request) -> Response:
    logger.error(
        "Client crash report received",
        extra={
            "client_message": body.message,
            "client_stack": body.stack,
            "client_version": body.version,
            "client_build_sha": body.buildSha,
            "client_browser_os": body.browserOS,
            "client_url": body.sanitizedUrl,
            "client_context": body.context,
            "client_timestamp": body.timestamp,
            "request_id": getattr(request.state, "request_id", None),
        },
    )
    return Response(status_code=204)
