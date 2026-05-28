/**
 * Demo-GIF capture recipe for the README visual (`docs/media/demo.gif`).
 *
 * Status: NOT wired into CI or `package.json`. Producing the GIF needs a
 * headless-browser download (Playwright + Chromium, ~150 MB) plus ffmpeg for
 * assembly — toolchain weight that isn't justified to live in the default
 * install. This file documents the exact steps so anyone with the tools handy
 * can regenerate the asset in a couple of minutes.
 *
 * One-time setup:
 *   npm i -D playwright
 *   npx playwright install chromium
 *   # ffmpeg on PATH (brew install ffmpeg / apt-get install ffmpeg)
 *
 * Run against a local preview build:
 *   npm run build && npm run preview &     # serves http://localhost:4173
 *   npx vite-node scripts/capture-demo.ts
 *
 * The script below is intentionally inert until Playwright is installed; the
 * dynamic import keeps `npm install` and `tsc -b` clean without the dep.
 */

const PREVIEW_URL = process.env.DEMO_URL ?? 'http://localhost:4173/';
const OUT_DIR = 'docs/media/_frames';
const GIF_PATH = 'docs/media/demo.gif';
const FRAMES = 80; // ~8s at 10fps
const FPS = 10;

async function main(): Promise<void> {
  let chromium: typeof import('playwright').chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error(
      'Playwright is not installed. See the header of scripts/capture-demo.ts.\n' +
        'Until then the README uses the docs/media/demo.gif placeholder.',
    );
    process.exitCode = 1;
    return;
  }

  const { mkdir } = await import('node:fs/promises');
  const { spawnSync } = await import('node:child_process');
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
  await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });

  // Start the soundscape and nudge a slider mid-capture so the visualizer moves.
  await page.getByRole('button', { name: /begin/i }).click();
  const root = page.locator('[data-tour="rootFreq"] input[type="range"]');

  const canvas = page.locator('canvas').first();
  for (let i = 0; i < FRAMES; i++) {
    if (i === Math.floor(FRAMES / 3)) await root.focus();
    if (i >= FRAMES / 3 && i < (FRAMES * 2) / 3) {
      await page.keyboard.press('ArrowUp');
    }
    await canvas.screenshot({
      path: `${OUT_DIR}/frame-${String(i).padStart(3, '0')}.png`,
    });
    await page.waitForTimeout(1000 / FPS);
  }
  await browser.close();

  // Assemble to an 800px-wide looping GIF with a shared palette for clean color.
  const palette = `${OUT_DIR}/palette.png`;
  spawnSync('ffmpeg', [
    '-y',
    '-i',
    `${OUT_DIR}/frame-%03d.png`,
    '-vf',
    `fps=${FPS},scale=800:-1:flags=lanczos,palettegen`,
    palette,
  ]);
  spawnSync('ffmpeg', [
    '-y',
    '-i',
    `${OUT_DIR}/frame-%03d.png`,
    '-i',
    palette,
    '-lavfi',
    `fps=${FPS},scale=800:-1:flags=lanczos[x];[x][1:v]paletteuse`,
    '-loop',
    '0',
    GIF_PATH,
  ]);
  console.log(`Wrote ${GIF_PATH}`);
}

void main();
