# Anneal Ambiance API (v0.8)

Base URL: `https://api.annealmusic.<root>` (prod) · `http://localhost:8000` (dev).
All `/api/v1/*` endpoints are versioned. JSON in, JSON out, except capture upload
(multipart) and capture/recording GETs (302 redirect to storage).

## Authentication — anonymous-first

Every authenticated request carries `x-anon-id: <uuid>`. If it's missing the
server **mints** one and returns it via the `x-anon-id` response header and an
`am_anon` cookie; the client adopts it for subsequent requests. The header is
authoritative — the cookie is a soft-recovery mirror and is never sufficient for
a write on its own.

## Errors

Typed JSON bodies: `{ "error": "<code>", ...context }`.

| Status | `error`            | Meaning                                                     |
| ------ | ------------------ | ----------------------------------------------------------- |
| 400    | `bad_request`      | malformed input (e.g. upload isn't a valid WAV, bad cursor) |
| 401    | `unauthorized`     | admin endpoint, missing/wrong `x-admin-key`                 |
| 403    | `forbidden`        | not your resource                                           |
| 403    | `under_review`     | patch is `flagged` (hidden pending moderation)              |
| 404    | `not_found`        | unknown id/slug (or admin disabled)                         |
| 409    | `quota_exceeded`   | count or byte quota reached (`resource`, `limit`)           |
| 413    | `file_too_large`   | a single upload exceeds the per-file cap                    |
| 422    | `invalid_state`    | patch payload failed schema validation (`errors[]`)         |
| 422    | `content_rejected` | publish title/description failed screening (`field`)        |
| 429    | `rate_limited`     | hourly rate limit hit                                       |
| 503    | `preview_failed`   | preview render failed for this patch                        |

## Health

- `GET /healthz` → `{ "status": "ok" }` (liveness; no dependencies).
- `GET /readyz` → `200` `{ "status": "ok", "checks": { "db": true, "storage": true } }`
  or `503` when a dependency is down.

## Users

- `POST /api/v1/users` — idempotent upsert for the current `x-anon-id` (mints one
  if absent). → `{ user, quota }`.
- `GET /api/v1/users/me` — quota + counts + `bytes_used`.

```bash
curl -X POST http://localhost:8000/api/v1/users -H 'x-anon-id: <uuid>'
```

## Patches

- `POST /api/v1/patches` — body `{ state, schema_ver, title?, description?,
visibility?, capture_refs? }`. `state` is the encoded URL payload (no `#s=N:`
  prefix), validated strictly against the schema manifest. → `201` Patch.
- `GET /api/v1/patches/:idOrSlug` — resolves a UUID **or** a `short_slug`.
  Link-only read (no auth needed). → Patch.
- `GET /api/v1/patches/me?cursor=&limit=` — the current anon's patches, cursor-paginated.
- `PATCH /api/v1/patches/:id` — `{ title?, description?, visibility? }`. State is
  immutable (a new state is a new patch).
- `DELETE /api/v1/patches/:id` — real deletion; decrements referenced captures.

```bash
# Save a params-only patch
curl -X POST http://localhost:8000/api/v1/patches -H 'x-anon-id: <uuid>' \
  -H 'content-type: application/json' \
  -d '{"state":"m=open&e=sine&rootFreq=110","schema_ver":4,"title":"Calm"}'

# Resolve a short link
curl http://localhost:8000/api/v1/patches/<slug>
```

## Captures

- `POST /api/v1/captures` — multipart `file` (PCM WAV). Validated (format,
  duration ≤ 60 s, byte cap), transcoded to Opus when ffmpeg is present, stored.
  → `201` Capture `{ id, duration_ms, sample_rate, channels, bytes, format }`.
- `GET /api/v1/captures/:id` — `302` to a presigned storage URL.
- `DELETE /api/v1/captures/:id`.

```bash
curl -X POST http://localhost:8000/api/v1/captures -H 'x-anon-id: <uuid>' \
  -F 'file=@loop.wav;type=audio/wav'
```

Capture/patch binding: the client uploads captures first, then saves a patch with
the returned ids in `capture_refs`. The patch payload marks each audio-bearing
slot with `L<id>.cap=1`; `capture_refs` is ordered to match (slot A, B, C).
Ref-counts increment on save and decrement on patch update/delete; captures with
`ref_count = 0` older than 24 h are swept.

## Recordings (schema only in v0.7)

CRUD endpoints exist so the v1.0 export pipeline is purely client-side work.

- `POST /api/v1/recordings` — `{ storage_key, duration_ms, bytes, format,
patch_id?, title?, visibility? }`.
- `GET /api/v1/recordings/:id` (302), `GET /api/v1/recordings/me`,
  `DELETE /api/v1/recordings/:id`.

## Gallery (v0.8)

Public, no auth. Surfaces `visibility: public` patches.

- `GET /api/v1/gallery?sort=&engine=&mode=&has_captures=&q=&cursor=&limit=`
  - `sort`: `newest` (default) | `oldest` | `most_loaded`.
  - `engine`: `sine` | `fm`; `mode`: `open` | `arc`; `has_captures`: `true`.
  - `q`: full-text over title+description (Postgres `tsvector`; title weighted).
  - Keyset cursor (page size 24, max 48). A cursor is bound to its `sort` — using
    it with a different sort returns `400`. `Cache-Control: public, max-age=30,
stale-while-revalidate=60`.
  - → `{ items: GalleryItem[], next_cursor }`. A `GalleryItem` carries the patch
    `state` (for the card visual), `engine`/`mode`/`has_captures` badges,
    `load_count`, `published_at`, and `preview_status`.
- `GET /api/v1/patches/:idOrSlug/preview` — the audio thumbnail.
  - `302` → presigned Opus URL (`Cache-Control: …max-age=31536000, immutable`)
    when ready; `202` while rendering; `404` if not public; `503` if render failed.
- `POST /api/v1/patches/:idOrSlug/load` — increments `load_count` (rate-limited
  per IP+patch; over the limit it's a silent no-op so loading is never blocked).
  → `{ load_count }`.

A patch becomes public via `POST /patches` with `visibility:public` or `PATCH`ing
an existing one. Publishing **screens** the title/description (banned-word + spam
heuristics); a match → `422 content_rejected {field}` and the patch is **not**
published. On success the server sets `published_at` (once) and enqueues an async
preview render. `flagged` patches are hidden from the gallery and return `403
under_review` from the short-link read.

## Reports (v0.8)

- `POST /api/v1/reports` — `{ patch_id, reason: 'spam'|'inappropriate'|'other',
detail? }`. Anonymous allowed (reporter recorded from `x-anon-id` if present).
  → `201 { id, status: 'open' }`.

## Admin (v0.8)

Gated by `x-admin-key` (constant-time compared to `ADMIN_KEY`). When `ADMIN_KEY`
is unset every admin route returns `404` (no oracle that a panel exists).

- `GET /api/v1/admin/reports?status=open` → open reports joined with patch title,
  slug, visibility, preview status, and a reporter label.
- `PATCH /api/v1/admin/reports/:id` — `{ status: 'dismissed' | 'upheld' }`. Uphold
  also sets the patch to `flagged`.
- `PATCH /api/v1/admin/patches/:id/visibility` — `{ visibility:
'unlisted'|'public'|'flagged' }`. Restoring to public re-publishes (no
  re-screening — admin override).

## Rate limits & quotas

Per anonId, hourly: 60 patches, 20 captures, 5 recordings, 20 reports, 600 GETs.
Missing anonId falls back to a stricter per-IP ceiling. Load increments are capped
per (IP, patch). Quotas per anonId: 100 patches, 50 captures, 10 recordings, 1 GB
total bytes.

## Collaborative Sessions (v1.8)

Endpoints for real-time collaborative sculpting sessions.

- `POST /api/v1/jam-sessions` — Creates a new collaboration session. Returns `201` with `session` metadata, initial `participants` array, and the signaling WebSocket URL `ws_url`.
- `GET /api/v1/jam-sessions/:id` — Retrieves session details, current participants, and active transport configuration.
- `POST /api/v1/jam-sessions/:id/join` — Registers the caller as a participant in an existing session. Assigns a unique UI color and returns `200` with the `color` and `ws_url` signaling endpoint.
- `POST /api/v1/jam-sessions/:id/leave` — Unregisters the participant from the active session. If both users leave, a 60-second grace period triggers before cleanup.
- `POST /api/v1/jam-sessions/:id/save-patch` — Saves the current active sculpt parameters as a collaborative patch. The patch is co-attributed to both participants in the `patch_collaborators` junction table.

### WebSocket Signaling & Relay

- `WS /api/v1/jam-sessions/ws/:sessionId?userId=` — The real-time messaging WebSocket gateway.
  - Relays WebRTC signaling SDP handshake objects (offers, answers, ICE candidates) between peers.
  - Acts as a reliable fallback relay for binary Yjs CRDT update frames if direct P2P NAT negotiation fails.
