# Admin panel (v0.8)

A deliberately minimal moderation surface at **`/admin`**. It lists open reports
and lets a moderator dismiss or uphold them. No other admin features exist (by
design — deferred).

## Setting the key

Admin access is gated by a single shared secret:

- Set `ADMIN_KEY` on the API service to a long random value.
- **If `ADMIN_KEY` is unset, every admin endpoint returns `404`** — the panel
  behaves as though it doesn't exist (no oracle). The `/admin` page still renders a
  key form, but any key will fail.

The key is compared in constant time against the `x-admin-key` request header.

## Using the panel

1. Open `https://<web-origin>/admin`.
2. Enter the admin key. It's stored in the tab's `sessionStorage` (`am_admin_key`)
   — cleared when the tab closes, or via **Sign out**. It is never sent anywhere
   except as the `x-admin-key` header to the API.
3. Open reports are listed newest-first, each showing the patch title, a link to
   its **preview** audio, the reason, optional detail, and a reporter label
   (`anonymous` or an 8-char anon-id prefix).
4. Per report:
   - **Dismiss** → marks the report `dismissed`; the patch stays public.
   - **Uphold** → marks the report `upheld` **and** sets the patch to `flagged`
     (removed from the gallery + short links). See `docs/MODERATION.md`.

## Endpoints (all require `x-admin-key`)

- `GET  /api/v1/admin/reports?status=open`
- `PATCH /api/v1/admin/reports/:id` — `{ status: 'dismissed' | 'upheld' }`
- `PATCH /api/v1/admin/patches/:id/visibility` — `{ visibility:
  'unlisted' | 'public' | 'flagged' }` (restore/override; public re-publishes)

A wrong/missing key on an enabled panel returns `401 unauthorized`.
