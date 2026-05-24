# AnnealMusic API (v0.7)

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

| Status | `error`          | Meaning                                             |
| ------ | ---------------- | --------------------------------------------------- |
| 400    | `bad_request`    | malformed input (e.g. upload isn't a valid WAV)     |
| 403    | `forbidden`      | not your resource                                   |
| 404    | `not_found`      | unknown id/slug                                     |
| 409    | `quota_exceeded` | count or byte quota reached (`resource`, `limit`)   |
| 413    | `file_too_large` | a single upload exceeds the per-file cap            |
| 422    | `invalid_state`  | patch payload failed schema validation (`errors[]`) |
| 429    | `rate_limited`   | hourly rate limit hit                               |

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

## Rate limits & quotas

Per anonId, hourly: 60 patches, 20 captures, 5 recordings, 600 GETs. Missing
anonId falls back to a stricter per-IP ceiling. Quotas per anonId: 100 patches,
50 captures, 10 recordings, 1 GB total bytes.
