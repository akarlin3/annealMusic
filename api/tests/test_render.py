from __future__ import annotations

import uuid

import pytest

from tests.conftest import VALID_PAYLOAD


async def _make_public_patch(rendering: bool = True) -> uuid.UUID:
    from app.db import get_sessionmaker
    from app.models import Patch, User

    sm = get_sessionmaker()
    async with sm() as s:
        user = User(id=uuid.uuid4())
        s.add(user)
        patch = Patch(
            user_id=user.id,
            schema_ver=4,
            state={"v": 4, "payload": VALID_PAYLOAD},
            short_slug=uuid.uuid4().hex[:8],
            visibility="public",
            preview_status="rendering" if rendering else "none",
            engine="sine",
            mode="open",
            capture_refs=[],
        )
        s.add(patch)
        await s.commit()
        return patch.id


class _FakeRenderer:
    def __init__(self) -> None:
        self.calls: list[tuple] = []

    async def render(self, payload, dur, urls):
        self.calls.append((payload, dur, urls))
        return b"FAKE-WEBM-BYTES"

    async def aclose(self) -> None:
        pass


class _BoomRenderer:
    async def render(self, payload, dur, urls):
        raise RuntimeError("render exploded")

    async def aclose(self) -> None:
        pass


async def test_render_one_success(app, monkeypatch):
    from app.config import get_settings
    from app.db import get_sessionmaker
    from app.models import Patch
    from app.render import RenderQueue
    from app.storage import MemoryStorage

    # Skip the real ffmpeg repackage; assert the bytes flow through.
    async def _passthrough(raw, kbps):
        return b"OPUS:" + raw

    monkeypatch.setattr("app.render.encode_preview_opus", _passthrough)

    pid = await _make_public_patch()
    storage = MemoryStorage()
    q = RenderQueue(get_settings())
    q._sessionmaker = get_sessionmaker()
    q._storage = storage
    renderer = _FakeRenderer()
    q._renderer = renderer

    await q._render_one(pid)

    sm = get_sessionmaker()
    async with sm() as s:
        p = await s.get(Patch, pid)
        assert p.preview_status == "ready"
        assert p.preview_storage_key == f"previews/{pid}.opus"
        assert p.preview_duration_ms == get_settings().preview_duration_sec * 1000
    assert await storage.get(f"previews/{pid}.opus") == b"OPUS:FAKE-WEBM-BYTES"
    assert renderer.calls and renderer.calls[0][1] == get_settings().preview_duration_sec


async def test_render_one_failure_marks_failed(app, monkeypatch):
    from app.config import get_settings
    from app.db import get_sessionmaker
    from app.models import Patch
    from app.render import RenderQueue
    from app.storage import MemoryStorage

    async def _no_sleep(_):
        return None

    monkeypatch.setattr("app.render.asyncio.sleep", _no_sleep)

    pid = await _make_public_patch()
    q = RenderQueue(get_settings())
    q._sessionmaker = get_sessionmaker()
    q._storage = MemoryStorage()
    q._renderer = _BoomRenderer()

    await q._render_one(pid)

    async with get_sessionmaker()() as s:
        p = await s.get(Patch, pid)
        assert p.preview_status == "failed"


async def test_render_one_skips_non_public(app, monkeypatch):
    from app.config import get_settings
    from app.db import get_sessionmaker
    from app.models import Patch
    from app.render import RenderQueue
    from app.storage import MemoryStorage

    pid = await _make_public_patch()
    # Flip to unlisted before render runs.
    async with get_sessionmaker()() as s:
        p = await s.get(Patch, pid)
        p.visibility = "unlisted"
        await s.commit()

    q = RenderQueue(get_settings())
    q._sessionmaker = get_sessionmaker()
    q._storage = MemoryStorage()
    q._renderer = _BoomRenderer()  # would raise if invoked
    await q._render_one(pid)  # should be a no-op, not raise


async def test_queue_concurrency_cap(app, monkeypatch):
    """Workers honor the semaphore: never more than `render_concurrency` renders
    run at once."""
    import asyncio

    from app.config import get_settings
    from app.db import get_sessionmaker
    from app.render import RenderQueue
    from app.storage import MemoryStorage

    async def _passthrough(raw, kbps):
        return raw

    monkeypatch.setattr("app.render.encode_preview_opus", _passthrough)
    monkeypatch.setenv("RENDER_CONCURRENCY", "2")
    get_settings.cache_clear()

    inflight = 0
    peak = 0

    class _SlowRenderer:
        async def render(self, payload, dur, urls):
            nonlocal inflight, peak
            inflight += 1
            peak = max(peak, inflight)
            await asyncio.sleep(0.05)
            inflight -= 1
            return b"x"

        async def aclose(self):
            pass

    pids = [await _make_public_patch() for _ in range(6)]
    q = RenderQueue(get_settings())
    await q.start(get_sessionmaker(), MemoryStorage(), _SlowRenderer())
    for pid in pids:
        q.enqueue(pid)
    await q._queue.join()
    await q.stop()
    assert peak <= 2
