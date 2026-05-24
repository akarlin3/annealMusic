"""Minimal moderation admin: list open reports, dismiss/uphold, set visibility.
All endpoints gated by the ``x-admin-key`` header (``require_admin``)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select

from app.deps import SessionDep, require_admin
from app.errors import not_found
from app.models import Patch, Report
from app.schemas import (
    AdminReportItem,
    AdminReportListOut,
    AdminReportUpdate,
    AdminVisibilityUpdate,
    PatchOut,
    ReportStatus,
)

router = APIRouter(
    prefix="/api/v1/admin", tags=["admin"], dependencies=[Depends(require_admin)]
)


def _reporter_label(rid: uuid.UUID | None) -> str | None:
    return f"{str(rid)[:8]}…" if rid else "anonymous"


@router.get("/reports", response_model=AdminReportListOut)
async def list_reports(
    session: SessionDep,
    status: ReportStatus = Query(default="open"),
) -> AdminReportListOut:
    rows = (
        await session.execute(
            select(Report, Patch)
            .join(Patch, Report.patch_id == Patch.id)
            .where(Report.status == status)
            .order_by(Report.created_at.desc())
        )
    ).all()
    items = [
        AdminReportItem(
            id=r.id,
            patch_id=r.patch_id,
            patch_title=p.title,
            patch_slug=p.short_slug,
            patch_visibility=p.visibility,  # type: ignore[arg-type]
            preview_status=p.preview_status,  # type: ignore[arg-type]
            reason=r.reason,  # type: ignore[arg-type]
            detail=r.detail,
            reporter=_reporter_label(r.reporter_id),
            status=r.status,  # type: ignore[arg-type]
            created_at=r.created_at,
        )
        for (r, p) in rows
    ]
    return AdminReportListOut(items=items)


@router.patch("/reports/{report_id}", response_model=AdminReportItem)
async def update_report(
    report_id: uuid.UUID, body: AdminReportUpdate, session: SessionDep
) -> AdminReportItem:
    report = await session.get(Report, report_id)
    if report is None:
        raise not_found("report")
    patch = await session.get(Patch, report.patch_id)
    if patch is None:
        raise not_found("patch")

    report.status = body.status
    if body.status == "upheld":
        patch.visibility = "flagged"
    await session.commit()
    await session.refresh(report)

    return AdminReportItem(
        id=report.id,
        patch_id=report.patch_id,
        patch_title=patch.title,
        patch_slug=patch.short_slug,
        patch_visibility=patch.visibility,  # type: ignore[arg-type]
        preview_status=patch.preview_status,  # type: ignore[arg-type]
        reason=report.reason,  # type: ignore[arg-type]
        detail=report.detail,
        reporter=_reporter_label(report.reporter_id),
        status=report.status,  # type: ignore[arg-type]
        created_at=report.created_at,
    )


@router.patch("/patches/{patch_id}/visibility", response_model=PatchOut)
async def set_visibility(
    patch_id: uuid.UUID,
    body: AdminVisibilityUpdate,
    session: SessionDep,
    request: Request,
) -> PatchOut:
    patch = await session.get(Patch, patch_id)
    if patch is None:
        raise not_found("patch")

    going_public = body.visibility == "public" and patch.visibility != "public"
    patch.visibility = body.visibility
    if going_public:
        # Admin restore is an override — no re-screening.
        if patch.published_at is None:
            patch.published_at = datetime.now(tz=timezone.utc)
        patch.preview_status = "rendering"
        request.app.state.render_queue.enqueue(patch.id)
    await session.commit()
    await session.refresh(patch)

    from app.routers.patches import to_out

    return to_out(patch)
