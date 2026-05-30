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
from app.errors import not_found, bad_request
from app.library_taxonomy import validate_taxonomy
from app.models import (
    Patch,
    Report,
    UserSource,
    Account,
    FeaturedPick,
    LibraryListing,
    ListeningSession,
)
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
    AdminLibraryCreate,
    AdminLibraryUpdate,
    LibraryListingOut,
    LibraryListOut,
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


# --- v4.5 Curated Library Curation ------------------------------------------


@router.post("/library", response_model=LibraryListingOut, status_code=201)
async def add_library_listing(
    body: AdminLibraryCreate,
    session: SessionDep,
) -> LibraryListingOut:
    err = validate_taxonomy(
        body.intention, body.length_category, body.character_tags
    )
    if err:
        raise bad_request(err)

    ls = await session.get(ListeningSession, body.listening_session_id)
    if ls is None:
        raise not_found("listening_session")
    # A listing must point at something previewable (piece or patch source).
    if ls.piece_id is None and ls.patch_id is None:
        raise bad_request("Listening session has no previewable source artifact")

    listing = LibraryListing(
        listening_session_id=body.listening_session_id,
        intention=body.intention or ls.intention,
        length_category=body.length_category or ls.length_category,
        character_tags=body.character_tags,
        curator_note=body.curator_note,
    )
    session.add(listing)
    await session.commit()
    await session.refresh(listing)

    from app.routers.library import listing_to_out

    return await listing_to_out(session, listing)


@router.get("/library", response_model=LibraryListOut)
async def list_library_admin(
    session: SessionDep,
    include_archived: bool = Query(default=False),
) -> LibraryListOut:
    stmt = select(LibraryListing)
    if not include_archived:
        stmt = stmt.where(LibraryListing.archived_at.is_(None))
    stmt = stmt.order_by(LibraryListing.added_at.desc())
    rows = (await session.execute(stmt)).scalars().all()

    from app.routers.library import listing_to_out

    items = [await listing_to_out(session, r) for r in rows]
    return LibraryListOut(items=items)


@router.patch("/library/{listing_id}", response_model=LibraryListingOut)
async def update_library_listing(
    listing_id: uuid.UUID,
    body: AdminLibraryUpdate,
    session: SessionDep,
) -> LibraryListingOut:
    listing = await session.get(LibraryListing, listing_id)
    if listing is None:
        raise not_found("library_listing")

    err = validate_taxonomy(
        body.intention, body.length_category, body.character_tags
    )
    if err:
        raise bad_request(err)

    if body.intention is not None:
        listing.intention = body.intention
    if body.length_category is not None:
        listing.length_category = body.length_category
    if body.character_tags is not None:
        listing.character_tags = body.character_tags
    if "curator_note" in body.model_fields_set:
        listing.curator_note = body.curator_note
    if body.editor_pick is not None:
        listing.editor_pick = body.editor_pick
        # Stamp the pick time when promoting; clear it when demoting.
        listing.editor_pick_at = (
            datetime.now(tz=timezone.utc) if body.editor_pick else None
        )

    await session.commit()
    await session.refresh(listing)

    from app.routers.library import listing_to_out

    return await listing_to_out(session, listing)


@router.delete("/library/{listing_id}", status_code=204)
async def archive_library_listing(
    listing_id: uuid.UUID,
    session: SessionDep,
) -> None:
    listing = await session.get(LibraryListing, listing_id)
    if listing is None:
        raise not_found("library_listing")
    listing.archived_at = datetime.now(tz=timezone.utc)
    await session.commit()

