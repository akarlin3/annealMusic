"""Headless-Chromium renderer (Option B). Drives the bundled render harness
(``render/index.html`` + ``src/render/headless.ts``) in a real browser, in real
time, so previews use the exact production engine + Chrome DSP.

Lazily imports Playwright so the module is import-safe (and pyright-clean)
wherever rendering is disabled — the browser is only launched on first render.
"""

from __future__ import annotations

import asyncio
import base64

from app.config import Settings


class PlaywrightRenderer:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
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

    async def render(
        self, payload: str, duration_sec: int, capture_urls: list[str]
    ) -> bytes:
        browser = await self._ensure_browser()
        page = await browser.new_page()
        try:
            await page.goto(self.settings.render_harness_url)
            b64: str = await page.evaluate(
                """async ([payload, dur, urls]) => {
                    const res = await window.__annealRender(payload, {
                        durationSec: dur,
                        captureUrls: urls,
                    });
                    return res.b64;
                }""",
                [payload, duration_sec, capture_urls],
            )
            return base64.b64decode(b64)
        finally:
            await page.close()

    async def aclose(self) -> None:
        if self._browser is not None:
            await self._browser.close()
            self._browser = None
        if self._pw is not None:
            await self._pw.stop()
            self._pw = None
