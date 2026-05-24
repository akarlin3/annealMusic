# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-05-24

### Added

- **Live instrument input.** A mic / line-in / audio interface can be brought
  into the texture as a sibling voice alongside the engine. Opt-in via a
  **Connect input** affordance that calls `getUserMedia`; permission denial is
  handled gracefully with per-browser fix instructions and a retry.
- **`InputVoice`** (`src/input/InputVoice.ts`): owns the per-voice processing
  chain — high-pass @ 80 Hz, a gentle `DynamicsCompressor` (−24 dB / 3:1 / soft
  knee), an optional (default-off) soft-clip shaper, the user **Input Level**,
  and a **drift-modulated peaking filter** whose center frequency tracks the
  drift loop's mean detune, so the live voice breathes on the same field as the
  engine partials. Output feeds the shared post-fx chain.
- **Music-friendly capture**: `echoCancellation`, `noiseSuppression`, and
  `autoGainControl` are disabled so the signal reaches the engine clean.
- **Monitoring is muted by default** (feedback-safe). A pre-gate analyser drives
  the level meter and visualizer ring even when monitoring is off.
- **Input panel UI**: device picker (handles empty labels pre-grant), warm-amber
  LED **level meter** (~30 Hz, peak + clip indicators), Input Level slider,
  monitoring toggle (with a feedback warning), a latency estimate readout, and a
  disconnect affordance. The panel stays controllable in every mode — the arc
  never touches input.
- **Visualizer input ring**: input amplitude pulses a faint ring around the
  central halo (absent entirely when no input is connected).
- **Feedback guard**: while monitoring, sustained hot RMS (>0.9 for >2 s) dims
  monitoring and surfaces a toast.
- **Resilience**: stereo input is summed to mono; device-change / unplug
  gracefully reconnects to the default device without crashing the audio graph;
  the audio core (context + post-fx) is decoupled from the session lifecycle so
  input can be live before Begin and survives engine swaps and arc start/stop.

### Notes

- Input is a **runtime/hardware concern** and is intentionally **absent from the
  URL schema** — sharing a link never carries input state. No schema bump.
- Input latency is surfaced as a labeled **estimate**: Web Audio does not expose
  true mic→node latency, so the readout uses `baseLatency` + `outputLatency`
  (formula in `src/input/latency.ts`, documented in `COMPAT.md`).
- v0.5 is a single mono routed voice; pitch detection / harmonization, the loop
  pedal, multi-input, and sidechain/ducking are out of scope (see ROADMAP).

## [0.4.0] - 2026-05-24

### Added

- **Session modes.** Two ways to run a session, chosen with a **Mode** toggle:
  **Open** (drift forever, sculpt at will — the prior behavior) and **Arc** (a
  fixed-duration session that scripts the parameters along a preset envelope and
  automates itself to completion).
- **Session state machine** in the orchestrator:
  `idle → starting → running-open | running-arc → stopping → idle`, with a
  subscribe API for React and clean abort from any state. `stopping` is the home
  for the fade-out; an arc's last 4 seconds fade master to 0 (`RETURNING`).
- **`ArcRunner`** (`src/session/ArcRunner.ts`): a pure driver that resolves an
  arc's targets at construction and computes the live parameter values for any
  elapsed time. Arc progress rides on `AudioContext.currentTime`, not wall
  clocks, so long sessions (20+ min) stay accurate.
- **Three preset arcs** (`src/session/arcs.ts`): **Bell Curve** (open, deepen,
  return), **Dawn** (sparse→open), **Dusk** (open→closing). Targets are
  multipliers on the user's starting values; `restoreStart` eases back to the
  captured pose; `min`/`max` resolve to a param's bound.
- **Arc UI**: preset picker (cards), duration slider (3–60 min, default 10), a
  `Begin · MM:SS` button label, a progress bar with segment markers across the
  visualizer, a `MM:SS LEFT` readout, and locked (read-only, live-updating)
  sculpt + engine controls during an arc.
- **URL schema v3**: adds `m=<open|arc>` and, for arcs, `arc=<id>&dur=<sec>`.
  v1/v2 links load as `mode=open`; unknown arc ids fall back to open with a
  notice; out-of-range durations are clamped.
- Store gains `sessionMode` / `arcId` / `arcDurationSec`; the `useAudioEngine`
  hook is superseded by `useSession`.

### Notes

- Both shipped engines lock density while playing, so the `density` target in
  Dawn/Dusk is dropped (with a console warning and an inline `density held`
  note); those arcs sweep brightness + spread. Density motion arrives with an
  unlocked engine.

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

[0.5.0]: https://github.com/akarlin3/annealMusic/releases/tag/v0.5.0
[0.4.0]: https://github.com/akarlin3/annealMusic/releases/tag/v0.4.0
[0.3.0]: https://github.com/akarlin3/annealMusic/releases/tag/v0.3.0
[0.2.0]: https://github.com/akarlin3/annealMusic/releases/tag/v0.2.0
[0.1.0]: https://github.com/akarlin3/annealMusic/releases/tag/v0.1.0
