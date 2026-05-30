# Calm by Design: Architecture & UX Manifesto

At **AnnealMusic**, we design experiences that respect the human mind. The software is engineered not to capture your attention, but to support your presence. We call this framework **Calm by Design**.

AnnealMusic is a meditation tool, not an engagement product. Features here exist to support a practice — never to maximize time-on-app, return frequency, or any growth metric. This document is the standing review framework, UX manifesto, and checklists applied to user-facing surfaces.

---

## 1. Principles & UX Pillars

### 1.1 Attention Sovereignty (Anti-Engagement)

Most modern applications are optimized for "Daily Active Users" (DAU), screen time, and scroll depth. AnnealMusic actively rejects these metrics:

- **No engagement loops:** No streaks, points, levels, XP, badges, achievements, leaderboards, daily goals, or quests. Ever.
- **No guilt:** No "you missed yesterday," no "don't break your streak," no loss-framing of any kind.
- **No outbound nudges:** We do not send push notifications, emails, SMS, or in-app banners telling you to return or meditate. The product never initiates contact to pull the user in.
- **Descriptive, not motivational:** Where we show numbers (e.g. session history stats), they describe what happened in plain terms. No comparison to prior periods, no rank, no "best ever."
- **Silent Closes:** When a session finishes or you exit, the engine fades out to silent absolute rest. We do not auto-play next tracks.

### 1.2 Aesthetic Minimalism

All fullscreen listening and timer panels focus on visual breathing spaces rather than complex control interfaces:

- **Hidden Sculpting HUDs:** Full customization controls are nested inside collapsable drawers or hidden behind escape hatches (e.g. the "Sliders" button in `ListeningView`).
- **Dynamic Pacing Circles:** Breathing visualizers rely on slow, organic trigonometric scaling (LFOs) holding to a calm 16-second cycle (4s inhale, 4s hold, 4s exhale, 4s hold).
- **Reduced Motion Integrity:** Users with motor or cognitive sensitivities can freeze all WebGL orbits and breathe scaling by activating the OS standard `prefers-reduced-motion` toggle.

### 1.3 Clinical Grounding & Scientific Humility

We believe that beautiful art does not need pseudo-scientific exaggeration to justify its value. We are completely transparent about acoustic properties:

- **Zero Healing Hyperbole:** We provide historical and microtonal tunings for their rich, acoustic beatings and timbral warmth, never claiming they heal DNA or cure physiological ailments.
- **Persistent Footprints:** A low-contrast clinical disclaimer sits permanently on the bottom of all listening views, grounding the soundscape as a wellness aid.

### 1.4 Private by Default

- **Data Sovereignty:** Personal practice data is the user's own. It is never public, never shared, never used to nudge.
- **Stats Computed Once:** Any aggregate metric is derived in a single place so framing can't drift between surfaces (`api/app/routers/me_sessions.py::compute_stats`).

---

## 2. Technical Implementation Checklist

Every feature and milestone sweep must verify compliance with this Calm by Design matrix:

- [x] **Voluntary Health Sync (v4.6):** Opt-in settings for Apple HealthKit or Google Health Connect are 100% voluntary, easily deactivated, and do not block core synthesis features.
- [x] **Local Data Exports (v4.6):** The CSV export is available freely, requiring no premium subscription, paid upgrades, or account registrations.
- [x] **Soft Fades on Interruptions:** When the user clicks Stop, Pause, or Exits, the orchestrator executes a linear gain volume fade-out over a minimum of 500ms, avoiding jarring acoustic cut-offs.
- [x] **Adaptive WebGL:** Canvas and shader rendering adapt frame rate or scale down when system thermal limits are approached, avoiding CPU fan spin or heavy thermal throttling.
- [x] **Focus Visible Focus Rings (v4.6):** Beautiful focus borders exist on every input, switch, slider, and selector, making the entire experience completely keyboard navigable.

---

## 3. CI Gate

A lexical test (`src/test/calm-by-design.test.ts`) scans the UI source for banned tokens (`streak`, `level up`, `achievement`, `daily goal`, `badge`, `leaderboard`, `don't break`, `keep it up`, `you missed`, `days in a row`, …) and **fails the build** on a match. Comments are stripped before scanning so this document's own use of those words (to forbid them) doesn't trip the gate. Extend `ROOTS`/`BANNED` as new surfaces land.

---

## 4. Review Checklists

### v4.5 — Session History + Curated Library

