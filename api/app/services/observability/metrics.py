from __future__ import annotations

import time
from collections import deque
from typing import Optional

SLO_TARGETS = {
    "patch_save": 500.0,  # p99 < 500ms
    "patch_load": 300.0,  # p99 < 300ms
    "gallery_list": 600.0,  # p99 < 600ms
    "render_submit": 200.0,  # p99 < 200ms
    "render_complete": 30000.0,  # p99 < 30s
    "llm_generate": 15000.0,  # p99 < 15s
    "websocket_signal": 0.95,  # success rate > 95%
}


class SLOMetricsTracker:
    def __init__(self) -> None:
        self._latencies: dict[str, deque[float]] = {
            k: deque(maxlen=100) for k in SLO_TARGETS if k != "websocket_signal"
        }
        self._breach_start_time: dict[str, Optional[float]] = {
            k: None for k in SLO_TARGETS
        }
        self._success_count = 0
        self._total_count = 0

    def record_latency(self, route: str, latency_ms: float) -> bool:
        """Record latency for a route and check if it is a breach."""
        if route not in self._latencies:
            return False

        self._latencies[route].append(latency_ms)
        target = SLO_TARGETS[route]
        is_breach = latency_ms > target

        if is_breach:
            if self._breach_start_time[route] is None:
                self._breach_start_time[route] = time.time()
        else:
            self._breach_start_time[route] = None

        return is_breach

    def record_websocket_connection(self, success: bool) -> None:
        route = "websocket_signal"
        self._total_count += 1
        if success:
            self._success_count += 1

        rate = self.get_websocket_success_rate()
        target = SLO_TARGETS[route]
        if rate < target:
            if self._breach_start_time[route] is None:
                self._breach_start_time[route] = time.time()
        else:
            self._breach_start_time[route] = None

    def get_websocket_success_rate(self) -> float:
        if self._total_count == 0:
            return 1.0
        return self._success_count / self._total_count

    def get_breach_duration(self, route: str) -> float:
        """Returns the duration of the consecutive breach in seconds, or 0.0 if not breaching."""
        start = self._breach_start_time.get(route)
        if start is None:
            return 0.0
        return time.time() - start

    def get_p99(self, route: str) -> float:
        history = list(self._latencies.get(route, []))
        if not history:
            return 0.0
        history.sort()
        idx = int(len(history) * 0.99)
        return history[min(idx, len(history) - 1)]

    def reset(self) -> None:
        for k in self._latencies:
            self._latencies[k].clear()
        for k in self._breach_start_time:
            self._breach_start_time[k] = None
        self._success_count = 0
        self._total_count = 0


tracker = SLOMetricsTracker()
