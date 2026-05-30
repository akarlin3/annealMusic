# Breath Pacing (v4.4)

AnnealMusic can show an optional, silent, **visual** breath-pacing cue while you
listen. It is off by default and opt-in per session (Listening Sessions) or per
device (Drone Mode and the Standalone Timer).

> Breath pacing is **visual only**. There are no breath sounds, no chimes on
> phase changes, and no spoken guidance — the music stays the only thing you
> hear. (Audio breath guidance is flagged for a future v4.4.1 if there's demand.)

## What you see

A slow-pulsing amber circle sits at the center of the visualizer:

- **Inhale** — the circle expands smoothly (gentle ease-in-out at both ends).
- **Hold (full)** — it rests at its largest, with a faint lowercase `hold` label.
- **Exhale** — it contracts smoothly.
- **Hold (empty)** — it rests at its smallest.

A thin ring around the circle sweeps once per full breath, so you can feel where
you are in the cycle without any numbers — counting numerals are deliberately
omitted to avoid mental noise during a contemplative listen. The visualizer
behind the circle dims slightly while breath is active so the cue reads clearly.

## Where it appears

| Surface                         | How to enable                               | Persistence                                             |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| **Listening Sessions**          | Pick a pattern in the session creation flow | Saved with the session (schema v20) and in shared links |
| **Drone Mode**                  | Toggle a pattern in the Drone controls      | Per-device (`localStorage`)                             |
| **Standalone Timer** (`/timer`) | Pick a pattern in the timer settings        | Per-device (`localStorage`)                             |

In a Listening Session the overlay appears only during **deep listening** — after
the settle-in fade and before the integration close-out — so it never intrudes on
the opening or closing of the session.

## Patterns

A pattern is four phase durations in seconds: `[inhale, hold_full, exhale,
hold_empty]`. A hold of `0` means "no hold" and is skipped.

| Pattern                 | Durations          | Notes                                                    |
| ----------------------- | ------------------ | -------------------------------------------------------- |
| **Box (4-4-4-4)**       | `[4, 4, 4, 4]`     | Simple, symmetric. Widely used for focus and steadying.  |
| **4-7-8**               | `[4, 7, 8, 0]`     | Popularized by Andrew Weil.                              |
| **Coherent (5.5/min)**  | `[5.5, 0, 5.5, 0]` | Slow, even breathing at ~5.5 breaths/min.                |
| **Resonance (4.5/min)** | `[6, 0, 6.5, 0]`   | HeartMath-style, ~4.5 breaths/min.                       |
| **Custom**              | your four numbers  | Inhale/exhale ≥ 1s, each phase ≤ 30s, whole cycle ≤ 60s. |

### Honest framing

We keep claims modest (see [FRAMING.md](./FRAMING.md)):

- **Box (4-4-4-4):** A simple, symmetric pattern — equal inhale, hold, exhale,
  and hold. Widely used for focus and steadying; calming for many. No specific
  clinical outcome is claimed.
- **4-7-8:** Popularized by Andrew Weil. Calming for many practitioners. Specific
  physiological mechanism claims (e.g. immediate vagal activation) are not
  well-established.
- **Coherent (5.5/min):** Slow, even breathing at about 5.5 breaths per minute.
  May improve heart rate variability in controlled studies; long-term clinical
  claims are less settled.
- **Resonance (4.5/min):** A slightly slower paced breath (~4.5/min) used in
  HeartMath-style approaches. Associated with HRV biofeedback work; evidence for
  durable clinical benefit is mixed.
- **Custom:** No framing — you're on your own. Any breath pattern that feels
  comfortable is good.

## Accessibility

- **Reduce motion.** If your OS sets `prefers-reduced-motion`, or you enable the
  in-app "Reduce motion" toggle, the circle stops changing size and instead
  cross-fades its colour between phases — the pacing is conveyed by brightness,
  not movement. The motion is otherwise slow by design.
- **Haptics (mobile).** Optionally, on a native iOS/Android build, the device can
  give a gentle tap at each phase transition. This is **off by default** and has
  no effect on the web.

## Recording

The breath pattern is part of a Listening Session's saved state, but it is
**visual only** and is never rendered into audio recordings. Session manifest
exports note the pattern for reference.

## For developers

The breath feature lives in `src/breath/`:

| File                  | Role                                                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `patterns.ts`         | Built-in pattern registry, framing copy, custom-pattern bounds, visual constants. The 4-tuples are declared here exactly once.                                                    |
| `BreathController.ts` | Pure, framework-free cycle math. Driven by an absolute clock (`AudioContext.currentTime`); phase is `mod(time, cycleLength)`, so backgrounded tabs and long sessions never drift. |
| `BreathOverlay.tsx`   | The overlay canvas that composes above the visualizer, with the reduced-motion branch and haptic dispatch.                                                                        |
| `BreathPicker.tsx`    | Shared pattern picker used by all three surfaces.                                                                                                                                 |
| `hapticBridge.ts`     | Thin `@capacitor/haptics` wrapper; a no-op on the web.                                                                                                                            |
| `useBreathPrefs.ts`   | Device-local prefs (reduce-motion, haptics) and per-surface pattern persistence.                                                                                                  |

The cycle math lives **only** in `BreathController` — UI surfaces read frames from
it and never recompute phase.
