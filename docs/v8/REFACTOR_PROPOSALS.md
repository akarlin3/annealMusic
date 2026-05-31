# AnnealMusic v8.0 · Architectural Refactor Proposals (REFACTOR_PROPOSALS.md)

Based on the empirical findings surfaced in our performance, code health, and safety audits, we propose six high-impact architectural refactorings for implementation across the v8.4 release cycle.

---

## Refactor 1: Render Path Unification (The Render Sprawl)

### The Smell

There are currently six distinct audio-rendering code paths:

1. **v0.8 Preview render** (Headless Playwright recording a real-time playback).
2. **v1.5 Stem export** (Offline sequential canvas tracking).
3. **v5.2 CLI render** (Pure Node offline audio execution).
4. **v7.6 Video render** (Non-blocking FFmpeg H.264 streams).
5. **v7.5 Study export render** (Differential privacy baseline runs).
6. **v3.7 Piece preview** (Standard client player).

### Proposed Remediation

- **Architecture**: Introduce a single, core, environment-agnostic **`AnnealRenderer`** interface. Standardize on a single, shared Web Audio context wrapper that can be spawned dynamically in-browser (for real-time preview and multi-track stems) or executed under headless environment scripts (for CLI batch rendering and FFmpeg transcoder pipelines).
- **Prioritization Metrics**:
  - **Severity**: 4/5 (Substantial redundancy, high maintenance overhead).
  - **User Impact**: 3/5 (Fixes rendering parity drift between CLI, video, and client).
  - **Fix Cost**: 3/5 (Requires refactoring the orchestrator bindings).
  - **Fix Risk**: 3/5 (Needs careful regression testing on export buffers).
  - **Priority Score**: **1.33**

---

## Refactor 2: Single Source of Truth Schema (Schema Drift)

### The Smell

The core synthesis parameter schema is duplicated in **four separate layers**:

1. TypeScript Types (`src/types/params.ts`)
2. Pydantic validation files (`api/app/schemas.py`)
3. OSC namespace registries (`src/research/osc/OSCNamespace.ts`)
4. Python SDK module wrappers (`src/research/python/`)

### Proposed Remediation

- **Architecture**: Designate `schema/manifest.json` as the absolute compile-time source of truth. Author a Node-based generator script (`scripts/sync-schemas.mjs`) that automatically compiles and syncs frontend TS definitions, Python models, and OSC addressing lists during build routines, eliminating manual duplicate entries.
- **Prioritization Metrics**:
  - **Severity**: 5/5 (High drift potential, breaks backwards compatibility when parameters change).
  - **User Impact**: 2/5 (Directly impacts code stability, prevents parsing crashes).
  - **Fix Cost**: 2/5 (Requires writing parsing scripts across python/TS syntax generators).
  - **Fix Risk**: 4/5 (High regression danger for saved legacy patches).
  - **Priority Score**: **1.25**

---

## Refactor 3: Unified Transport Bridge

### The Smell

The application contains four distinct, ad-hoc event bridges:

1. **postMessage** (connecting embeds and learning portals).
2. **BroadcastChannel** (slider telemetry updates inside the `/research` workspace).
3. **WebSockets** (collaborative P2P signaling).
4. **stdio** (sub-process CLI streaming).

### Proposed Remediation

- **Architecture**: Define a unified **`TransportBridge`** abstraction layer. Decouple logical payload messages (JSON-RPC 2.0 frames) from the mechanical delivery pathway. The bridge determines the transport medium dynamically while offering the client a single, standardized, event-driven contract.
- **Prioritization Metrics**:
  - **Severity**: 3/5 (Unnecessary complexity).
  - **User Impact**: 2/5 (Smoother cross-window updates).
  - **Fix Cost**: 4/5 (Straightforward pattern translation).
  - **Fix Risk**: 2/5 (Low risk, isolated to communication boundaries).
  - **Priority Score**: **0.75**

---

## Refactor 4: Modular Audio Engine Interface (Interface Bloat)

### The Smell

The v0.3 `AnnealEngine` interface has bloated significantly, accumulating parameters for async asset loaders, multi-channel stem taps, drift detunes, and deferred error listeners.

### Proposed Remediation

- **Architecture**: Apply _Composition over Inheritance_. Transition the monolithic interface into a base synthesis engine class supported by optional capability interfaces:
  - `StemExportableEngine`: Implements `getPartialOutputs()`.
  - `AssetLoadableEngine`: Implements lazy loader paths.
  - `DynamicModulatableEngine`: Implements telemetry and parameter sweeps.
- **Prioritization Metrics**:
  - **Severity**: 4/5 (Interface strains third-party contributions).
  - **User Impact**: 1/5 (Invisible to listeners).
  - **Fix Cost**: 2/5 (Requires touching all 5 core synthesis engines).
  - **Fix Risk**: 5/5 (Highest risk; touches critical Web Audio execution paths).
  - **Priority Score**: **0.40**

---

## Refactor 5: Cohesive Mobile Shell Bridge

### The Smell

iOS and Android wrappers leverage individual native plugins (Health, BLE GATT, OSC, deep links) that duplicate platform-specific checking rules and register hooks directly to page context.

### Proposed Remediation

- **Architecture**: Unify native Capacitor hooks inside a singular, central **`AnnealMobileBridge`** plugin class, wrapping platform-specific checks, background audio lifecycle listeners, and GATT interruptions behind one cohesive interface.
- **Prioritization Metrics**:
  - **Severity**: 3/5 (Scattered configuration).
  - **User Impact**: 3/5 (Improves mobile app stability during background audio shifts).
  - **Fix Cost**: 3/5 (Requires iOS Swift and Android Kotlin plugin adaptations).
  - **Fix Risk**: 3/5 (Can impact native store builds).
  - **Priority Score**: **1.00**

---

## Refactor 6: Pyodide CDN Local Cache

### The Smell

The scientific Python sandbox loads substantial external libraries over CDN, causing delay and TTI spikes on initial research console boots.

### Proposed Remediation

- **Architecture**: Package whitelisted scientific packages locally inside the application bundle or configure a custom Service Worker cache (`pyodide-cache-worker.js`) to locally store fetched CDN structures, making scientific Python work offline by default.
- **Prioritization Metrics**:
  - **Severity**: 2/5 (Network latency dependency).
  - **User Impact**: 4/5 (Crucial performance improvement for scientific users).
  - **Fix Cost**: 4/5 (Standard service worker setup).
  - **Fix Risk**: 2/5 (Low risk).
  - **Priority Score**: **1.00**
