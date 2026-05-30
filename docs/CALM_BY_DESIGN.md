# Calm by Design

AnnealMusic is a meditation tool, not an engagement product. Features here exist
to support a practice — never to maximize time-on-app, return frequency, or any
growth metric. This document is the standing review framework, plus a per-release
checklist applied at each slice that touches a user-facing surface.

## Principles

1. **No engagement loops.** No streaks, points, levels, XP, badges, achievements,
   leaderboards, daily goals, or quests. Ever.
2. **No guilt.** No "you missed yesterday," no "don't break your streak," no
   loss-framing of any kind.
3. **No outbound nudges.** No emails, no push notifications, no SMS, no in-app
   banners reminding the user to come back and meditate. The product never
   initiates contact to pull the user in.
4. **Descriptive, not motivational.** Where we show numbers (e.g. session
   history stats), they describe what happened in plain terms. No comparison to
   prior periods, no rank, no "best ever."
5. **Private by default.** Personal practice data is the user's own. It is never
   public, never shared, never used to nudge.
6. **Stats computed once.** Any aggregate metric is derived in a single place so
   framing can't drift between surfaces (`api/app/routers/me_sessions.py::compute_stats`).

## CI gate

A lexical test (`src/test/calm-by-design.test.ts`) scans the v4.5 history +
library UI source for banned tokens (`streak`, `level up`, `achievement`,
`daily goal`, `badge`, `leaderboard`, `don't break`, `keep it up`, `you missed`,
`days in a row`, …) and **fails the build** on a match. Comments are stripped
before scanning so this document's own use of those words (to forbid them)
doesn't trip the gate. Extend `ROOTS`/`BANNED` as new surfaces land.

---

## Review checklists

### v4.5 — Session History + Curated Library

- [x] No streak counter anywhere (history, library, admin).
- [x] No points, badges, achievements, levels, XP.
- [x] No daily/weekly goal, no "X days in a row," no "you missed yesterday."
- [x] No notifications: no email, no push, no in-app reminder banner. None ship;
      none are stubbed; there is no scheduler that could send one.
- [x] Stats are descriptive, not motivational. The history surface renders
      "N sessions, H hours total this month" + "average M min" — no comparatives,
      no rank, no streak. The `SessionStatsOut` payload intentionally omits any
      engagement-signal field; a server test asserts the omission.
- [x] Stats computed in exactly one place (`compute_stats`); the client renders
      the server numbers verbatim.
- [x] History is private: account-gated, no public route, no profile display, no
      share button, no "share my stats."
- [x] Reflections are private and unshareable (≤500 chars).
- [x] The anonymous post-session prompt is a single, gentle, dismissible
      "sign in to keep your history" — never recurring, never guilt-framed, and
      never shown when nothing was listened.
- [x] Library is a calm, finite, paginated grid — no infinite scroll, no
      "trending," no algorithmic recommendation loop (editorial-only).
- [x] CI lexical gate present and green (`src/test/calm-by-design.test.ts`).
