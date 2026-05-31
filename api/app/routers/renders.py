import uuid
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import object_session

from app.deps import SessionDep, SettingsDep, StorageDep, CurrentWriter
from app.models import RenderedArtifact
from app.schemas import RenderedArtifactOut, RenderedArtifactCreate
from app.services.video_render import VideoRenderService
from app.services.citation import CitationContext, Author, bibtex

router = APIRouter(prefix="/api/v1/renders", tags=["renders"])


async def _run_video_render_bg(
    settings_obj,
    storage_obj,
    user_id: uuid.UUID,
    source_kind: str,
    source_id: uuid.UUID,
    resolution: str,
    duration_sec: int,
    artifact_id: uuid.UUID,
):
    """Background task to execute Playwright render + FFmpeg transcode."""
    from app.db import get_sessionmaker
    async with get_sessionmaker()() as session:
        service = VideoRenderService(settings_obj, storage_obj)
        try:
            # We construct a wrapper so render_video adds directly to database
            payload, title, creator = await service.get_payload_and_metadata(session, source_kind, source_id)
            width, height = 1920, 1080
            if "x" in resolution:
                try:
                    w_s, h_s = resolution.split("x")
                    width, height = int(w_s), int(h_s)
                except Exception:
                    pass

            browser = await service._ensure_browser()
            page = await browser.new_page()
            try:
                await page.set_viewport_size({"width": width, "height": height})
                await page.goto(service.settings.render_harness_url)

                capture_urls = []
                # If patch, presign captures
                if source_kind == "patch":
                    from app.models import Patch
                    patch = await session.get(Patch, source_id)
                    if patch:
                        from app.render import RenderQueue
                        q = RenderQueue(service.settings)
                        capture_urls = await q._presign_captures(session, patch)

                # Headless capture
                b64_webm = await page.evaluate(
                    """async ([payload, dur, w, h, urls]) => {
                        const res = await window.__annealVideoRender(payload, {
                            durationSec: dur,
                            width: w,
                            height: h,
                            fps: 30,
                            captureUrls: urls,
                        });
                        return res.b64;
                    }""",
                    [payload, duration_sec, width, height, capture_urls],
                )

                import base64
                import os
                import tempfile
                webm_bytes = base64.b64decode(b64_webm)

                with tempfile.TemporaryDirectory() as tmpdir:
                    webm_path = os.path.join(tmpdir, "input.webm")
                    mp4_path = os.path.join(tmpdir, "output.mp4")
                    with open(webm_path, "wb") as f:
                        f.write(webm_bytes)

                    cmd = [
                        "ffmpeg", "-y", "-i", webm_path,
                        "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                        "-c:a", "aac", "-b:a", "192k", "-pix_fmt", "yuv420p",
                        mp4_path
                    ]
                    process = await asyncio.create_subprocess_exec(
                        *cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    stdout, stderr = await process.communicate()

                    if process.returncode != 0:
                        mp4_bytes = webm_bytes
                        storage_mime = "video/webm"
                    else:
                        with open(mp4_path, "rb") as f:
                            mp4_bytes = f.read()
                        storage_mime = "video/mp4"

                await storage_obj.put(f"renders/{artifact_id}.mp4", mp4_bytes, storage_mime)

                # Update artifact model row
                artifact = await session.get(RenderedArtifact, artifact_id)
                if artifact:
                    artifact.bytes = len(mp4_bytes)
                    # Compute citation
                    ctx = CitationContext(
                        title=title,
                        authors=[Author(name=creator)],
                        year=2026,
                        publisher="AnnealMusic",
                        url=f"{service.settings.public_base_url}/{source_kind}/{source_id}"
                    )
                    artifact.citation_bibtex = bibtex(ctx)
                    await session.commit()

            finally:
                await page.close()
                await service.aclose()

        except Exception as e:
            import logging
            logging.getLogger("video_render").exception("Background video render failed: %s", e)


@router.post("/image", response_model=RenderedArtifactOut)
async def render_image(
    req: RenderedArtifactCreate,
    session: SessionDep,
    settings: SettingsDep,
    storage: StorageDep,
    current_user: CurrentWriter,
):
    """Synchronously render a still visualizer image."""
    service = VideoRenderService(settings, storage)
    try:
        artifact = await service.render_still_image(
            session=session,
            user_id=current_user.id,
            source_kind=req.source_kind,
            source_id=req.source_id,
            resolution=req.resolution or "1920x1080",
        )
        return artifact
    finally:
        await service.aclose()


@router.post("/video", response_model=RenderedArtifactOut)
async def queue_video(
    req: RenderedArtifactCreate,
    session: SessionDep,
    settings: SettingsDep,
    storage: StorageDep,
    current_user: CurrentWriter,
    background_tasks: BackgroundTasks,
):
    """Queue a visualizer video render to compile in the background."""
    artifact_id = uuid.uuid4()
    storage_key = f"renders/{artifact_id}.mp4"

    # Pre-insert database row marked pending (bytes=None)
    artifact = RenderedArtifact(
        id=artifact_id,
        user_id=current_user.id,
        source_kind=req.source_kind,
        source_id=req.source_id,
        render_kind="video",
        storage_key=storage_key,
        bytes=None,  # Marks rendering in progress
        resolution=req.resolution or "1920x1080",
        duration_ms=(req.duration_ms or 15000),
        created_at=datetime.now(timezone.utc),
    )
    session.add(artifact)
    await session.commit()
    if object_session(artifact) is not None:
        await session.refresh(artifact)

    duration_sec = int((req.duration_ms or 15000) / 1000)

    # Queue background task
    import asyncio
    background_tasks.add_task(
        _run_video_render_bg,
        settings,
        storage,
        current_user.id,
        req.source_kind,
        req.source_id,
        req.resolution or "1920x1080",
        duration_sec,
        artifact_id,
    )

    return artifact


@router.post("/outreach-card", response_model=RenderedArtifactOut)
async def generate_outreach_card(
    req: RenderedArtifactCreate,
    session: SessionDep,
    settings: SettingsDep,
    storage: StorageDep,
    current_user: CurrentWriter,
):
    """Generate an Outreach Card packaging short audio, visual, description, and BibTeX citation."""
    service = VideoRenderService(settings, storage)
    try:
        # Step 1: Render a short 15s visualizer video
        artifact = await service.render_video(
            session=session,
            user_id=current_user.id,
            source_kind=req.source_kind,
            source_id=req.source_id,
            resolution=req.resolution or "1280x720",  # Default social friendly size
            duration_sec=15,
        )

        # Mark as outreach card
        artifact.render_kind = "outreach-card"
        await session.commit()
        if object_session(artifact) is not None:
            await session.refresh(artifact)
        return artifact
    finally:
        await service.aclose()


@router.get("/{id}", response_model=RenderedArtifactOut)
async def get_render_status(
    id: uuid.UUID,
    session: SessionDep,
):
    """Retrieve the status and metadata of a rendered output."""
    artifact = await session.get(RenderedArtifact, id)
    if not artifact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rendered artifact not found"
        )
    return artifact


@router.get("/{id}/download")
async def download_render(
    id: uuid.UUID,
    session: SessionDep,
    storage: StorageDep,
):
    """Download the completed rendered output file directly from object store."""
    artifact = await session.get(RenderedArtifact, id)
    if not artifact or artifact.bytes is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Render file is still building or does not exist"
        )

    # Redirect to presigned storage URL
    url = await storage.presigned_get_url(artifact.storage_key)
    return RedirectResponse(url=url)
