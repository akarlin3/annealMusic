# Loop Pedal Guide

A short guide to capturing, layering, and freezing loops in the Anneal Ambiance
field. The loop pedal works on the **live input**, so connect an instrument or
mic first (see [`INPUT_GUIDE.md`](INPUT_GUIDE.md)).

## The three slots

There are three independent slots — **A**, **B**, **C**. Each captures the
processed input (after the compressor, high-pass, and drift filter), loops it
seamlessly, and can be frozen into a granular drone. Drive them with the buttons
on each card or with the keyboard.

## Capture a loop

1. Connect an input above.
2. **Arm** a slot — press `1` (A), `2` (B), or `3` (C), or click **Arm**.
3. Play. Capture starts on the **first sound** and the card shows a recording
   dot.
4. **Stop** to commit — press the same key (now labelled **Stop**) or wait for
   the **60-second** cap, which auto-commits. The slot drops into **playing**
   and loops with a short crossfade at the seam (no click).

Captures under 250 ms are discarded. There is **no undo** — re-arming a slot
overwrites it (the **clear** trash button empties it).

## Layer

Capture A, then B, then C — they play together, summed into the same post-fx as
the engine. Each active slot also adds a faint ring to the visualizer.

## Freeze (granular)

Press `Shift+1/2/3` (or the **snowflake**) on a playing slot to **freeze** it.
The slot stops looping linearly and instead sprays short overlapping grains from
wandering positions in the buffer — a single chord becomes an endless
drone-of-itself. The card reveals four sliders:

- **Grain size** (30–300 ms) — short = shimmery/textural, long = smooth/pad-like.
- **Density** (4–40 /s) — grains per second; higher = thicker.
- **Position jitter** (0–1) — how far grains wander from the scanning center.
- **Pitch jitter** (0–100 ¢) — random per-grain detune; leave at 0 for a
  pitch-stable freeze, raise for a chorused shimmer.

**Drift-coupled** (toggle) ties the grain wander to the same drift field that
modulates the engine and input, so a frozen slot keeps breathing. Press
`Shift+<n>` again (or the snowflake) to thaw back to normal looping.

## Mute & clear

- **Mute** (`1/2/3` on a playing/frozen slot, or the speaker icon) silences a
  slot while keeping the buffer; unmute restores its previous state (including
  frozen).
- **Clear** (trash icon) empties the slot and frees the memory.

## Sharing

Loop **settings** (muted / frozen / grain params) travel in the share link, but
the captured **audio does not** — open a shared link with frozen slots and
they'll load empty with the settings remembered, ready to apply the moment you
capture. (Buffer-level sharing arrives with the v0.7 backend.)

## Notes

- Loops keep playing through engine swaps and arc start/stop.
- Capture needs `AudioWorklet` (every current browser); see `COMPAT.md`.
- Three 60 s slots can use ~70 MB — fine on desktop; low-memory phones get a
  console warning.
