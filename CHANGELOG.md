# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.0]: https://github.com/akarlin3/annealMusic/releases/tag/v0.2.0
[0.1.0]: https://github.com/akarlin3/annealMusic/releases/tag/v0.1.0
