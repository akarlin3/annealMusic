# Session History & Privacy

Session History is a private, per-account record of the Listening Sessions you've
played. It exists for **your own reference** — to look back on your practice — and
for nothing else. It is calm by design (see `docs/CALM_BY_DESIGN.md`): no streaks,
no goals, no reminders.

## What it is

- A list at **`/me/sessions`** (also reachable from the account menu), newest
  first.
- Each entry shows: the date, the session's title, how long you actually
  listened, and an optional reflection you can add.
- Click an entry to **replay** the session or edit your reflection.
- A small, understated summary at the top: _"N sessions, H hours total this
  month"_ and _"average M min."_ That's deliberately all — no comparisons, no
  ranks, no streaks.

## When a play is logged

- A play is recorded when you **start** a Listening Session and finalized when it
  **completes** — or when you **end it early**, in which case it records the
  _actual_ time you listened (which may be less than the full duration).
- History requires an **account**. If you're not signed in, nothing is logged;
  you'll see a single gentle "sign in to keep your history" prompt afterward,
  which you can dismiss. It never recurs.
- Signed-in history is **cross-device**: plays from any device on your account
  appear in one unified list.

## What is stored

Exactly four things per play, and nothing more:

| Field                  | Meaning                              |
| ---------------------- | ------------------------------------ |
| `started_at`           | when the play began                  |
| `completed_at`         | when it finished (null if abandoned) |
| `duration_listened_ms` | actual time listened                 |
| `reflection`           | your optional note (≤ 500 chars)     |

**Not stored:** sculpt actions, audio recordings of your session, biometrics,
device fingerprints, or anything else about _how_ you listened.

## Privacy

- **Strictly private.** There is no public history, no profile display, and no
  "share my practice stats" feature — by design, now and going forward.
- **Reflections are private** and cannot be shared.
- **Sensitive data.** Practice frequency and timing can reveal personal routine,
  so we treat this as sensitive and minimize what we keep.
- **You can forget anything.** Delete any entry from `/me/sessions` (the "forget"
  control) — it's removed immediately and the summary updates to stay honest.
- **Account deletion** cascades: removing your account removes all of your
  history with it (`ON DELETE CASCADE`).
- **No outbound contact.** We never email, push, or notify you about your
  practice. The history surface never initiates — it only waits for you to visit.

## API (for reference)

- `POST /api/v1/me/sessions` — log a play on start
- `PATCH /api/v1/me/sessions/:id` — finalize (duration/completion) and/or edit a reflection
- `GET /api/v1/me/sessions` — list (paginated, newest first)
- `GET /api/v1/me/sessions/stats` — minimal descriptive stats
- `DELETE /api/v1/me/sessions/:id` — forget a play

All require a signed-in account; ownership is enforced across all devices on the
account.
