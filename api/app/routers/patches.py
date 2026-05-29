from __future__ import annotations

import base64
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Request, BackgroundTasks
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.deps import (
    CurrentUser,
    CurrentWriter,
    SessionDep,
    StorageDep,
    _client_ip,
    rate_limit,
    Identity,
    get_identity,
)
import logging
from app.errors import (
    content_rejected,
    forbidden,
    invalid_state,
    not_found,
    quota_exceeded,
    under_review,
    requires_source_consent,
)
from app.models import Capture, Patch, UserSource
from app.moderation import screen_publish
from app.schemas import (
    LoadOut,
    PatchCreate,
    PatchListOut,
    PatchOut,
    PatchUpdate,
    GalleryListOut,
)
from app.share import parse_engine, parse_mode
from app.slug import new_slug
from app.validation import validate_payload

logger = logging.getLogger("patches")


def extract_user_sources_from_payload(payload: str) -> list[uuid.UUID]:
    """Finds any gr.source=u:<uuid> in the payload."""
    ids: list[uuid.UUID] = []
    for pair in payload.split("&"):
        if pair.startswith("gr.source=u:"):
            raw_uuid = pair[len("gr.source=u:"):]
            try:
                ids.append(uuid.UUID(raw_uuid))
            except ValueError:
                pass
    return ids


def _publish(patch: Patch, request: Request) -> None:
    """Mark a patch published (first time only) and enqueue a preview render."""
    if patch.published_at is None:
        patch.published_at = datetime.now(tz=timezone.utc)
    patch.preview_status = "rendering"
    request.app.state.render_queue.enqueue(patch.id)

router = APIRouter(prefix="/api/v1/patches", tags=["patches"])


def to_out(patch: Patch) -> PatchOut:
    state = patch.state or {}
    return PatchOut(
        id=patch.id,
        schema_ver=patch.schema_ver,
        state=state.get("payload", ""),
        title=patch.title,
        description=patch.description,
        visibility=patch.visibility,  # type: ignore[arg-type]
        capture_refs=patch.capture_refs,
        short_slug=patch.short_slug,
        created_at=patch.created_at,
        updated_at=patch.updated_at,
        ai_description=patch.ai_description,
        ai_description_source=patch.ai_description_source,
    )


async def _insert_with_slug(session: AsyncSession, patch: Patch) -> Patch:
    # 62^8 ≈ 2e14 keyspace over an 8-char slug — collision is negligible, so a
    # single allocation + flush is sufficient (the UNIQUE index is the backstop).
    patch.short_slug = new_slug()
    session.add(patch)
    await session.flush()
    return patch


@router.post(
    "", response_model=PatchOut, status_code=201,
    dependencies=[Depends(rate_limit("patches"))],
)
async def create_patch(
    body: PatchCreate, user: CurrentWriter, session: SessionDep, request: Request,
    background_tasks: BackgroundTasks
) -> PatchOut:
    errors = validate_payload(body.state, body.schema_ver)
    if errors:
        raise invalid_state(errors)

    settings = get_settings()
    if user.patch_count >= settings.quota_patches:
        raise quota_exceeded("patches", settings.quota_patches)

    # Auto-screen text when the patch is born public.
    if body.visibility == "public":
        rejected = screen_publish(body.title, body.description)
        if rejected:
            raise content_rejected(rejected)

    # Bind capture refs the user actually owns; bump their ref counts.
    refs: list[uuid.UUID] = []
    if body.capture_refs:
        owned = (
            await session.execute(
                select(Capture).where(
                    Capture.id.in_(body.capture_refs),
                    Capture.user_id == user.id,
                )
            )
        ).scalars().all()
        owned_ids = {c.id for c in owned}
        missing = [r for r in body.capture_refs if r not in owned_ids]
        if missing:
            raise not_found("capture")
        refs = list(owned_ids)
        for cap in owned:
            cap.ref_count += 1

    # Bind and verify user sources referenced in the state payload.
    referenced_source_ids = extract_user_sources_from_payload(body.state)
    loaded_sources: list[UserSource] = []
    if referenced_source_ids:
        stmt = select(UserSource).where(UserSource.id.in_(referenced_source_ids))
        loaded_sources = (await session.execute(stmt)).scalars().all()
        loaded_ids = {s.id for s in loaded_sources}
        for sid in referenced_source_ids:
            if sid not in loaded_ids:
                raise not_found("user_source")
        for src in loaded_sources:
            if src.user_id != user.id and src.visibility != "shared":
                raise forbidden()

    # Consent and transition check for public patches
    if body.visibility == "public" and loaded_sources:
        owned_unlisted = [s for s in loaded_sources if s.user_id == user.id and s.visibility == "unlisted"]
        if owned_unlisted:
            if not body.acknowledge_source_visibility:
                raise requires_source_consent()
            for src in owned_unlisted:
                src.visibility = "shared"
                logger.info("Transitioned user source %s visibility to shared due to patch publication", src.id)

    # Bump ref counts of referenced user sources
    for src in loaded_sources:
        src.ref_count += 1

    patch = Patch(
        user_id=user.id,
        schema_ver=body.schema_ver,
        state={"v": body.schema_ver, "payload": body.state},
        title=body.title,
        description=body.description,
        visibility=body.visibility,
        capture_refs=refs,
        engine=parse_engine(body.state),
        mode=parse_mode(body.state),
        has_captures=bool(refs),
    )
    await _insert_with_slug(session, patch)
    if body.visibility == "public":
        _publish(patch, request)
    user.patch_count += 1
    await session.commit()
    await session.refresh(patch)

    if body.visibility == "public":
        from app.db import get_sessionmaker
        background_tasks.add_task(
            embed_patch_task,
            patch.id,
            get_sessionmaker(),
            request.app.state.llm,
            request.app.state.embeddings
        )

    return to_out(patch)


