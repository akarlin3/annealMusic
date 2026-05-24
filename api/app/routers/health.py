from __future__ import annotations

from fastapi import APIRouter, Request, Response
from sqlalchemy import text

from app.db import get_sessionmaker

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    """Liveness: the process is up. No external dependencies touched."""
    return {"status": "ok"}


@router.get("/readyz")
async def readyz(request: Request, response: Response) -> dict[str, object]:
    """Readiness: database and object storage are reachable."""
    checks: dict[str, object] = {}

    db_ok = False
    try:
        sm = get_sessionmaker()
        async with sm() as session:
            await session.execute(text("SELECT 1"))
        db_ok = True
    except Exception as exc:  # noqa: BLE001 - report, don't crash readiness
        checks["db_error"] = str(exc)
    checks["db"] = db_ok

    storage_ok = request.app.state.storage is not None
    checks["storage"] = storage_ok

    ready = db_ok and storage_ok
    if not ready:
        response.status_code = 503
    return {"status": "ok" if ready else "unavailable", "checks": checks}
