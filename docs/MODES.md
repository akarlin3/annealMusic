# AnnealMusic Top-Level Modes User Guide

Welcome to the **Top-Level Modes** system introduced in **AnnealMusic v9.0**.

Modes allow you to customize your generative soundscape experience depending on your current focus. Whether you are using AnnealMusic to settle your mind, perform live syntheses, or run scientific clinical trials, top-level modes keep your interface clean and focused by hiding off-mode surfaces, while preserving direct URL access.

---

## The Three Top-Level Focus Modes

### 🧘 Meditation Focus Mode

Designed for focus, sleep, mindfulness, and breathing.

- **Landing Surface**: Curated session library (`/listen`).
- **Creative Sandbox**: Enforces a highly constrained **Drone Mode** sculpting surface.
- **Affordances**: Immersive breathing pacing cues (with haptic transitions on mobile), focus timers, and personal session history.
- **Hidden by default**: Collaboration loops, stem exports, MIDI panels, social feeds, public galleries, datalogging, and Python console tools.

### 🎹 Musician Sandbox Mode

The full creative ambient sculpting workspace.

- **Landing Surface**: The primary generative app workspace (`/`).
- **Creative Sandbox**: Access to all three v4.2 sub-modes (**Sketch / Compose / Drone**).
- **Affordances**: Loop pedal recording, instrument voice input, WebMIDI routing, stem export renders, patch sharing, and public community gallery streams.
- **Hidden by default**: Scientific analysis telemetry, OSC servers, Python script builders, and clinical protocols.

### 🔬 Research Interface Console

A scientific laboratory dashboard for data mapping and psychoacoustic studies.

- **Landing Surface**: Standalone research console SPA (`/research.html`).
- **Affordances**: Real-time RPC telemetry logs, bidirectional OSC bridging, scientific dataloggers (exporting to Parquet, CSV, Parquet, HDF5), interactive Virtual Filesystems (VFS), Python Pyodide Worker REPLs, and clinical study reproducible export packages.
- **Hidden by default**: Social feed updates, loop slots, tuning lattices, and breathing pacers.

---

## Switcher UI & Keyboard Shortcuts

### Persistent Segmented Switcher

Every top-level application header contains a sleek, segmented switcher:

- Segment labels show the mode emoji (**🧘** / **🎹** / **🔬**) and slide a glowing pill indicator behind the active mode choice.
- Clicking any segment instantly saves that mode per-device and redirects you to that mode's landing page.

### Cycles via Keyboard Shortcut

You can cycle modes at any time using:

> **`Shift+M`**

Pressing `Shift+M` will cycle sequentially (`Meditation` → `Musician` → `Researcher` → `Meditation`), flashing clean visual feedback and performing the landing page redirect instantly.

---

## Architecture & Sticky Per-Device Persistence

- **No Server Sync**: Modes are intentionally kept **per-device** instead of per-account. This allows you to naturally use Meditation Mode on your phone (Capacitor native app) for falling asleep, while using Musician Mode on your laptop (Web browser) for composition without clashes.
- **Capacitor Storage Abstraction**: Leverages Capacitor Preferences on native iOS/Android, falling back cleanly to `localStorage` on standard web builds.
- **Soft Gating Policy**: Mode boundaries only shape **foregrounded visibility**. Hiding a tool from the header does not restrict direct access. Direct bookmark URLs will always open and work normally regardless of the active device mode.
