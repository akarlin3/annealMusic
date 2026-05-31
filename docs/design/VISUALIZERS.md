# Visualizer Presets Specifications

This document outlines the visualizer preset configurations established in **v9.1** across both WebGL and 2D Canvas fallbacks.

---

## 1. WebGL Presets

WebGL visualizer styles are configured using standard uniform inputs:

### Meditation Mode Preset

- **Speed Scale**: `0.45x` slower.
- **Brightness**: Overall canvas output brightness scaled by `0.45` via `u_calm`.
- **Bloom**: Wider, softer bloom (larger glow boundaries with low central alphas).
- **HUD Overlays**: Hidden by default.

### Musician Mode Preset

- **Speed Scale**: `1.0x` (standard).
- **Brightness**: `1.0x` (standard).
- **Bloom**: Standard focused particles from v1.9.
- **HUD Overlays**: Standard.

### Researcher Mode Preset

- **Speed Scale**: `1.0x`.
- **Brightness**: `1.0x`.
- **Bloom**: High-contrast standard particles.
- **Spectrum Trace**: Displayed at the bottom with higher contrast opacity (`0.35`).
- **Telemetry Labels**: Active absolute overlays drawing text notes (e.g. `220.0 Hz (f1)`) next to each coordinate circle.

---

## 2. Canvas Fallback Presets

The 2D Canvas fallback renderer matches these specifications exactly inside `src/visual/canvas/draw.ts`, utilizing 2D canvas context commands to render identical labels and speeds.
