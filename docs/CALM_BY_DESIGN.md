# Calm By Design: Architecture & UX Manifesto

At **AnnealMusic**, we design experiences that respect the human mind. The software is engineered not to capture your attention, but to support your presence. We call this framework **Calm By Design**.

This document outlines the architectural standards, interaction guidelines, and checklist items that define all versions of AnnealMusic.

---

## 1. Core UX Pillars

### 1.1 Attention Sovereignty (Anti-Engagement)

Most modern applications are optimized for "Daily Active Users" (DAU), screen time, and scroll depth. AnnealMusic actively rejects these metrics:

- **No Reminders**: We do not send push notifications telling you to meditate or return. You use the application when _you_ choose.
- **No Streaks or Badges**: We do not gamify focus. There are no virtual awards, streaks, or behavioral loops.
- **Silent Closes**: When a session finishes or you exit, the engine fades out to silent absolute rest. We do not auto-play next tracks.

### 1.2 Aesthetic Minimalism

All fullscreen listening and timer panels focus on visual breathing spaces rather than complex control interfaces:

- **Hidden Sculpting HUDs**: Full customization controls are nested inside collapsable drawers or hidden behind escape hatches (e.g. the "Sliders" button in `ListeningView`).
- **Dynamic Pacing Circles**: Breathing visualizers rely on slow, organic trigonometric scaling (LFOs) holding to a calm 16-second cycle (4s inhale, 4s hold, 4s exhale, 4s hold).
- **Reduced Motion Integrity**: Users with motor or cognitive sensitivities can freeze all WebGL orbits and breathe scaling by activating the OS standard `prefers-reduced-motion` toggle.

### 1.3 Clinical Grounding & Scientific Humility

We believe that beautiful art does not need pseudo-scientific exaggeration to justify its value. We are completely transparent about acoustic properties:

- **Zero Healing Hyperbole**: We provide historical and microtonal tunings for their rich, acoustic beatings and timbral warmth, never claiming they heal DNA or cure physiological ailments.
- **Persistent Footprints**: A low-contrast clinical disclaimer sits permanently on the bottom of all listening views, grounding the soundscape as a wellness aid.

---

## 2. Technical Implementation Checklist

Every feature and milestone sweep must verify compliance with this Calm by Design matrix:

- [ ] **Voluntary Health Sync**: Opt-in settings for Apple HealthKit or Google Health Connect are 100% voluntary, easily deactivated, and do not block core synthesis features.
- [ ] **Local Data Exports**: The CSV export is available freely, requiring no premium subscription, paid upgrades, or account registrations.
- [ ] **Soft Fades on Interruptions**: When the user clicks Stop, Pause, or Exits, the orchestrator executes a linear gain volume fade-out over a minimum of 500ms, avoiding jarring acoustic cut-offs.
- [ ] **Adaptive WebGL**: Canvas and shader rendering adapt frame rate or scale down when system thermal limits are approached, avoiding CPU fan spin or heavy thermal throttling.
- [ ] **Focus Visible Focus Rings**: Beautiful focus borders exist on every input, switch, slider, and selector, making the entire experience completely keyboard navigabler.
