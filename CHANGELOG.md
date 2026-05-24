# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-24

The v1.0 release. Completes the roadmap (v0.1 → v1.0): a physics-driven ambient
sandbox with four synthesis engines, live input + a granular loop pedal, session
arcs, anonymous persistence, a public gallery with server-rendered previews, and
now recording export and an embeddable player.

### Added

- **Physical modeling engine** (4th engine, `e=physical`). Three continuously
  excited sub-models selected by `ph.model`: **string** (Karplus-Strong with a
  filtered-noise sustain extension), **tube** (cylindrical digital waveguide with
  a Smith-style reed), and **plate** (a ~20-mode bandpass modal bank). Per-partial
  AudioWorklet processors over the harmonic lattice; the DSP is pure TypeScript
  (single source of truth, unit-tested) bundled into one self-contained worklet
  script. Params: `ph.excitationLevel`, `ph.damping`, `ph.brightness`, `ph.reed`,
  `ph.inharm`. Platforms without AudioWorklet refuse the swap with a toast (never
  a silent failure). See `docs/MODELS.md`.
- **Recording export.** Realtime session capture (tapped post-fx, so it includes
  engine + input + loops) to **Opus** (MediaRecorder) or lossless **WAV** (PCM
  worklet), capped at 60 min with a 50-min warning. Client-side **offline render**
  of a saved patch via `OfflineAudioContext`, reusing the real engine DSP, drift
  math, ArcRunner, and IR. A **My Recordings** drawer (inline play, download,
  delete, share) and a public `/r/<slug>` player. Backend gains a real multipart
  upload pipeline, recording short slugs, and gated public access, against the
  existing v0.7 quota. See `docs/RECORDING.md`.
- **Embed route.** A tiny (~1.6 KB gz), React-free `/embed/<slug>` player that
  streams a public patch's preview audio — play/pause, scrub, title, wordmark —
  with dark/light themes. Served as a separate Vite entry; the embed surface is
  the only one allowed to be iframed (`frame-ancestors *`) while every other route
  stays `X-Frame-Options: DENY`. "Get embed code" affordances on gallery and My
  Patches cards. A CI gate enforces the < 50 KB budget. See `docs/EMBED.md`.

### Changed

- **URL schema v6**: adds `e=physical` and the `ph.*` engine namespace.
  Backward-compatible — v1–v5 links still decode.
- Security headers are now route-aware (embed exemption); `firebase.json` mirrors
  the policy for static hosting.

### Docs

- New: `docs/MODELS.md`, `docs/RECORDING.md`, `docs/EMBED.md`,
  `docs/RETROSPECTIVE.md`, `docs/v1.0-PLAN.md`.

## [0.9.0] - 2026-05-24

### Added