- [x] No streak counter anywhere (history, library, admin).
- [x] No points, badges, achievements, levels, XP.
- [x] No daily/weekly goal, no "X days in a row," no "you missed yesterday."
- [x] No notifications: no email, no push, no in-app reminder banner. None ship; none are stubbed; there is no scheduler that could send one.
- [x] Stats are descriptive, not motivational. The history surface renders "N sessions, H hours total this month" + "average M min" — no comparatives, no rank, no streak. The `SessionStatsOut` payload intentionally omits any engagement-signal field; a server test asserts the omission.
- [x] Stats computed in exactly one place (`compute_stats`); the client renders the server numbers verbatim.
- [x] History is private: account-gated, no public route, no profile display, no share button, no "share my stats."
- [x] Reflections are private and unshareable (≤500 chars).
- [x] The anonymous post-session prompt is a single, gentle, dismissible "sign in to keep your history" — never recurring, never guilt-framed, and never shown when nothing was listened.
- [x] Library is a calm, finite, paginated grid — no infinite scroll, no "trending," no algorithmic recommendation loop (editorial-only).
- [x] CI lexical gate present and green (`src/test/calm-by-design.test.ts`).

### v4.6 — Health Integrations + Accessibility

- [x] All native integrations (HealthKit & Health Connect) are opt-in only, with persistent user choice.
- [x] Complete WCAG 2.1 AA keyboard navigability and high-contrast outlines using the warm amber theme.
- [x] Standard touch targets respect 44x44 CSS pixels/points.
- [x] OS prefers-reduced-motion media query respect: pauses visual visualizer animations and halts breathing LFO pulses.

### v6.0 — Education Surface & Iframe Player

- [x] **No Gamification Elements:** No level gauges, streak indicators, daily quests, XP indicators, leaderboards, or score counters in the curriculum browser or lesson player.
- [x] **Calm Progress Tracking:** Step progression is represented by simple, low-contrast visual dots (`• • ◦ ◦ ◦`). There are no flashy level-up animations, celebratory confetti, or congratulatory sound effects upon completion.
- [x] **Non-Coercive Pathing (Unblocked Progress):** Lessons do not force high-stakes gates. Prompt challenges let users proceed at their own pace via a simple "I've Tried This" validation.
- [x] **Voluntary & Calm Reflection:** Reflection inputs are open-ended, optional, and unblocked. Users can save notes for their own personal summary, or skip/proceed directly if they prefer silent presence.
- [x] **Private & Local Summaries:** Handwritten reflections are summarized locally in the client-side session state for the user's review at the end of a lesson, remaining completely private and unshared.

### v6.3 — Progress Tracking & Next-Lesson Picker

> This is the slice with the highest engagement-loop risk (a progress + recommendation surface is exactly where a calm product could quietly grow a habit loop). The guardrails below are therefore explicit and CI-enforced.

- [x] **Progress is descriptive, not motivational.** The curriculum browser shows a quiet completed checkmark, a "N of M lessons explored" count, and a "Resume" hint — nothing else. No progress bars, no "you're 47% through," no "almost there," no completion percentage framed as an obligation.
- [x] **No streaks / no gamified counts.** No "days in a row," no session streak, no XP, no levels, no badges, no leaderboards, no points, no completion celebrations (no confetti, no sound). The v6.0 dots remain the only in-player progress affordance.
- [x] **Abandonment is invisible to the user.** The 30-day `abandoned` derivation is picker-internal; the stored state stays `in_progress`. Users are never told a lesson "expired" or shown a guilt-framed "you abandoned this," and can always resume.
- [x] **The picker is an offer, not a funnel.** 1–3 cards, always paired with a permanent "browse all lessons" escape. No "recommended for you" infinite feed, no autoplay-next-lesson, no ranking-as-competition, no urgency language in the rationales (the LLM is explicitly instructed against motivational copy).
- [x] **At most one gentle nudge.** The only outbound prompt is a single, dismissible, once-per-session "sign in to keep your progress" line (session-storage guarded). No emails, push, SMS, in-app reminders, or daily "continue your practice" prompts — none ship, none are stubbed.
- [x] **Stats computed once.** Effective-state derivation and per-track aggregation live solely in `api/app/services/progress_state.py`; the client renders the server's numbers verbatim, so framing can't drift between surfaces.
- [x] **Progress data is private.** Account-scoped, never public, no share button, no profile display. Anonymous progress stays client-side (localStorage) and is only ever uploaded by the explicit, user-triggered sign-in import.
- [x] **Reflection text never reaches the LLM.** The recommendation ranker reads only step-action metadata; a server test asserts no reflection content appears in the prompt, and the payload carries no PII.
- [x] **CI lexical gate extended to `src/learn`.** `src/test/calm-by-design.test.ts` now scans the Learn surface (progress + recommendation UI included), matching banned terms as whole words and ignoring CSS/code identifiers so it flags engagement-loop _copy_ only.
