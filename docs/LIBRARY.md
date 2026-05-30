# The Listening Library (`/listen`)

`/listen` is AnnealMusic's **curated** meditation entry point: an editorial
catalog of Listening Sessions, hand-picked and tagged so someone arriving to
meditate can find something suitable in a few seconds. It is intentionally
separate from `/gallery` (the creator-side discovery surface for user-published
patches and pieces).

## Browsing

Three independent browse axes, composable as filters:

- **Length** — Short (≤10 min) · Medium (10–25) · Long (25–45) · Extended (45+).
- **Intention** — Morning · Evening · Sleep · Difficult day · Focus ·
  Open practice · Closing the week.
- **Character** — Drone · Composed (a structured Piece) · No spoken word ·
  With bells · With tunings.

An **Editor's recent picks** strip surfaces featured sessions at the top (when no
filter is active).

Each card shows the title, intention/length chips, character indicators, an
optional curator note, a **Preview** button (a short server-rendered audio
thumbnail), and a **Listen** button that loads the session into the v4.0 listener.

## Editorial-only (for now)

Everything in `/listen` is authored or selected by the AnnealMusic editors (or by
contributors explicitly invited via an admin action). This is a deliberate
quality gate: the meditation entry point shouldn't be flooded with
user-generated content of variable quality.

User-published Listening Sessions still exist — anyone can publish one through the
normal save flow with `visibility: 'public'` — but those appear under the
"Listening Sessions" filter in **`/gallery`**, not in `/listen`. If editorial
throughput becomes a bottleneck, a future slice (v4.5.1) can open the library to
community contributions.

## Previews

Library previews reuse the v0.8 server-side preview pipeline. A Listening Session
wraps a source Piece or Patch, and the preview is rendered onto that source
artifact, so a card's preview points at the source's existing preview. When a
source hasn't been rendered yet, the card shows a calm "preview rendering"
placeholder rather than a broken control. Adding a session whose source has no
previewable artifact is rejected at curation time.

## Admin curation

Curators manage `/listen` from the `/admin` panel (gated by the v0.8 admin key):

- **Add** a Listening Session by id/slug, set its intention, length, character
  tags, and an optional curator note.
- **Editor's picks** — toggle a listing's pick state (stamped with a pick time);
  picks surface on `/listen` and via `?picks=only`.
- **Archive** a listing (soft delete) to remove it from `/listen` while keeping
  its history.

### API (for reference)

Public:

- `GET /api/v1/library` — `?intention&length&character&picks=only`
- `GET /api/v1/library/picks` — current editor picks

Admin (`x-admin-key`):

- `POST /api/v1/admin/library` — add a listing
- `GET /api/v1/admin/library?include_archived=…` — list for curation
- `PATCH /api/v1/admin/library/:id` — update tags / pick state / note
- `DELETE /api/v1/admin/library/:id` — archive
