"""Server-side preview rendering: an in-process asyncio task queue that drives a
headless-Chromium renderer (Option B) and writes the resulting Opus thumbnail
back to the patch row.

The engine in ``src/audio/`` is real-time and wall-clock-timer-driven, and its
sound depends on Chrome's exact DSP — so faithful previews must run the *real*
engine in a real browser, in real time. Chromium is the production runtime, so
there is no parity risk (see ``docs/v0.8-PLAN.md`` §3).

The renderer is injectable (``Renderer`` protocol) so tests can substitute a fake
without launching a browser. Concurrency is bounded; a transient failure is
retried; a terminal failure marks ``preview_status='failed'``.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.models import Capture, Patch
from app.share import capture_slots_from_payload
from app.storage import StorageClient, encode_preview_opus

logger = logging.getLogger("render")

MAX_ATTEMPTS = 2


class Renderer(Protocol):
    async def render(
        self, payload: str, duration_sec: int, capture_urls: list[str]
    ) -> bytes:
        """Render ``duration_sec`` of the patch to audio bytes (WebM/Opus from
        the browser). ``capture_urls`` are presigned GET URLs in flagged-slot
        order, fetched + hydrated in-page before rendering."""
        ...

    async def aclose(self) -> None: ...


class RenderQueue:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._queue: asyncio.Queue[uuid.UUID] = asyncio.Queue(maxsize=1024)
        self._workers: list[asyncio.Task[None]] = []
        self._sem = asyncio.Semaphore(max(1, settings.render_concurrency))
        self._sessionmaker: async_sessionmaker[AsyncSession] | None = None
        self._storage: StorageClient | None = None
        self._renderer: Renderer | None = None
        self.started = False

    def enqueue(self, patch_id: uuid.UUID) -> None:
        """Fire-and-forget. Safe to call even when no workers are running (the
        item simply waits); over capacity it is dropped and the restart sweep
        will recover it."""
        try:
            self._queue.put_nowait(patch_id)
        except asyncio.QueueFull:
            logger.warning("render queue full; dropping %s", patch_id)

    async def start(
        self,
        sessionmaker: async_sessionmaker[AsyncSession],
        storage: StorageClient,
        renderer: Renderer,
    ) -> None:
        if self.started:
            return
        self._sessionmaker = sessionmaker
        self._storage = storage
        self._renderer = renderer
        self.started = True
        for _ in range(max(1, self.settings.render_concurrency)):
            self._workers.append(asyncio.create_task(self._worker()))
        await self._sweep_stale()

    async def stop(self) -> None:
        for w in self._workers:
            w.cancel()
        self._workers.clear()
        self.started = False
        if self._renderer is not None:
            await self._renderer.aclose()

    async def _sweep_stale(self) -> None:
        """Re-enqueue rows stuck in 'rendering' (e.g. a process died mid-render)."""
        assert self._sessionmaker is not None
        cutoff = datetime.now(tz=timezone.utc) - timedelta(
            seconds=self.settings.render_stale_seconds
        )
        async with self._sessionmaker() as session:
            rows = (
                await session.execute(
                    select(Patch.id).where(
                        Patch.preview_status == "rendering",
                        Patch.updated_at < cutoff,
                    )
                )
            ).scalars().all()
        for pid in rows:
            self.enqueue(pid)

    async def _worker(self) -> None:
        while True:
            patch_id = await self._queue.get()
            try:
                async with self._sem:
                    await self._render_one(patch_id)
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 - one bad render must not kill the worker
                logger.exception("render worker error for %s", patch_id)
            finally:
                self._queue.task_done()

    async def _render_one(self, patch_id: uuid.UUID) -> None:
        assert self._sessionmaker is not None
        assert self._storage is not None
        assert self._renderer is not None

        async with self._sessionmaker() as session:
            patch = await session.get(Patch, patch_id)
            if patch is None or patch.visibility != "public":
                return  # gone or no longer public — nothing to render
            payload = (patch.state or {}).get("payload", "")
            capture_urls = await self._presign_captures(session, patch)

        last_err: Exception | None = None
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                raw = await asyncio.wait_for(
                    self._renderer.render(
                        payload, self.settings.preview_duration_sec, capture_urls
                    ),
                    timeout=self.settings.render_timeout_seconds,
                )
                opus = await encode_preview_opus(
                    raw, self.settings.preview_bitrate_kbps
                )
                key = f"previews/{patch_id}.opus"
                await self._storage.put(key, opus, "audio/ogg")
                await self._mark(
                    patch_id, "ready", key,
                    self.settings.preview_duration_sec * 1000,
                )
                return
            except Exception as exc:  # noqa: BLE001
                last_err = exc
                logger.warning("render attempt %d failed for %s: %s",
                               attempt, patch_id, exc)
                await asyncio.sleep(2 ** attempt)

        logger.error("render permanently failed for %s: %s", patch_id, last_err)
        await self._mark(patch_id, "failed", None, None)

    async def _presign_captures(
        self, session: AsyncSession, patch: Patch
    ) -> list[str]:
        """Presigned GET URLs for the patch's captures, in flagged-slot order so
        the harness can map slot[i] → url[i] (same convention as the client)."""
        assert self._storage is not None
        slots = capture_slots_from_payload((patch.state or {}).get("payload", ""))
        if not slots or not patch.capture_refs:
            return []
        urls: list[str] = []
        for i, _slot in enumerate(slots):
            if i >= len(patch.capture_refs):
                break
            cap = await session.get(Capture, patch.capture_refs[i])
            if cap is None:
                continue
            urls.append(await self._storage.presigned_get_url(cap.storage_key))
        return urls

    async def _mark(
        self, patch_id: uuid.UUID, status: str, key: str | None, dur_ms: int | None
    ) -> None:
        assert self._sessionmaker is not None
        async with self._sessionmaker() as session:
            patch = await session.get(Patch, patch_id)
            if patch is None:
                return
            patch.preview_status = status
            if key is not None:
                patch.preview_storage_key = key
            if dur_ms is not None:
                patch.preview_duration_ms = dur_ms
            await session.commit()
