# Moderation (v0.8)

The gallery is the first surface where one user's content renders for others, so
v0.8 ships two lightweight moderation mechanisms. No third-party moderation
service is used (flagged for later if abuse grows).

## 1. Auto-screening at publish time

When a patch is set to `public` — on `POST /api/v1/patches` with
`visibility:public`, or `PATCH`ing an existing patch to `public` — the **title and
description** are screened by `api/app/moderation.py`:

- a static **banned-word** list (word-boundary matched to limit false positives),
  extensible per-deploy via the `MODERATION_EXTRA_TERMS` env var (comma-separated)
  — the list lives in exactly one place and is referenced by the publish path;
- two **spam heuristics**: more than one URL, or a 10+ run of a repeated character.

A match → **`422 content_rejected`** with the offending `field` (`title` /
`description`). The patch is **not** published: visibility is unchanged, no
`published_at` is set, and no preview render is enqueued. The save/publish dialog
surfaces the message inline. The patch payload itself is **not** screened here — it
has its own strict, manifest-driven validator (`app/validation.py`).

## 2. Manual takedown (report → review)

- Anyone can **report** a public patch from its gallery card (`…` → Report):
  `POST /api/v1/reports { patch_id, reason, detail? }`. Reports are anonymous-ok.
- A moderator reviews open reports in the **admin panel** (see `docs/ADMIN.md`) and
  either **dismisses** (no change) or **upholds** a report.
- **Uphold** sets the patch's `visibility` to `flagged`. A flagged patch:
  - disappears from the gallery listing (the gallery only lists `public`), within
    the gallery cache TTL (30–60 s);
  - returns `403 under_review` from its short-link read (`GET
    /patches/:idOrSlug`) — the creator's own link included — instead of a 404, so
    the SPA can show a "this patch is under review" state.
- A moderator can later restore a patch with `PATCH
  /api/v1/admin/patches/:id/visibility { visibility: 'public' }` (no re-screening —
  it's an explicit override), which re-publishes and re-renders the preview.

## Operator runbook

1. Set `ADMIN_KEY` to a long random secret on the API service (unset ⇒ `/admin`
   disabled). Rotate by changing the env var; sessions hold the key only in tab
   `sessionStorage`.
2. Visit `/admin`, enter the key. Triage open reports oldest-first.
3. **Uphold** clearly-violating patches (spam, abuse). **Dismiss** false reports.
4. There are no notifications in v0.8 — check `/admin` periodically. Upheld/flagged
   patches are reversible via the visibility endpoint.
