# Embedding (v1.0)

Embed a public patch's preview on a blog or artist page with a tiny, listen-only
player. No sculpt controls — the embed is for listening, and it's a polite guest
in someone else's page: no analytics, no tracking, no login, no `localStorage`.

## Get the code

On any **public** patch — a gallery card's "⋯" menu or a My Patches card — click
**Get embed code**. The dialog offers size presets and a dark/light theme, and
produces copy-pastable HTML:

```html
<iframe
  src="https://annealmusic.app/embed/<slug>?theme=dark"
  width="560"
  height="80"
  frameborder="0"
  loading="lazy"
  title="My Patch — Anneal Ambiance"
></iframe>
```

## What it does

- Streams the patch's v0.8 **preview audio** (only if the patch is public and the
  preview has rendered). Otherwise it shows a polite "this patch is not public"
  state.
- A single-row player: play/pause, a scrub bar, the patch title, the creator
  ("Anonymous" until display names ship), and an Anneal Ambiance wordmark linking
  back to the full patch.
- `?theme=dark` (default) or `?theme=light` to match the host page.
- Responsive down to 320 px wide; ~80 px tall (taller sizes also work).

## How it's served

- A **separate Vite entry** (`embed.html` → `embedEntry.ts`) builds a React-free
  bundle that's **< 50 KB gzipped** (a CI gate; it's ~1.6 KB today). It imports
  no engine, orchestrator, or sculpt UI — only audio playback.
- `/embed/<slug>` is served as a minimal HTML shell (by the API route, and by
  Firebase hosting via a rewrite to `embed.html`).
- **iframe security**: the embed surface is the _only_ one allowed to be framed.
  It sends `Content-Security-Policy: frame-ancestors *` and omits
  `X-Frame-Options`; every other route keeps `X-Frame-Options: DENY`, so the
  main app refuses to be iframed.
