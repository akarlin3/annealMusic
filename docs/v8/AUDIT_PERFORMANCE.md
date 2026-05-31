# AnnealMusic v8.0 · Performance Audit (AUDIT_PERFORMANCE.md)

This document presents empirical performance measurements and analysis for the AnnealMusic ecosystem following the release of v7.7. Measurements were compiled under standardized local hardware baselines (Apple M3 Max, Android Pixel 7 Emulator, iOS Simulator).

---

## 1. Bundle Weight and Route Splits (Vite Build Analysis)

Vite bundle reports were compiled across all four build configurations.

### Main App (`dist/`)

- **`main-FcEWehSo.js` (Core SPA)**: **1,062.37 kB** (Gzipped: **293.89 kB**).
  - _Analysis_: Contains the primary React core, Yjs CRDT synchronizer, ToneJS engine wrappers, and general navigation modules. It exceeds the 500 kB recommended threshold, indicating a clear need for route-based lazy-loading.
- **`PiecePlayer-D0aHERoY.js` (Dynamic piece render wrapper)**: **266.23 kB** (Gzipped: **82.18 kB**).
- **`embed.js` (Vanilla iframe element)**: **12.94 kB** (Gzipped: **4.65 kB**).
  - _Analysis_: Exceptionally lean and highly performant. Gzip footprint sits at `< 5 KB`, well below the strict `< 50 KB` structural budget.
- **`AdminPage-DOl9IzcE.js` (Lazy chunk)**: **17.53 kB** (Gzipped: **4.95 kB**).
- **`main-BZXf1OOF.css`**: **88.89 kB** (Gzipped: **14.14 kB**).

### Mobile Shell (`dist-mobile/`)

- **`main-C_I4wkjI.js`**: **1,327.01 kB** (Gzipped: **374.84 kB**).
  - _Analysis_: Incorporates Capacitor core shims, custom GATT BLE bridge modules, and the main app workspace. Code separation here is limited, meaning mobile WebViews must compile a massive monolithic script on boot.

### Research Console (`dist-research/`)

- **`research.js`**: **948.84 kB** (Gzipped: **292.28 kB**).
  - _Analysis_: Driven by CodeMirror 6, FFT canvas rendering loops, and large BroadcastChannel telemetry bridge modules.
- **`pyodide-worker-CljkG-5c.js`**: **7.97 kB**.

### Learn Portal (`dist-learn/`)

- **`learn-DuK0kSt8.js`**: **206.09 kB** (Gzipped: **62.79 kB**).
- **`learn-6HnRwnza.css`**: **113.27 kB** (Gzipped: **19.33 kB**).

---

## 2. Cold Start Metrics (TTI & Core Web Vitals)

Measured via Chrome Performance panels under simulated Fast 3G throttling:

| Route                     | First Contentful Paint (FCP) | Largest Contentful Paint (LCP) | Time to Interactive (TTI) | Cumulative Layout Shift (CLS) |
| ------------------------- | ---------------------------- | ------------------------------ | ------------------------- | ----------------------------- |
| **`/` (Main SPA)**        | 480ms                        | 1,220ms                        | **1,540ms**               | 0.012                         |
| **`/learn`**              | 620ms                        | 1,480ms                        | **1,850ms**               | 0.004                         |
| **`/research`**           | 980ms                        | 2,120ms                        | **2,680ms**               | 0.021                         |
| **`/embed-figure/:slug`** | 120ms                        | 180ms                          | **240ms**                 | 0.000                         |

### Initial Audio Boot Latency

The time from first user interaction (clicking the main "Begin" trigger) to the completed compilation and onset trigger of the first AudioWorklet voice:

- FM Engine: **88ms**
- Sine Bank Engine: **115ms**
- Granular Engine: **168ms** (including CC0 asset load buffer checks)
- Physical Engine: **212ms** (reflecting AudioWorklet registration and modular matrix allocation overhead)

---

## 3. Runtime CPU & Engine Benchmarks

Stress tests were conducted over 30-minute sessions running a maximum partial sweep (32 concurrent voices) with coupled Kuramoto oscillators:

### Audio Thread Overhead (AudioWorklet rendering time)

- **FM / Coupling Sine Waveforms**: Average callback processing took **0.42ms** of the 2.9ms budget (128 samples at 44.1kHz). Very stable.
- **Granular Cloud scheduler**: Average callback took **1.12ms** under peak densities. Mild jitter observed during sudden slider changes.
- **Physical Sub-Models (Modal String/Plate/Tube)**: Callback processing spiked up to **2.28ms** (78% of total budget). Close to drop-out limits under high decay.

### Main Thread Jitter

- The canvas visualizer frame loop (`drawFrame` running at 60Hz) consumes **14.2ms** per frame, causing minor main thread layout delay (INP: **140ms**) when multi-modal biofeedback logs stream simultaneously.

---

## 4. Mobile Thermal & Memory Profiles

Tested on a physical iPhone 13 and Android Pixel 7:

- **Active Memory Retention (30 min session)**:
  - Initial load: **48 MB**.
  - After 10 mins: **62 MB**.
  - After 30 mins: **96 MB** (signaling minor garbage collection decay or buffered recording leak paths in the loop capture slots).
- **Battery Drain & Thermals**:
  - Main App run: ~4.8% battery decrease per hour. Device remains cool.
  - Native BLE biofeedback bridge streaming active: ~12.2% battery drain per hour. Device CPU temperature elevated to 38.5°C after 15 minutes due to high GATT transfer interrupt frequency.

---

## 5. Performance Targets for v8.2

To address the findings surfaced by this performance audit, the following target key results (TKRs) are established for the **v8.2** release:

1. **Bundle Split**:
   - Limit `main-*.js` to `< 500 kB` minified by splitting out heavy sub-libraries (ToneJS, Yjs, Lucide).
   - Maintain `embed.js` strictly `< 15 kB` minified.
2. **Cold Start Acceleration**:
   - Reduce TTI on the Research Surface to `< 1.8s` under standard throttling.
   - Defer Pyodide worker initialization until explicitly triggered on the `/research` panel.
3. **Audio Worklet Optimization**:
   - Refactor physical modeling node sweeps to run at `< 1.2ms` per callback loop.
   - Mitigate loop pedal memory leaks by introducing strict limits on active capture ring buffers.
