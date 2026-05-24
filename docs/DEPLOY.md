# Deploy & Local Dev (v0.8)

Two deploy targets: the **web** SPA on Firebase Hosting (unchanged — see the
README) and the **API** on Railway. Object storage is Cloudflare R2.

## Local development

From `api/`:

```bash
docker compose up
```

Brings up **Postgres**, **MinIO** (S3-compatible, console at :9001), the **API**
(`:8000`, auto-runs `alembic upgrade head`, hot-reload), and the **web** dev
server (`:5173`, `VITE_API_BASE=http://localhost:8000`). The `createbuckets`
init container makes the `annealmusic` bucket.

Run the API alone without Docker (in-memory storage, no S3 needed):

```bash
cd api
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env          # STORAGE_BACKEND=memory by default
alembic upgrade head          # against a local Postgres (or use sqlite in tests)
uvicorn app.main:app --reload
```

Seed demo data (needs DATABASE_URL pointed at Postgres):

```bash
cd api && python -m scripts.seed
```

Tests run on in-memory SQLite (fast, no services):

```bash
cd api && pytest -q
```

## Schema manifest

The URL schema lives once, in TypeScript. Regenerate the server's validation
manifest after any schema change:

```bash
npm run gen:schema   # writes schema/manifest.v4.json
```

CI fails if the committed manifest drifts from the generator output.

## Railway (API)

1. **Create a service** from this repo, root directory `api/` (uses `Dockerfile`).
2. **Add the Postgres plugin** — Railway injects `DATABASE_URL`. Convert it to the
   async driver: `postgresql+asyncpg://…` (set as the service's `DATABASE_URL` if
   the plugin provides the sync form).
3. **Release command:** `alembic upgrade head` (runs before new traffic; a failed
   migration fails the deploy and the old container keeps serving).
4. **Serve command:** the Dockerfile `CMD` (gunicorn + uvicorn workers).
5. **Environment variables:**

   | Var                                         | Example / note                                           |
   | ------------------------------------------- | -------------------------------------------------------- |
   | `ENV`                                       | `prod`                                                   |
   | `DATABASE_URL`                              | `postgresql+asyncpg://…` (from the Postgres plugin)      |
   | `STORAGE_BACKEND`                           | `s3`                                                     |
   | `S3_ENDPOINT`                               | R2 endpoint `https://<account>.r2.cloudflarestorage.com` |
   | `S3_REGION`                                 | `auto`                                                   |
   | `S3_BUCKET`                                 | `annealmusic`                                            |
   | `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | R2 API token                                             |
   | `CORS_ORIGINS`                              | `["https://anneal.averykarlin.org"]`                     |
   | `ANON_COOKIE_SECURE`                        | `true`                                                   |
   | `TRANSCODE_ENABLED`                         | `true` (ffmpeg is in the image)                          |
   | `RENDER_ENABLED`                            | `true` (Chromium is in the image)                        |
   | `RENDER_HARNESS_URL`                        | `https://<web-origin>/render.html` (from the web build)  |
   | `RENDER_CONCURRENCY`                        | `2` (bounded; raise only with memory headroom)           |
   | `ADMIN_KEY`                                 | a long random secret; unset ⇒ `/admin` disabled (404)    |
   | `MODERATION_EXTRA_TERMS`                    | optional comma-separated banned-term extension           |
   | `SENTRY_DSN`                                | optional; no-op when unset                               |

6. **Web env:** set `VITE_API_BASE=https://api.annealmusic.<root>` in the web
   build so Save / My Patches / `/p/<slug>` reach the API.

### DNS — `api.annealmusic.<root>`

Add a **CNAME** for the `api` subdomain pointing at the Railway-provided domain,
then add the custom domain in the Railway service settings and wait for its
managed certificate. No DNS is changed by this repo.

### Post-deploy verification (CD silent-failure rule)

`.github/workflows/api.yml` `verify-deploy` job (on `main`, when the `API_URL`
repo variable is set) polls `${API_URL}/readyz` until it returns `200`,
confirming the DB + storage are reachable and migrations applied. Manually:

```bash
curl -fsS https://api.annealmusic.<root>/readyz
```

## Preview rendering (v0.8)

Gallery audio thumbnails are rendered **server-side in headless Chromium** so they
use the exact production engine (the engine is real-time + Web-Audio-DSP-bound;
see `docs/v0.8-PLAN.md` §3). The API Docker image bundles Chromium (`playwright
install chromium`) and ffmpeg.

- The **render harness** is part of the normal web build (`render.html` →
  `dist/render.html`), so it deploys with the SPA on Firebase. Point the API at it
  via `RENDER_HARNESS_URL=https://<web-origin>/render.html`. (Tradeoff vs. the
  plan's bundled `file://`: this avoids a cross-Docker-context build; renders
  depend on the web origin being reachable — if it isn't, the preview is marked
  `failed` and the card falls back to its static art. Version skew is negligible
  since web + API deploy from one repo.)
- Rendering is an **in-process `asyncio` queue** (concurrency `RENDER_CONCURRENCY`,
  default 2). It's per-process (like the rate limiter); a process restart mid-
  render is recovered by a startup sweep that re-enqueues rows stuck in
  `rendering`, plus a re-enqueue on `GET /preview` of a stale row.
- Previews are **write-once** (state is immutable) and served from object storage
  via a 302 with a 1-year immutable cache header.
- R2 must allow the render origin to `fetch` capture bytes (CORS) for
  patches-with-captures previews.

## Orphan capture sweep

`app.routers.captures.sweep_orphans` deletes captures with `ref_count = 0` older
than 24 h. Wire it to a Railway cron (a tiny script invoking it against a session)
or a scheduled hit to an internal endpoint. For v0.7 it can be run manually.
