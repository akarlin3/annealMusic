from __future__ import annotations

import io
import os
import pathlib
import tempfile
import wave
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio

# Configure the environment before any app module imports settings.
_TMPDIR = tempfile.mkdtemp()
_DB_PATH = pathlib.Path(_TMPDIR) / "test.db"
os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{_DB_PATH}")
os.environ.setdefault("STORAGE_BACKEND", "memory")
os.environ.setdefault("TRANSCODE_ENABLED", "false")
os.environ.setdefault("ENV", "dev")


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    from app.config import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest_asyncio.fixture
async def app():
    from app.db import Base, get_engine
    from app.main import create_app

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    application = create_app()
    application.state.rate_limiter.reset()
    return application


@pytest_asyncio.fixture
async def client(app) -> AsyncIterator:
    from httpx import ASGITransport, AsyncClient

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def make_wav(seconds: float = 1.0, sample_rate: int = 48000, channels: int = 2) -> bytes:
    """A tiny valid 16-bit PCM WAV of silence."""
    frames = int(seconds * sample_rate)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(b"\x00\x00" * frames * channels)
    return buf.getvalue()


# A valid v4 payload: open mode, fm engine with one param, one shared param,
# and a frozen loop slot with grain params.
VALID_PAYLOAD = "m=open&e=fm&rootFreq=110&fm.modIndex=2.00&LA.f=1&LA.gs=120"
