"""Minimal moderation admin: list open reports, dismiss/uphold, set visibility.
All endpoints gated by the ``x-admin-key`` header (``require_admin``)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select, delete

from app.deps import SessionDep, require_admin
from app.errors import not_found
from app.models import Patch, Report, UserSource, Account, FeaturedPick
from app.schemas import (
    AdminReportItem,
    AdminReportListOut,
    AdminReportUpdate,
    AdminVisibilityUpdate,
    AdminSourceVisibilityUpdate,
    PatchOut,
    UserSourceOut,
    ReportStatus,
    FeaturedPickCreate,
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
            source_id=r.source_id,
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
        if report.source_id is not None:
            source = await session.get(UserSource, report.source_id)
            if source is not None:
                source.visibility = "flagged"
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
        source_id=report.source_id,
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


@router.patch("/user-sources/{source_id}/visibility", response_model=UserSourceOut)
async def set_user_source_visibility(
    source_id: uuid.UUID,
    body: AdminSourceVisibilityUpdate,
    session: SessionDep,
) -> UserSourceOut:
    source = await session.get(UserSource, source_id)
    if source is None:
        raise not_found("user_source")

    source.visibility = body.visibility
    await session.commit()
    await session.refresh(source)

    return UserSourceOut.model_validate(source)


# --- Admin Curated Featured Picks Endpoints ----------------------------------

@router.post("/featured")
async def curate_featured_picks(
    body: list[FeaturedPickCreate],
    session: SessionDep,
) -> dict:
    # We curate for the current week's Monday
    today = date.today()
    current_monday = today - timedelta(days=today.weekday())

    # Delete existing picks for the current week
    await session.execute(
        delete(FeaturedPick).where(FeaturedPick.week_starting == current_monday)
    )

    # Insert new picks
    for pick_in in body:
        # Check patch exists
        patch = await session.get(Patch, pick_in.patch_id)
        if patch is None or patch.visibility != "public":
            raise not_found(f"public patch {pick_in.patch_id}")

        pick = FeaturedPick(
            week_starting=current_monday,
            patch_id=pick_in.patch_id,
            position=pick_in.position,
            curator_note=pick_in.curator_note,
        )
        session.add(pick)

    await session.commit()
    return {"success": True}


@router.delete("/featured/{pick_id}", status_code=204)
async def delete_featured_pick(
    pick_id: uuid.UUID,
    session: SessionDep,
) -> None:
    pick = await session.get(FeaturedPick, pick_id)
    if pick is None:
        raise not_found("featured_pick")
    await session.delete(pick)
    await session.commit()


# --- Admin User Suspension Endpoints ----------------------------------------

@router.post("/accounts/{account_id}/suspend")
async def suspend_account(
    account_id: uuid.UUID,
    session: SessionDep,
) -> dict:
    account = await session.get(Account, account_id)
    if account is None:
        raise not_found("account")

    account.suspended = True

    # Under-the-hood: hide all their patches by setting their visibility to flagged/unlisted
    # (actually we just cascade hide in queries, but let's make sure we also revoke active sessions)
    from app.models import Session as DbSession
    await session.execute(
        delete(DbSession).where(DbSession.account_id == account_id)
    )
    await session.commit()
    return {"success": True}


@router.delete("/accounts/{account_id}/suspend")
async def unsuspend_account(
    account_id: uuid.UUID,
    session: SessionDep,
) -> dict:
    account = await session.get(Account, account_id)
    if account is None:
        raise not_found("account")

    account.suspended = False
    await session.commit()
    return {"success": True}