- **Granular engine.** A third selectable synthesis engine: granular synthesis
  from a curated source bank. N grain clouds over the harmonic lattice (one per
  partial), each reading the same source buffer; the partial's pitch sets the
  grain playback rate (cents relative to the source's reference pitch), and the
  drift loop's per-partial detune rides on top via the same `setPartialDetune`
  path as sine/FM. Per-bank grain params: **Grain** size (30–300 ms), **Density**
  (4–40 grains/s per partial), **Jitter** (position 0–1), **Pitch Jit** (0–100¢),
  **Center** (0–1) — which also drifts autonomously so static patches keep moving.
  A soft live-grain ceiling degrades gracefully under extreme settings.
- **`GrainCloud` core (`src/audio/granular/`).** The v0.6 loop-freeze granular
  code was refactored into a reusable, policy-free core (look-ahead scheduler +
  Hann window math moved here too), consumed by **both** the loop freeze and the
  new engine — one granular implementation, two consumers. The v0.6
  `GranularPlayer` is now a thin wrapper; freeze behavior is unchanged.
- **Curated source bank.** 8 ambient sources (glass pad, bowed metal, tape organ,
  pine wind, deep drone, choir air, rain glass, warm tape), all **original works
  released CC0**, synthesized deterministically by `scripts/gen-sources.ts` and
  shipped as ~3 MB of Ogg/Opus (~96 kbps) in `public/sources/`. A typed,
  append-only registry (`src/audio/sources/registry.ts`) + a lazy fetch/decode
  loader with per-session caching and graceful failure. `LICENSES.md` +
  `docs/SOURCES.md` record per-source licensing; a test enforces a license on
  every source.
- **Source picker UI.** A card-grid picker (ARIA radiogroup) with a per-source
  icon, a hover/focus license + description footer, and a loading spinner while a
  freshly-selected source decodes during playback.
- **URL schema v5.** `e=granular` plus `gr.source` (a stable source **index**),
  `gr.size`, `gr.density`, `gr.posJitter`, `gr.pitchJitter`, `gr.posCenter`.
  Granular params serialize under a short per-engine URL namespace (`gr`), while
  the engine id stays `granular`. Schemas v1–v4 still load unchanged.

### Changed

- **Per-engine crossfade window.** Engines may advertise a preferred crossfade
  duration via a new optional `crossfadeMs` capability; the orchestrator uses it
  for the incoming engine. Granular requests 800 ms (to mask grain start-up
  jitter); sine/FM keep the 600 ms default.
- **Schema manifest + validator.** `engines` is keyed by URL namespace (so `gr.*`
  validates), and the `e=` selector is validated against `engineOrder` (so
  `e=granular` is accepted while its params live under `gr`). Server-side preview
  rendering is unchanged — Option B (headless Chromium) fetches sources
  same-origin, so granular previews render with the exact client DSP.

## [0.8.0] - 2026-05-24

### Added

- **Public gallery (`/gallery`).** A browsable, deep-linkable page of
  `visibility: public` patches — the first surface where other users' content
  renders in the app. Anonymous browsing works fully; saving/publishing still uses
  the v0.7 anon-ID flow. Responsive card grid, sort (newest / oldest /
  most-loaded), filters (engine, mode, has-captures), debounced full-text search,
  and explicit "Load more" keyset pagination (stable under inserts).
- **`GET /api/v1/gallery`.** Sort/filter/search over public patches with
  `(published_at, id)` / `(load_count, …)` keyset cursors bound to their sort
  mode. Postgres `tsvector` search (title weighted over description) with a
  portable `LIKE` fallback for the SQLite test DB. `Cache-Control: max-age=30,
stale-while-revalidate=60`.
- **Server-side preview rendering.** A short (20 s) Opus audio thumbnail is
  rendered when a patch is published, by driving the **real** engine in **headless
  Chromium** (Option B) — Chromium is the production runtime, so previews use the
  exact client DSP with no parity risk. An in-process `asyncio` queue with bounded
  concurrency (2) and retries renders asynchronously; the card shows a "preview
  rendering" placeholder until ready. `GET /patches/:id/preview` 302s to the
  immutable Opus (`max-age=31536000`), 202s while rendering, 503s on failure.
  Previews are write-once (state is immutable).
- **Card visualizer art.** Each card shows a deterministic, static single frame of
  the visualizer geometry derived from the patch params (same param → same image),
  reusing the in-app `drawFrame` — doubles as the fallback when a preview hasn't
  rendered.
- **Load counts.** "Load into app" increments `load_count` (rate-limited per
  IP+patch; over-limit is a silent no-op so loading is never blocked).
- **Moderation.** Publish-time auto-screening of title/description against a static
  banned-word list (env-extensible via `MODERATION_EXTRA_TERMS`) + spam heuristics;
  a rejected publish returns `422 content_rejected` and does not publish. A public
  **report flow** (`POST /reports`, card `…` → Report) flags patches for review.
- **Minimal admin (`/admin`).** Key-gated (`x-admin-key`/`ADMIN_KEY`, stored in
  sessionStorage) view of open reports with dismiss / uphold; uphold sets a patch
  to `flagged`, hiding it from the gallery and short links (`403 under_review`)
  within the gallery cache TTL.
- **Routing.** Introduced `react-router-dom`: `/` and `/p/:slug` (sandbox),
  `/gallery`, `/admin`. A subtle "Gallery" link in the app header.

### Changed

- `patches` gains `preview_status`/`preview_storage_key`/`preview_duration_ms`,
  `load_count`, `published_at`, and derived `engine`/`mode`/`has_captures` filter
  columns (set at insert; state is immutable). `visibility` admits `'flagged'`.
  New `reports` table. Migration `0002_gallery` backfills existing public patches.
- API Docker image bundles headless Chromium + ffmpeg for preview rendering.

### Deferred

- Comments / likes / follows / profiles, algorithmic feeds, collections,
  staff-picks, public OG share images, semantic search, and any third-party
  moderation service — see `docs/ROADMAP.md`.

## [0.7.0] - 2026-05-24

### Added

- **Backend service (`api/`).** A FastAPI + PostgreSQL + S3-compatible service
  that persists user content: **patches** (the full encoded URL state + optional
  title/description), **captures** (loop-pedal audio buffers), and **recordings**
  (schema + endpoints only; the export pipeline is v1.0). Anonymous-first
  identity — every browser gets a stable `anonId` (UUID) on first save; no login.
  The existing client keeps working fully with the backend offline.
- **Anonymous identity.** `x-anon-id` header is authoritative on every
  authenticated request; a missing header mints a UUID (echoed back via header +
  a soft-recovery cookie). `localStorage['am_anon_id']` is the client home.
- **Patches CRUD + short links.** `POST/GET/PATCH/DELETE /api/v1/patches`; every
  patch is minted a `short_slug` and is reachable at `/p/<slug>`. `state` is
  immutable (a new state is a new patch); PATCH only edits metadata/visibility.
  Patches default to `unlisted` (link-only); `public` opt-in feeds the v0.8
  gallery. Deletion is real deletion.
- **Single-source-of-truth validation.** The URL schema lives once, in
  TypeScript. `schema/gen-manifest.ts` compiles it to `schema/manifest.v4.json`,
  which the server validates patch payloads against (strictly — reject, not
  clamp, unlike the lenient client decoder). A CI contract test fails on drift.
- **Captures.** `POST /api/v1/captures` (multipart WAV upload → server transcode
  to Opus via ffmpeg → object storage), `GET` (302 to a presigned URL), `DELETE`.
  Patches reference captures by id with server-side **ref-counting**; orphaned
  captures (`ref_count = 0`, older than 24 h) are swept on a schedule. Saving a
  patch defaults to **params-only**; "include captures" is an explicit opt-in.
- **Rate limits + quotas.** Per-anonId hourly limits (60 patches, 20 captures,
  5 recordings, 600 GETs) with a stricter per-IP fallback; quotas (100 patches,
  50 captures, 10 recordings, 1 GB) returning typed `409`/`413`, rate limits
  `429`.
- **Client integration (`src/api/`).** Typed API client, anonId manager, and a
  WAV encoder, plus a **Save** dialog (title / description / visibility /
  include-captures) and a **My Patches** drawer beside Copy Link. **Copy Link**
  stays the offline-capable inline `#s=` URL; **Save** mints a server short link.
  `/p/<slug>` resolves a saved patch, re-hydrating loop slots (incl. frozen, with
  remembered grain params) from their captures.
- **Migrations, Docker, CI, docs.** Alembic from day one; `docker compose up`
  brings up Postgres + MinIO + API + web with hot reload; `.github/workflows/api.yml`
  runs pyright + pytest, applies migrations against a real Postgres, guards
  against schema drift, and verifies `/readyz` post-deploy. New `docs/API.md` and
  `docs/DEPLOY.md`.

### Notes

- The audio engine code is unchanged in v0.7 — this slice adds a parallel
  backend. New, additive client primitives only: `LoopSlot.loadBuffer`,
  `Orchestrator.decodeAudio` / `loadLoopBuffer`, and a recognized runtime-only
  `cap` loop flag (save links carry it; buffers are never in the URL).
- The web app stays on Firebase Hosting; only the API runs on Railway. Object
  storage is Cloudflare R2 (zero egress, S3 API) — rationale in `docs/v0.7-PLAN.md`.

## [0.6.0] - 2026-05-24

### Added

- **Loop pedal.** Three independent loop slots (A / B / C) capture the live
  input, play it back seamlessly, layer it, and **freeze** it into an endless
  granular drone. Slots are ambient (no tempo/quantization) and sum into the
  same post-fx as the engines + input.
- **`src/loop/` module**:
  - **`LoopSlot`** — per-slot state machine
    (`empty → armed → capturing → playing → frozen | muted → empty`), routing a
    captured buffer through a per-slot mute gain into a shared loop bus, with a
    post-mute analyser for the meter + visualizer.
  - **Capture** (`capture.ts`) — lossless PCM into an `AudioBuffer` via an
    `AudioWorklet` (Blob-URL module; streams blocks to the main thread). Taps
    the input's post-processing point (independent of the monitor gate), arms
    and starts on first sound, and auto-stops at the 60-second cap. Sub-250 ms
    captures are discarded.
  - **`SeamLoopPlayer`** — seamless looping via two alternating
    `AudioBufferSourceNode`s with an equal-power crossfade at the seam
    (`min(120 ms, len × 0.15)`); playback rate fixed at 1.0.
  - **`GranularPlayer`** — freeze engine: Hann-windowed grains scheduled
    `currentTime`-accurately via a look-ahead loop (`scheduler.ts`), from
    wandering positions around a slow-scanning center. Per-slot **grain size /
    density / position-jitter / pitch-jitter**, plus an optional
    **drift-coupled** mode (mean drift widens grain wander).
  - **`windows.ts`** — single home for the Hann + equal-power curves (referenced,
    never redefined).
- **Loop pedal UI** (`LoopPedal`, `LoopSlotCard`, `WaveformThumbnail`): three
  compact warm-dark slot tiles with state-keyed amber glow, a captured-buffer
  waveform thumbnail, a per-slot level meter, freeze / mute / clear affordances,
  and inline grain sliders when frozen.
- **First-class hotkeys**: `1`/`2`/`3` drive the context-aware primary action
  for slots A/B/C; `Shift+1/2/3` toggle freeze. Ignored while a form control is
  focused or a non-Shift modifier is held; a `?` legend documents them in-app.
- **Visualizer loop rings**: each playing/frozen slot adds a subtle orbital arc
  at a distinct radius + hue (frozen draws a fuller, brighter ring).
- **Drift fan-out**: the orchestrator's mean-drift loop now also feeds the loop
  slots (normalized), so drift-coupled frozen slots breathe on the same field.

### Changed

- **URL schema → v4**: per-slot loop config (`L<id>.m/f/c` flags + frozen-slot
  grain params `L<id>.gs/gd/gp/gx`) rides along in share links. Buffer audio is
  never encoded. v1–v3 links still decode (loop keys ignored before v4); a v4
  link with frozen slots but no buffers loads the slots empty with the config
  remembered for the next capture.
- **`InputVoice`** gains a stable **capture tap** (`getCaptureTap()`) off the
  drift filter — post-processing, independent of the monitor gate — so loops
  capture the processed voice whether or not monitoring is on.
- The orchestrator keeps the audio core alive while any loop is active (like a
  connected input), so loops survive Settle / engine swaps / arc end.

### Notes

- Loop capture requires **`AudioWorklet`** (all evergreen browsers; see
  `COMPAT.md`). Three 60 s stereo buffers cap at ~70 MB — fine on desktop; a
  low-`deviceMemory` hint logs a console warning rather than crashing.
- Deferred (per roadmap): pitch-shift / reverse playback, >3 slots,
  tempo-quantized loops (never), slot chaining, buffer-level URL sharing
  (v0.7 backend), and capture-to-file export (v1.0).

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
