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
from app.models import Capture, Patch, Piece
from app.share import capture_slots_from_payload
from app.storage import StorageClient, encode_preview_opus

logger = logging.getLogger("render")

MAX_ATTEMPTS = 2


class Renderer(Protocol):
    async def render(
        self, payload: str, duration_sec: int, capture_urls: list[str], preview_slice_start_ms: int | None = None
    ) -> bytes:
        """Render ``duration_sec`` of the patch or piece to audio bytes (WebM/Opus from
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

        is_piece = False
        async with self._sessionmaker() as session:
            patch = await session.get(Patch, patch_id)
            if patch is None:
                piece = await session.get(Piece, patch_id)
                if piece is None or piece.visibility != "public":
                    return
                is_piece = True
                target = piece
            else:
                if patch.visibility != "public":
                    return
                target = patch

            if is_piece:
                payload = await self._encode_piece_payload(session, target)
                capture_urls = []
                # long-piece seek slicing
                if target.has_open_segment or (target.total_duration_ms and target.total_duration_ms > 300000):
                    offset_ms = target.preview_slice_start_ms
                else:
                    offset_ms = None
            else:
                payload = (target.state or {}).get("payload", "")
                capture_urls = await self._presign_captures(session, target)
                offset_ms = None

        last_err: Exception | None = None
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                raw = await asyncio.wait_for(
                    self._renderer.render(
                        payload, self.settings.preview_duration_sec, capture_urls, offset_ms
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

    async def _encode_piece_payload(self, session: AsyncSession, piece: Piece) -> str:
        from app.models import PieceSegment
        from urllib.parse import quote
        import json

        stmt = select(PieceSegment).where(PieceSegment.piece_id == piece.id).order_by(PieceSegment.position.asc())
        res = await session.execute(stmt)
        segments = res.scalars().all()
        
        parts = ["kind=piece"]
        if piece.title:
            parts.append(f"title={quote(piece.title)}")
        if piece.description:
            parts.append(f"desc={quote(piece.description)}")
            
        defaults = piece.defaults_state or {}
        
        tempo = defaults.get("_tempo_bpm")
        if tempo is not None:
            parts.append(f"tempo={tempo}")
            
        var_seed = defaults.get("_variation_seed")
        if var_seed is not None:
            parts.append(f"varSeed={var_seed}")
            
        global_vars = defaults.get("_variations") or []
        if global_vars:
            def enc_vp(vp):
                c = vp.get("constraint") or {}
                c_type = c.get("type", "")
                cfg = ""
                if c_type == "range":
                    cfg = f"{c.get('min') or ''},{c.get('max') or ''}"
                elif c_type == "enum":
                    cfg = "|".join(map(str, c.get("choices") or []))
                elif c_type == "relative":
                    cfg = f"{c.get('percent') or ''}"
                elif c_type == "correlated":
                    cfg = f"{c.get('targetParam') or ''},{c.get('coefficient') or ''}"
                return f"{vp.get('id') or ''}:{vp.get('paramKey') or ''}:{c_type}:{cfg}:{vp.get('rule') or ''}"
            
            enc_vars = ";".join(enc_vp(v) for v in global_vars)
            parts.append(f"v.p={quote(enc_vars)}")
            
        notation = defaults.get("_notation") or []
        if notation:
            encoded_notes = ";".join(f"{n.get('onset_ms', 0)},{n.get('duration_ms', 500)},{n.get('pitch_midi', 60)}" for n in notation)
            parts.append(f"notation={encoded_notes}")
            
        movements = defaults.get("_movements") or []
        for idx, mov in enumerate(movements):
            parts.append(f"mov{idx}.name={quote(mov.get('name') or '')}")
            if mov.get("description"):
                parts.append(f"mov{idx}.desc={quote(mov.get('description'))}")
            if mov.get("transition_in_ms") is not None:
                parts.append(f"mov{idx}.in={mov.get('transition_in_ms')}")
            if mov.get("transition_out_ms") is not None:
                parts.append(f"mov{idx}.out={mov.get('transition_out_ms')}")
            parts.append(f"mov{idx}.start={mov.get('startSegmentIndex')}")
            parts.append(f"mov{idx}.end={mov.get('endSegmentIndex')}")
            
        auto_tracks = defaults.get("_automation_tracks") or []
        for track in auto_tracks:
            param_key = track.get("paramKey")
            pts = track.get("points") or []
            encoded_pts = ";".join(f"{p.get('timeMs', 0)},{p.get('value', 0):.2f},{p.get('interpolation', 'l')[0]}" for p in pts)
            parts.append(f"auto.{param_key}={quote(encoded_pts)}")
            
        # serialize defaultsState
        engine_id = defaults.get("engineId", "sine")
        parts.append(f"def.e={engine_id}")
        
        params = defaults.get("params") or {}
        for k, v in params.items():
            if not k.startswith("_"):
                parts.append(f"def.{k}={v}")
                
        engine_params = defaults.get("engineParams") or {}
        for eng, params_dict in engine_params.items():
            ns = eng
            if eng == "granular":
                ns = "gr"
            for k, v in params_dict.items():
                parts.append(f"def.{ns}.{k}={v}")
                
        loops = defaults.get("loops") or {}
        for slot_id, slot_cfg in loops.items():
            if slot_cfg.get("muted"):
                parts.append(f"def.L{slot_id}.m=1")
            if slot_cfg.get("frozen"):
                parts.append(f"def.L{slot_id}.f=1")
            if slot_cfg.get("driftCoupled"):
                parts.append(f"def.L{slot_id}.c=1")
            grain = slot_cfg.get("grain") or {}
            if grain.get("sizeMs") is not None:
                parts.append(f"def.L{slot_id}.gs={grain['sizeMs']}")
            if grain.get("density") is not None:
                parts.append(f"def.L{slot_id}.gd={grain['density']}")
            if grain.get("posJitter") is not None:
                parts.append(f"def.L{slot_id}.gp={grain['posJitter']}")
            if grain.get("pitchJitter") is not None:
                parts.append(f"def.L{slot_id}.gx={grain['pitchJitter']}")

        for idx, seg in enumerate(segments):
            parts.append(f"seg{idx}.type={seg.type}")
            parts.append(f"seg{idx}.dur={'null' if seg.duration_ms is None else seg.duration_ms}")
            config = seg.config or {}
            variations = config.get("_variations") or []
            if variations:
                def enc_vp(vp):
                    c = vp.get("constraint") or {}
                    c_type = c.get("type", "")
                    cfg = ""
                    if c_type == "range":
                        cfg = f"{c.get('min') or ''},{c.get('max') or ''}"
                    elif c_type == "enum":
                        cfg = "|".join(map(str, c.get("choices") or []))
                    elif c_type == "relative":
                        cfg = f"{c.get('percent') or ''}"
                    elif c_type == "correlated":
                        cfg = f"{c.get('targetParam') or ''},{c.get('coefficient') or ''}"
                    return f"{vp.get('id') or ''}:{vp.get('paramKey') or ''}:{c_type}:{cfg}:{vp.get('rule') or ''}"
                enc_vars = ";".join(enc_vp(v) for v in variations)
                parts.append(f"seg{idx}.v={quote(enc_vars)}")
            if seg.type == "meta-arc":
                clean_cfg = {k: v for k, v in config.items() if k != "_variations"}
                parts.append(f"seg{idx}.cfg={quote(json.dumps(clean_cfg))}")
            else:
                for k, v in config.items():
                    if k != "_variations":
                        val_str = str(v).lower() if isinstance(v, bool) else str(v)
                        parts.append(f"seg{idx}.{k}={quote(val_str)}")

        return "&".join(parts)

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
            if patch is not None:
                patch.preview_status = status
                if key is not None:
                    patch.preview_storage_key = key
                if dur_ms is not None:
                    patch.preview_duration_ms = dur_ms
            else:
                piece = await session.get(Piece, patch_id)
                if piece is not None:
                    piece.preview_status = status
                    if key is not None:
                        piece.preview_storage_key = key
                    if dur_ms is not None:
                        piece.preview_duration_ms = dur_ms
            await session.commit()
