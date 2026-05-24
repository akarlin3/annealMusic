# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-05-24

### Added

- **Engine-swap abstraction.** A new `AnnealEngine` interface
  (`src/audio/engines/types.ts`) defines the contract every synthesis engine
  implements; the new `Orchestrator` (`src/audio/orchestrator.ts`) owns the
  audio context, shared physics, post-fx chain, drift loop, and engine
  lifecycle. Engines are registered in `src/audio/engines/index.ts`.
- **FM engine** (`fm`): two-operator FM per partial — sine carrier, modulator at
  `carrier × Ratio`, depth `Index × carrier` Hz, plus optional modulator
  self-**Feedback**. Engine params: `modRatio` (0.5–4), `modIndex` (0–10),
  `feedback` (0–1).
- **Hot engine swap with crossfade.** Each engine routes through its own bus
  gain; switching engines equal-gain crossfades over ~600ms (no page reload, no
  click), coalescing rapid switches to the latest target.
- **Engine selector** segmented control (Sine / FM) under the header, with an
  ARIA radiogroup + arrow-key navigation, and an **Engine** group in the control
  panel rendering the active engine's params (hidden when an engine has none).
- **URL schema v2**: adds the engine selector (`e=<id>`) and namespaced engine
  params (`fm.modRatio`, …). v1 links still load, interpreted as `engine=sine`.
- Store gains `engineId` + per-engine `engineParams` (retained across switches),
  with `setEngine` / `setEngineParam` actions.
- Tests: FM lifecycle + frequency/detune tracking, orchestrator boot/swap/drift,
  crossfade overlap (no gap/clip) via a new Web Audio test mock, and schema-v2
  round-trip + v1 back-compat.

### Changed

- The monolithic `AnnealMusicEngine` was refactored into `Orchestrator` +
  `SineEngine` with identical sine behavior; the global fade now lives on
  per-engine bus gains rather than the master node.

## [0.2.0] - 2026-05-24

### Added

- URL state sharing: the full sculptable parameter set (volume excluded) is
  encoded in the URL fragment under a versioned, human-readable schema
  (`#s=1:<key=value…>`, schema version `1`).
- `src/share/` module: `schema` (version, shared keys, bounds derived from
  `CONTROL_DEFS`), `encode`/`decode` (never throws; clamps out-of-range values,
  ignores unknown keys, collects warnings), and `url` (hash read/write +
  debounced `replaceState` sync).
- App boot hydration: valid URL state is applied (via a new `setMany` batch
  store action) before the audio engine is constructed.
- **Copy Link** button in the header, using `navigator.clipboard` with an
  `execCommand` fallback and a manual-prompt last resort.
- Single-slot `Toast` component for "Loaded shared session" / copy feedback /
  newer-version notices.
- Tests: round-trip property test, decoder fuzz (1000 strings, never throws),
  bounds clamping, unknown-key/version handling, `CONTROL_DEFS` drift guard, and
  clipboard component tests.

## [0.1.0] - 2026-05-23

### Added

- Initial project scaffold: Vite + React 18 + TypeScript (strict) + Tailwind CSS.
- Web Audio engine (`AnnealMusicEngine`): coupled sine bank over a harmonic
  lattice, Ornstein–Uhlenbeck + Kuramoto-style detune drift, convolution reverb,
  lowpass tone control, and analyser-driven visuals.
- Pure, testable `driftStep` (injectable RNG) and `makeIR` modules.
- Zustand parameter store with typed control definitions and bounds clamping.
- Canvas 2D visualizer (`drawFrame`) with audio-reactive orbiting partials and a
  spectrum trace.
- `ControlPanel` (Pitch / Physics / Tone groups + volume) and collapsible
  `ArchitectureDiagram`.
- Unit tests for drift physics and parameter bounds (Vitest + jsdom).
- Tooling: ESLint + Prettier, Husky + lint-staged pre-commit, CI workflow.
- Docs: `INIT_PLAN`, `ROADMAP`, `COMPAT`, and the preserved prototype.

[0.3.0]: https://github.com/akarlin3/annealMusic/releases/tag/v0.3.0
[0.2.0]: https://github.com/akarlin3/annealMusic/releases/tag/v0.2.0
[0.1.0]: https://github.com/akarlin3/annealMusic/releases/tag/v0.1.0
