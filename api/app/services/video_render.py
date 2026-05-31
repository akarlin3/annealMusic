import asyncio
import base64
import logging
import os
import tempfile
import uuid
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models import RenderedArtifact, Patch, Piece, Sonification, ListeningSession, User
from app.storage import StorageClient
from app.services.citation import CitationContext, Author, bibtex

logger = logging.getLogger("video_render")


class VideoRenderService:
    def __init__(self, settings: Settings, storage: StorageClient) -> None:
        self.settings = settings
        self.storage = storage
        self._pw = None
        self._browser = None
        self._lock = asyncio.Lock()

    async def _ensure_browser(self):
        async with self._lock:
            if self._browser is None:
                from playwright.async_api import async_playwright

                self._pw = await async_playwright().start()
                self._browser = await self._pw.chromium.launch(
                    args=[
                        "--autoplay-policy=no-user-gesture-required",
                        "--no-sandbox",
                    ],
                )
        return self._browser

    async def aclose(self) -> None:
        if self._browser is not None:
            await self._browser.close()
            self._browser = None
        if self._pw is not None:
            await self._pw.stop()
            self._pw = None

    async def get_payload_and_metadata(self, session: AsyncSession, kind: str, item_id: uuid.UUID):
        """Helper to load payload and name/creator metadata for an artifact."""
        title = "Untitled"
        creator_name = "Anonymous"
        payload = ""

        if kind == "patch":
            item = await session.get(Patch, item_id)
            if item:
                payload = (item.state or {}).get("payload", "")
                title = item.title or "Untitled Patch"
                user = await session.get(User, item.user_id) if item.user_id else None
                if user:
                    # Let's see if user has email/profile display name
                    from app.models import Account
                    account = await session.get(Account, user.id)
                    if account and account.display_name:
                        creator_name = account.display_name
        elif kind == "piece":
            item = await session.get(Piece, item_id)
            if item:
                from app.render import RenderQueue
                # RenderQueue has an encoder helper
                from app.config import get_settings
                q = RenderQueue(get_settings())
                payload = await q._encode_piece_payload(session, item)
                title = item.title or "Untitled Piece"
                user = await session.get(User, item.user_id) if item.user_id else None
                if user:
                    from app.models import Account
                    account = await session.get(Account, user.id)
                    if account and account.display_name:
                        creator_name = account.display_name
        elif kind == "sonification":
            item = await session.get(Sonification, item_id)
            if item:
                # Build mock patch/piece state mapping
                payload = base64.b64encode(b'{"kind":"sonification"}').decode() # Fallback mapping representation
                title = item.title or "Untitled Sonification"
                user = await session.get(User, item.user_id) if item.user_id else None
                if user:
                    from app.models import Account
                    account = await session.get(Account, user.id)
                    if account and account.display_name:
                        creator_name = account.display_name
        elif kind == "listening_session":
            item = await session.get(ListeningSession, item_id)
            if item:
                payload = base64.b64encode(b'{"kind":"listening-session"}').decode()
                title = item.title or "Untitled Listening Session"
                user = await session.get(User, item.user_id) if item.user_id else None
                if user:
                    from app.models import Account
                    account = await session.get(Account, user.id)
                    if account and account.display_name:
                        creator_name = account.display_name

        return payload, title, creator_name

    async def render_still_image(
        self,
        session: AsyncSession,
        user_id: uuid.UUID,
        source_kind: str,
        source_id: uuid.UUID,
        resolution: str = "1920x1080",
    ) -> RenderedArtifact:
        """Render a still PNG snapshot of the visualizer state."""
        payload, title, creator = await self.get_payload_and_metadata(session, source_kind, source_id)
        if not payload:
            raise ValueError(f"Could not resolve payload for {source_kind} {source_id}")

        width, height = 1920, 1080
        if "x" in resolution:
            try:
                w_s, h_s = resolution.split("x")
                width, height = int(w_s), int(h_s)
            except Exception:
                pass

        browser = await self._ensure_browser()
        page = await browser.new_page()
        try:
            await page.set_viewport_size({"width": width, "height": height})
            await page.goto(self.settings.render_harness_url)

            # Evaluate a single-frame canvas capture
            b64_img: str = await page.evaluate(
                """async ([payload, w, h]) => {
                    // Initialize the store and renderer
                    useParamStore.getState().reset();
                    const decoded = decodeState(SCHEMA_VERSION, payload);
                    if (decoded.kind !== 'piece') {
                        applyDecodedToStore(decoded);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    document.body.appendChild(canvas);

                    const renderer = new CanvasRenderer();
                    renderer.mount(canvas);
                    renderer.resize(w, h, 1);

                    const phases = HARMONICS.map(() => Math.random() * Math.PI * 2);
                    const visualState = {
                        w: w,
                        h: h,
                        dt: 0.016,
                        phases,
                        freqs: HARMONICS.map(x => 220 * x),
                        count: HARMONICS.length,
                        spectrum: null,
                        sampleRate: 48000,
                        fftSize: 1024,
                        loops: [],
                        isCalm: false,
                        r: 0,
                    };

                    renderer.drawFrame(visualState, performance.now());
                    const dataUrl = canvas.toDataURL('image/png');
                    canvas.remove();
                    renderer.dispose();
                    return dataUrl.split(',')[1];
                }""",
                [payload, width, height],
            )

            img_bytes = base64.b64decode(b64_img)
            artifact_id = uuid.uuid4()
            storage_key = f"renders/{artifact_id}.png"
            await self.storage.put(storage_key, img_bytes, "image/png")

            # Generate BibTeX citation
            ctx = CitationContext(
                title=title,
                authors=[Author(name=creator)],
                year=2026,
                publisher="AnnealMusic",
                url=f"{self.settings.public_base_url}/{source_kind}/{source_id}"
            )
            citation = bibtex(ctx)

            artifact = RenderedArtifact(
                id=artifact_id,
                user_id=user_id,
                source_kind=source_kind,
                source_id=source_id,
                render_kind="image",
                storage_key=storage_key,
                bytes=len(img_bytes),
                resolution=resolution,
                duration_ms=0,
                citation_bibtex=citation,
                created_at=datetime.now(timezone.utc),
            )
            session.add(artifact)
            await session.commit()
            await session.refresh(artifact)
            return artifact

        finally:
            await page.close()

    async def render_video(
        self,
        session: AsyncSession,
        user_id: uuid.UUID,
        source_kind: str,
        source_id: uuid.UUID,
        resolution: str = "1920x1080",
        duration_sec: int = 15,
    ) -> RenderedArtifact:
        """Queue and process a high-quality visualizer video render to MP4."""
        payload, title, creator = await self.get_payload_and_metadata(session, source_kind, source_id)
        if not payload:
            raise ValueError(f"Could not resolve payload for {source_kind} {source_id}")

        width, height = 1920, 1080
        if "x" in resolution:
            try:
                w_s, h_s = resolution.split("x")
                width, height = int(w_s), int(h_s)
            except Exception:
                pass

        browser = await self._ensure_browser()
        page = await browser.new_page()
        try:
            await page.set_viewport_size({"width": width, "height": height})
            await page.goto(self.settings.render_harness_url)

            # Presign any captures
            capture_urls = []
            if source_kind == "patch":
                patch = await session.get(Patch, source_id)
                if patch:
                    from app.render import RenderQueue
                    from app.config import get_settings
                    q = RenderQueue(get_settings())
                    # Mock presigned client URLs
                    capture_urls = await q._presign_captures(session, patch)

            # Launch Playwright recording
            b64_webm: str = await page.evaluate(
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

            webm_bytes = base64.b64decode(b64_webm)

            # Transcode WebM to publishable MP4 via FFmpeg asynchronously
            with tempfile.TemporaryDirectory() as tmpdir:
                webm_path = os.path.join(tmpdir, "input.webm")
                mp4_path = os.path.join(tmpdir, "output.mp4")

                with open(webm_path, "wb") as f:
                    f.write(webm_bytes)

                # Execute non-blocking FFmpeg transcode
                cmd = [
                    "ffmpeg", "-y", "-i", webm_path,
                    "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                    "-c:a", "aac", "-b:a", "192k", "-pix_fmt", "yuv420p",
                    mp4_path
                ]
                
                logger.info("Executing FFmpeg transcode: %s", " ".join(cmd))
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await process.communicate()

                if process.returncode != 0:
                    logger.error("FFmpeg transcode failed: %s", stderr.decode())
                    # Fallback to saving WebM raw if FFmpeg fails or is missing in test/local environments
                    mp4_bytes = webm_bytes
                    storage_mime = "video/webm"
                    storage_ext = ".webm"
                else:
                    with open(mp4_path, "rb") as f:
                        mp4_bytes = f.read()
                    storage_mime = "video/mp4"
                    storage_ext = ".mp4"

            artifact_id = uuid.uuid4()
            storage_key = f"renders/{artifact_id}{storage_ext}"
            await self.storage.put(storage_key, mp4_bytes, storage_mime)

            # Generate BibTeX citation
            ctx = CitationContext(
                title=title,
                authors=[Author(name=creator)],
                year=2026,
                publisher="AnnealMusic",
                url=f"{self.settings.public_base_url}/{source_kind}/{source_id}"
            )
            citation = bibtex(ctx)

            artifact = RenderedArtifact(
                id=artifact_id,
                user_id=user_id,
                source_kind=source_kind,
                source_id=source_id,
                render_kind="video",
                storage_key=storage_key,
                bytes=len(mp4_bytes),
                resolution=resolution,
                duration_ms=duration_sec * 1000,
                citation_bibtex=citation,
                created_at=datetime.now(timezone.utc),
            )
            session.add(artifact)
            await session.commit()
            await session.refresh(artifact)
            return artifact

        finally:
            await page.close()