@router.get("/me", response_model=PatchListOut,
            dependencies=[Depends(rate_limit("get"))])
async def list_my_patches(
    user: CurrentUser,
    session: SessionDep,
    identity: Identity = Depends(get_identity),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> PatchListOut:
    if identity.account_id is not None:
        stmt = select(Patch).where(Patch.user_id.in_(identity.owned_anon_ids))
    else:
        stmt = select(Patch).where(Patch.user_id == user.id)
    if cursor:
        before = _decode_cursor(cursor)
        if before is not None:
            stmt = stmt.where(Patch.created_at < before)
    stmt = stmt.order_by(Patch.created_at.desc()).limit(limit + 1)
    rows = (await session.execute(stmt)).scalars().all()
    await session.commit()

    next_cursor = None
    if len(rows) > limit:
        rows = rows[:limit]
        next_cursor = _encode_cursor(rows[-1].created_at)
    return PatchListOut(items=[to_out(p) for p in rows], next_cursor=next_cursor)


@router.get("/{id_or_slug}", response_model=PatchOut,
            dependencies=[Depends(rate_limit("get"))])
async def get_patch(id_or_slug: str, session: SessionDep) -> PatchOut:
    # Link-only read: no user minted. Both 'unlisted' and 'public' are readable
    # by anyone holding the slug/id in v0.7; the gallery (v0.8) adds the listing
    # surface that makes 'public' meaningfully different.
    patch = await _resolve(session, id_or_slug)
    if patch is None:
        raise not_found("patch")
    if patch.visibility == "flagged":
        raise under_review()
    return to_out(patch)


@router.post("/{id_or_slug}/load", response_model=LoadOut,
             dependencies=[Depends(rate_limit("get"))])
async def load_patch(
    id_or_slug: str, request: Request, session: SessionDep
) -> LoadOut:
    """Increment load_count when a gallery card is loaded into the app. The
    increment is rate-limited per (IP, patch); over the limit it is a silent
    no-op so loading is never blocked."""
    patch = await _resolve(session, id_or_slug)
    if patch is None:
        raise not_found("patch")
    if patch.visibility == "flagged":
        raise under_review()

    limiter = request.app.state.rate_limiter
    if get_settings().rate_limit_enabled and not limiter.allow_load(
        ip=_client_ip(request), patch_id=str(patch.id)
    ):
        return LoadOut(load_count=patch.load_count)  # silent: don't double-count

    patch.load_count += 1
    await session.commit()
    return LoadOut(load_count=patch.load_count)


@router.get("/{id_or_slug}/preview", dependencies=[Depends(rate_limit("get"))])
async def get_preview(
    id_or_slug: str, request: Request, session: SessionDep, storage: StorageDep
):
    """Stream the audio thumbnail. 302→ready, 202→rendering, 404→not public,
    503→render failed."""
    patch = await _resolve(session, id_or_slug)
    if patch is None or patch.visibility != "public":
        raise not_found("preview")

    if patch.preview_status == "ready" and patch.preview_storage_key:
        url = await storage.presigned_get_url(patch.preview_storage_key)
        return RedirectResponse(
            url=url, status_code=302,
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )
    if patch.preview_status == "failed":
        return JSONResponse(
            status_code=503, content={"error": "preview_failed"},
            headers={"Cache-Control": "no-store"},
        )
    # 'none' or 'rendering' — re-enqueue a render that may have been lost.
    request.app.state.render_queue.enqueue(patch.id)
    return JSONResponse(
        status_code=202, content={"status": "rendering"},
        headers={"Cache-Control": "no-store"},
    )


@router.patch("/{id}", response_model=PatchOut,
              dependencies=[Depends(rate_limit("patches"))])
async def update_patch(
    id: uuid.UUID, body: PatchUpdate, user: CurrentWriter, session: SessionDep,
    request: Request, background_tasks: BackgroundTasks
) -> PatchOut:
    patch = await session.get(Patch, id)
    if patch is None:
        raise not_found("patch")
    if patch.user_id != user.id:
        raise forbidden()
    if body.title is not None:
        patch.title = body.title
    if body.description is not None:
        patch.description = body.description

    going_public = body.visibility == "public" and patch.visibility != "public"
    if body.visibility is not None:
        patch.visibility = body.visibility
    if going_public:
        # Check referenced user sources and require consent
        referenced_source_ids = extract_user_sources_from_payload(patch.state.get("payload", ""))
        if referenced_source_ids:
            stmt = select(UserSource).where(UserSource.id.in_(referenced_source_ids))
            loaded_sources = (await session.execute(stmt)).scalars().all()
            owned_unlisted = [s for s in loaded_sources if s.user_id == user.id and s.visibility == "unlisted"]
            if owned_unlisted:
                if not body.acknowledge_source_visibility:
                    raise requires_source_consent()
                for src in owned_unlisted:
                    src.visibility = "shared"
                    logger.info("Transitioned user source %s visibility to shared due to patch publication update", src.id)

        rejected = screen_publish(patch.title, patch.description)
        if rejected:
            raise content_rejected(rejected)
        _publish(patch, request)

    description_changed = body.description is not None and body.description != patch.description

    await session.commit()
    await session.refresh(patch)

    if going_public or (patch.visibility == "public" and description_changed):
        from app.db import get_sessionmaker
        background_tasks.add_task(
            embed_patch_task,
            patch.id,
            get_sessionmaker(),
            request.app.state.llm,
            request.app.state.embeddings
        )

    return to_out(patch)


@router.delete("/{id}", status_code=204,
               dependencies=[Depends(rate_limit("patches"))])
async def delete_patch(
    id: uuid.UUID, user: CurrentWriter, session: SessionDep
) -> None:
    patch = await session.get(Patch, id)
    if patch is None:
        raise not_found("patch")
    if patch.user_id != user.id:
        raise forbidden()
    # Dereference captures (real deletion; orphans swept on schedule).
    if patch.capture_refs:
        await session.execute(
            update(Capture)
            .where(Capture.id.in_(patch.capture_refs))
            .values(ref_count=Capture.ref_count - 1)
        )
    # Dereference user sources referenced in the state payload.
    referenced_source_ids = extract_user_sources_from_payload(patch.state.get("payload", ""))
    if referenced_source_ids:
        await session.execute(
            update(UserSource)
            .where(UserSource.id.in_(referenced_source_ids))
            .values(ref_count=UserSource.ref_count - 1)
        )
    await session.delete(patch)
    user.patch_count = max(0, user.patch_count - 1)
    await session.commit()


async def _resolve(session: AsyncSession, id_or_slug: str) -> Patch | None:
    try:
        pid = uuid.UUID(id_or_slug)
        patch = await session.get(Patch, pid)
        if patch is not None:
            return patch
    except ValueError:
        pass
    return (
        await session.execute(select(Patch).where(Patch.short_slug == id_or_slug))
    ).scalar_one_or_none()


def _encode_cursor(dt: datetime) -> str:
    return base64.urlsafe_b64encode(dt.isoformat().encode()).decode()


def _decode_cursor(cursor: str) -> datetime | None:
    try:
        return datetime.fromisoformat(
            base64.urlsafe_b64decode(cursor.encode()).decode()
        )
    except (ValueError, TypeError):
        return None


async def embed_patch_task(
    patch_id: uuid.UUID,
    session_maker: Any,
    llm: Any,
    embeddings: Any,
) -> None:
    """Background task to generate AI description and embeddings for a public patch."""
    async with session_maker() as session:
        patch = await session.get(Patch, patch_id)
        if not patch or patch.visibility != "public":
            return

        # If it doesn't have a description, let's suggest one using AI!
        if not patch.description:
            try:
                from app.routers.ai import generate_ai_description_internal
                desc = await generate_ai_description_internal(patch.state.get("payload", ""), llm)
                patch.description = desc
                patch.ai_description = desc
                patch.ai_description_source = "ai"
                await session.flush()
            except Exception:
                logger.error("Failed to generate AI description in background for patch %s", patch_id, exc_info=True)
                return

        # Generate embedding for the description
        try:
            vector = await embeddings.embed(patch.description)
            patch.ai_description_embedding = vector
            await session.commit()
            logger.info("Successfully generated and saved embedding for patch %s", patch_id)
        except Exception:
            logger.error("Failed to generate embedding in background for patch %s", patch_id, exc_info=True)


@router.get("/{id}/similar", response_model=GalleryListOut,
            dependencies=[Depends(rate_limit("get"))])
async def get_similar_patches(
    id: uuid.UUID,
    session: SessionDep,
    limit: int = Query(default=8, ge=1, le=24),
) -> GalleryListOut:
    patch = await session.get(Patch, id)
    if not patch or patch.visibility != "public" or not patch.ai_description_embedding:
        return GalleryListOut(items=[])

    dialect = session.bind.dialect.name if session.bind is not None else "sqlite"
    from app.models import User, Account

    # 1. Fetch public patches
    if dialect == "postgresql":
        stmt = (
            select(Patch, Account.display_name, Account.avatar_seed, Account.id)
            .outerjoin(User, User.id == Patch.user_id)
            .outerjoin(Account, Account.id == User.account_id)
            .where(
                Patch.visibility == "public",
                Patch.id != patch.id,
                Patch.ai_description_embedding.is_not(None),
            )
            .order_by(Patch.ai_description_embedding.op("<=>")(patch.ai_description_embedding))
            .limit(limit)
        )
        res = await session.execute(stmt)
        rows = res.all()
    else:
        stmt = (
            select(Patch, Account.display_name, Account.avatar_seed, Account.id)
            .outerjoin(User, User.id == Patch.user_id)
            .outerjoin(Account, Account.id == User.account_id)
            .where(
                Patch.visibility == "public",
                Patch.id != patch.id,
            )
        )
        res = await session.execute(stmt)
        rows = res.all()

    # 2. Compute similarity/distance in Python to ensure total consistency and fallback
    import math
    def get_cosine_dist(v1: list[float], v2: list[float]) -> float:
        dot = sum(a * b for a, b in zip(v1, v2))
        norm_a = math.sqrt(sum(a * a for a in v1))
        norm_b = math.sqrt(sum(b * b for b in v2))
        if norm_a == 0 or norm_b == 0:
            return 1.0
        return 1.0 - (dot / (norm_a * norm_b))

    scored = []
    target_vec = patch.ai_description_embedding
    if isinstance(target_vec, str):
        target_vec = json.loads(target_vec)

    for r in rows:
        other_patch = r[0]
        if other_patch.ai_description_embedding:
            try:
                other_vec = other_patch.ai_description_embedding
                if isinstance(other_vec, str):
                    other_vec = json.loads(other_vec)

                dist = get_cosine_dist(target_vec, other_vec)
                if dist < 0.4:
                    scored.append((dist, r))
            except Exception:
                pass

    scored.sort(key=lambda x: x[0])
    top_rows = [r for _, r in scored[:limit]]

    from app.routers.gallery import _to_item
    return GalleryListOut(
        items=[_to_item(row[0], row[1], row[2], row[3]) for row in top_rows]
    )

