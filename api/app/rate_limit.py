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
    "reports": 20,
    "jams": 5,
    "get": 600,
    "likes": 100,
    "follows": 60,
    "blocks": 30,
    # Next-lesson ranking is called at most ~once per session and is TTL-cached;
    # a tight bucket keeps the (cheap) LLM call from being hammered.
    "recommendations": 30,
}

# A given IP may increment a given patch's load_count at most this many times per
# window — anti-abuse so the count can't be trivially gamed.
LOAD_LIMIT_PER_IP_PATCH = 1

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

    def allow_load(self, *, ip: str, patch_id: str) -> bool:
        """Per (IP, patch) cap on load-count increments (anti-gaming)."""
        return self._check("load", f"{ip}:{patch_id}", LOAD_LIMIT_PER_IP_PATCH)

    def allow_email(self, email: str, ip: str) -> bool:
        """Sliding-window: 5 magic links per email per hour, 20 per IP per hour."""
        now = time.monotonic()
        cutoff = now - WINDOW_SECONDS

        email_key = f"email:{email.lower()}"
        email_bucket = self._hits[("email_request", email_key)]
        while email_bucket and email_bucket[0] < cutoff:
            email_bucket.popleft()
        if len(email_bucket) >= 5:
            return False

        ip_key = f"ip:{ip}"
        ip_bucket = self._hits[("email_request_ip", ip_key)]
        while ip_bucket and ip_bucket[0] < cutoff:
            ip_bucket.popleft()
        if len(ip_bucket) >= 20:
            return False

        email_bucket.append(now)
        ip_bucket.append(now)
        return True

    def allow_ai(self, *, anon_id: str | None, ip: str, is_auth: bool) -> bool:
        """Sliding-window: 50/hr for auth, 20/hr for anon."""
        limit = 50 if is_auth else 20
        if anon_id is not None:
            return self._check("anon_ai", f"{anon_id}:ai", limit)
        return self._check("ip_ai", f"{ip}:ai", limit)

    def reset(self) -> None:
        self._hits.clear()

