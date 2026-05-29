"""Public report flow: flag a patch for moderator review."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.deps import SessionDep, _parse_uuid, rate_limit
from app.errors import not_found
from app.models import Patch, Report, UserSource
from app.schemas import ReportCreate, ReportOut

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


@router.post("", response_model=ReportOut, status_code=201,
             dependencies=[Depends(rate_limit("reports"))])
async def create_report(
    body: ReportCreate, session: SessionDep, request: Request
) -> ReportOut:
    patch = await session.get(Patch, body.patch_id)
    if patch is None:
        raise not_found("patch")

    if body.source_id is not None:
        source = await session.get(UserSource, body.source_id)
        if source is None:
            raise not_found("user_source")

    # Reporter is optional (fully-anon reports allowed); never mint here.
    reporter = _parse_uuid(request.headers.get("x-anon-id"))
    report = Report(
        patch_id=body.patch_id,
        source_id=body.source_id,
        reporter_id=reporter,
        reason=body.reason,
        detail=body.detail,
    )
    session.add(report)
    await session.commit()
    await session.refresh(report)
    return ReportOut(id=report.id, status=report.status)  # type: ignore[arg-type]
