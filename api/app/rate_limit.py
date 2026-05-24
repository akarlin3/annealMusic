"""Hand-rolled in-memory sliding-window rate limiter.

Keyed by anonId when present, falling back to a stricter per-IP ceiling when it
is missing (anonIds are trivially forgeable, so the IP floor is the real guard).
Single-instance only; a ``RATE_LIMIT_BACKEND=redis`` seam is left for horizontal
scaling (v0.8+).
"""

from __future__ import annotations

import time
from collections import defaultdict, deque

WINDOW_SECONDS = 3600

# Per-anonId hourly limits.
ANON_LIMITS: dict[str, int] = {
    "patches": 60,
    "captures": 20,
    "recordings": 5,
    "get": 600,
}

# Stricter per-IP limits when anonId is absent.
IP_LIMITS: dict[str, int] = {
    "write": 10,
    "get": 200,
}


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)

    def _check(self, scope: str, key: str, limit: int) -> bool:
        now = time.monotonic()
        cutoff = now - WINDOW_SECONDS
        bucket = self._hits[(scope, key)]
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            return False
        bucket.append(now)
        return True

    def allow(self, *, action: str, anon_id: str | None, ip: str) -> bool:
        """Return True if the request is allowed, recording a hit if so."""
        if anon_id is not None:
            limit = ANON_LIMITS.get(action, ANON_LIMITS["get"])
            return self._check("anon", f"{anon_id}:{action}", limit)
        # No anonId: collapse to a coarse write/get bucket per IP.
        ip_action = "get" if action == "get" else "write"
        return self._check("ip", f"{ip}:{ip_action}", IP_LIMITS[ip_action])

    def reset(self) -> None:
        self._hits.clear()
