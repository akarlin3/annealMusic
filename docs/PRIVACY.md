# Privacy & Data Flow Policy: Health & Session Tracking

At **AnnealMusic**, we believe that mindful listening should never come at the expense of your digital privacy. This document outlines our strict, privacy-first data handling policies, specifically regarding the **Health Platform Integrations** (Apple Health and Google Health Connect) and **Session History Tracking** introduced in the v4.6.0 milestone.

---

## 1. Core Privacy Commitments

1. **Strictly Opt-In**: Integrations with Apple Health (HealthKit) and Google Health Connect are **disabled by default**. We will never request permissions or attempt to access your health data stores unless you explicitly toggle them ON in your Account Settings.
2. **Local Processing Priority**: All listening session tracking occurs locally on your device. Session durations, start/end times, and active listening metrics are logged to your personal history.
3. **No Commercialization**: We do not sell, rent, or monetize your session history or health data. We do not integrate with third-party advertising SDKs, data brokers, or analytics companies.
4. **Data Portability**: You own your listening history. We offer a full, clean CSV export button under your settings so you can download and backup your data at any time.

---

## 2. Health Platform Data Flows

When you explicitly opt-in to sync your mindful activity, the application interacts with the native OS health databases as follows:

```mermaid
graph TD
    A[Listening Session Completed] --> B{Health Sync Opt-In?};
    B -- Yes (iOS) --> C[Apple HealthKit Bridge];
    B -- Yes (Android) --> D[Google Health Connect Bridge];
    B -- No --> E[Log locally only];

    C --> F[Write Category Sample: HKCategoryTypeIdentifierMindfulSession];
    D --> G[Write Record Type: MindfulnessSessionRecord];

    F --> H[iOS Health App - Private Store];
    G --> I[Android Health Connect - Private Store];
```

### 2.1 Apple Health (HealthKit - iOS)

- **Scope**: Write-only permissions to `HKCategoryTypeIdentifierMindfulSession` ("Mindful Minutes").
- **Behavior**: When a listening session or a stand-alone bell timer session exceeds 5 seconds, we write a category sample to your local Apple Health database. The sample contains only the starting timestamp, ending timestamp, and active duration.
- **Revocation**: You can disable this synchronization at any time in the settings panel. Doing so halts future write requests. Past entries saved to Apple Health remain there and can be removed by opening the built-in iOS Health App.

### 2.2 Google Health Connect (Android)

- **Scope**: Write-only permissions for the Jetpack Health Connect `MindfulnessSessionRecord` type.
- **Behavior**: Similar to iOS, upon completion of a session exceeding 5 seconds, the native Java bridge writes a Mindfulness Session Record containing your starting time, ending time, and duration.
- **Revocation**: You can revoke access at any time through your Android Settings -> Apps -> Health Connect -> AnnealMusic page or directly in our settings panel.

---

## 3. Persistent Session History (Backend)

To support multi-device synchronization and anonymous claims, we write your history to a secure SQL database:

- **Logged Fields**:
  - `listening_session_id`: Unique reference to the curated track (or `null` if using the standalone bell timer).
  - `started_at`: Starting datetime.
  - `completed_at`: Ending datetime.
  - `duration_seconds`: The actual elapsed time spent listening.
  - `is_standalone_timer`: Flag separating focus timers from synthesizers.
- **Security Bounds**:
  - Entries are tied strictly to your authenticated `user_id` or your cryptographically isolated `x-anon-id`.
  - The history export endpoint (`GET /me/sessions/export`) respects these authentication bounds and will never return history belonging to other users.

---

## 4. Lesson Progress (Learn surface, v6.3)

The `/learn` surface records your progress through lessons so you can resume where you left off and so we can suggest a sensible next lesson. This data is **strictly private** — it is never shown to other users, never public, and never used to nudge you back.

### 4.1 What we store

For each lesson you start, a `lesson_progress` row (keyed to your `user_id`) holds:

- `state` (`not_started` / `in_progress` / `completed`), the current step, and a 0..1 scroll position so you can resume.
- `started_at` / `last_active_at` / `completed_at` timestamps.
- A **bounded** per-step action log (`{step_position, action, time-on-step in ms}`) — metadata only, no free text.
- `reflection_text` — any notes you chose to write in a reflection step.

`abandoned` is **computed** (after 30 days of inactivity) for recommendation purposes only; it is never written to the database, and you can always resume.

### 4.2 Where it lives

- **Signed in:** progress is stored server-side against your account, so it follows you across devices.
- **Anonymous:** progress stays in your browser's `localStorage` only — it is **never** uploaded to our servers. It is device-local; switching devices or clearing storage loses it. On your first sign-in, we offer to migrate this local progress to your account once (an idempotent merge); after that the server is the source of truth and the local copy is cleared.

### 4.3 The next-lesson recommendation

When we suggest a next lesson, we send a Claude (Haiku) model a **compact, metadata-only** summary of your progress: which lessons you completed (by title), your current track and aggregate counts, a text-free digest of recent step activity, and a coarse "time since last session" bucket — plus the candidate lesson list.

- **Your `reflection_text` is never sent to the model.** Only step-action metadata becomes a signal. A server-side test asserts that no reflection content appears in the prompt.
- The payload contains **no PII** (no name, email, or device identifiers).

### 4.4 Your control

Progress is account-scoped and never published or shared. Deleting your account cascades and removes all `lesson_progress` rows (`ON DELETE CASCADE`).
