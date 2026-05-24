from __future__ import annotations

import uuid

from app.rate_limit import RateLimiter


def test_anon_limit_enforced():
    rl = RateLimiter()
    anon = str(uuid.uuid4())
    for _ in range(5):
        assert rl.allow(action="recordings", anon_id=anon, ip="1.2.3.4")
    # 6th recording in the window is blocked (limit 5).
    assert not rl.allow(action="recordings", anon_id=anon, ip="1.2.3.4")


def test_per_anon_isolation():
    rl = RateLimiter()
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    for _ in range(5):
        rl.allow(action="recordings", anon_id=a, ip="1.1.1.1")
    # A is exhausted but B is independent.
    assert not rl.allow(action="recordings", anon_id=a, ip="1.1.1.1")
    assert rl.allow(action="recordings", anon_id=b, ip="1.1.1.1")


def test_ip_fallback_when_no_anon():
    rl = RateLimiter()
    for _ in range(10):
        assert rl.allow(action="patches", anon_id=None, ip="9.9.9.9")
    # 11th anonymous write from the same IP is blocked (IP write limit 10).
    assert not rl.allow(action="patches", anon_id=None, ip="9.9.9.9")


async def test_rate_limit_endpoint_429(client, monkeypatch):
    from app.config import get_settings
    from app import rate_limit

    monkeypatch.setattr(rate_limit, "ANON_LIMITS", {**rate_limit.ANON_LIMITS, "recordings": 1})
    get_settings.cache_clear()
    h = {"x-anon-id": str(uuid.uuid4())}
    body = {
        "storage_key": "recordings/x/a.opus",
        "duration_ms": 1000,
        "bytes": 1,
        "format": "opus",
    }
    assert (await client.post("/api/v1/recordings", headers=h, json=body)).status_code == 201
    r = await client.post("/api/v1/recordings", headers=h, json=body)
    assert r.status_code == 429
    assert r.json()["error"] == "rate_limited"
