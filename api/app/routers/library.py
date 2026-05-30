"""v4.5 — public reads for the curated ``/listen`` library.

Editorial-only: rows are created via the admin endpoints (see admin.py). These
endpoints expose the active (non-archived) catalog and the current editor picks.
Previews are *derived* from each listing's source piece/patch (the v0.8 pipeline
already renders those) rather than duplicated onto listings.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import SessionDep, rate_limit
from app.models import LibraryListing, ListeningSession, Piece, Patch
from app.schemas import LibraryListingOut, LibraryListOut

router = APIRouter(prefix="/api/v1/library", tags=["library"])


async def _derive_preview(
    session: AsyncSession, ls: ListeningSession | None
) -> tuple[int | None, str]:
    """Return (total_duration_ms, preview_status) from the source artifact."""
    if ls is None:
        return None, "none"
    if ls.piece_id is not None:
        piece = await session.get(Piece, ls.piece_id)
        if piece is not None:
            return piece.total_duration_ms, piece.preview_status
    if ls.patch_id is not None:
        patch = await session.get(Patch, ls.patch_id)
        if patch is not None:
            return ls.total_duration_ms, patch.preview_status
    return ls.total_duration_ms, "none"


async def listing_to_out(
    session: AsyncSession, listing: LibraryListing
) -> LibraryListingOut:
    ls = await session.get(ListeningSession, listing.listening_session_id)
    total_ms, preview_status = await _derive_preview(session, ls)
    return LibraryListingOut(
        id=listing.id,
        listening_session_id=listing.listening_session_id,
        intention=listing.intention,
        length_category=listing.length_category,
        character_tags=list(listing.character_tags or []),
        editor_pick=listing.editor_pick,
        editor_pick_at=listing.editor_pick_at,
        curator_note=listing.curator_note,
        added_at=listing.added_at,
        session_title=ls.title if ls else None,
        session_slug=ls.short_slug if ls else None,
        total_duration_ms=total_ms,
        preview_status=preview_status,
    )


@router.get("", response_model=LibraryListOut,
            dependencies=[Depends(rate_limit("get"))])
async def list_library(
    session: SessionDep,
    intention: str | None = Query(default=None),
    length: str | None = Query(default=None),
    character: str | None = Query(default=None),
    picks: str | None = Query(default=None),
) -> LibraryListOut:
    stmt = select(LibraryListing).where(LibraryListing.archived_at.is_(None))
    if intention:
        stmt = stmt.where(LibraryListing.intention == intention)
    if length:
        stmt = stmt.where(LibraryListing.length_category == length)
    if picks == "only":
        stmt = stmt.where(LibraryListing.editor_pick.is_(True))
    stmt = stmt.order_by(LibraryListing.added_at.desc())

    rows = (await session.execute(stmt)).scalars().all()

    # ``character`` filters on the JSON/array tag set in Python so the same code
    # path works on both SQLite (tests) and Postgres (prod).
    if character:
        rows = [r for r in rows if character in (r.character_tags or [])]

    items = [await listing_to_out(session, r) for r in rows]
    return LibraryListOut(items=items)


@router.get("/picks", response_model=LibraryListOut,
            dependencies=[Depends(rate_limit("get"))])
async def list_picks(session: SessionDep) -> LibraryListOut:
    stmt = (
        select(LibraryListing)
        .where(
            LibraryListing.archived_at.is_(None),
            LibraryListing.editor_pick.is_(True),
        )
        .order_by(LibraryListing.editor_pick_at.desc())
    )
    rows = (await session.execute(stmt)).scalars().all()
    items = [await listing_to_out(session, r) for r in rows]
    return LibraryListOut(items=items)
