# Anneal Ambiance Roadmap

## End-state vision (v1.0)

A generative ambient meditation sandbox where physics-driven sound design meets active sculpting. Four selectable synthesis engines, two session modes, live instrument integration, and a full sharing surface.

### Four dimensions

**Synthesis engines (selectable)**
- Sine bank with coupled oscillators (v0.1, current prototype)
- FM / AM
- Granular (sample-driven)
- Physical modeling (string, tube, plate)

**Session modes**
- Open jam: press play, drift forever
- Arc: scripted envelopes over a fixed duration (settle → deepen → return)

**Instrument integration**
- Live mic / line-in processed as another voice in the texture
- Loop pedal: capture, layer, freeze (granular freeze on captured buffers)

**Sharing surface**
- URL state (params encoded in URL)
- Public gallery of patches / recordings
- Embedded player (iframe, Bandcamp-like)
- Recording export (MediaRecorder or render-to-buffer)

## Sequencing

| Version | Slice                                              | What it unlocks                            |
|---------|----------------------------------------------------|---------------------------------------------|
| v0.1    | Project init + prototype port                      | Foundation                                 |
| v0.2 ✅ | URL state sharing                                  | First shareable artifact                   |
| v0.3 ✅ | FM engine as second selectable                     | Engine-swap abstraction (architectural)    |
| v0.4 ✅ | Arc mode (timer + scripted envelopes)              | Session-state machine                      |
| v0.5 ✅ | Mic input (live processed)                         | Instrument integration begins              |
| v0.6 ✅ | Loop pedal (capture / replay / freeze)             | Full instrument integration                |
| v0.7 ✅ | Backend + persistence (patches table, anon IDs)    | Unlocks gallery + recordings               |
| v0.8 ✅ | Public gallery                                     | Community surface                          |
| v0.9 ✅ | Granular engine                                    | Third synthesis engine                     |
| v1.0 ✅ | Physical modeling + embed route + recording export | Feature-complete v1                        |
| v1.2 ✅ | User-uploaded granular sources + TrimDialog       | Custom sound uploads                       |
| v1.3 ✅ | Identity (Magic-Link, OAuth, Profiles, Claiming)   | Multi-device account sync                  |
| v1.4 ✅ | Mobile Shell (Capacitor packaging, iOS + Android) | Installable native store apps              |
| v1.5 ✅ | DAW Export / Stems                                 | Export high-fidelity multitrack stem ZIPs |
| v1.6 ✅ | MIDI Input + Output                                | Physical controller map, note-to-root, output CC & clock sync |
| v1.8 ✅ | Collaborative Sessions                             | Real-time co-creation (Jam Mode), dual WebRTC + WebSocket fallback, loop capture sharing, co-author patch saves |
| v4.3 ✅ | Bells & Punctuation                                | Curated high-fidelity bell assets, concurrent scheduler, interactive schedule editor panel, progress timeline markers, standalone breathing meditation timer, schema v19 JSONB migration |
| v4.4 ✅ | Breath Pacing Visuals                              | Optional silent visual breath overlay (Listening Sessions, Drone, Timer), four built-in patterns + bounded custom, pure audio-clock `BreathController`, honest framing per pattern, `prefers-reduced-motion` fade, optional mobile haptics, schema v20 |
| v4.5 ✅ | Session History + Curated Library                  | Private per-account practice history (`/me/sessions`, cross-device, optional reflections, deliberately understated stats, fully deletable) and a curated editorial library (`/listen`) browsable by length/intention/audio-character with editor's picks, previews, and admin curation; calm-by-design CI gate; Alembic migration `0015`, no URL schema bump |
| v4.6 ✅ | Health Integrations & Accessibility Closeout        | Apple Health & Google Health Connect mindful minutes logging, comprehensive semantic HTML accessibility (a11y) audit & remediation on listening surface, and v4 retrospective |
| v5.0 ✅ | Research Surface Foundation                        | Standalone `/research` route, decoupled assets bundle (`dist-research/`), BroadcastChannel-backed transport, transport-agnostic JSON-RPC 2.0 bridge server & client, and real-time console with Telemetry RPC logs + FFT Canvas visualizer |
| v5.1 ✅ | Bidirectional Open Sound Control (OSC)             | Full OSC namespace state broadcasts & control actions, zero-dependency bridge helper tool, native Capacitor mobile plugins, and premium configurations/traffic monitoring panel inside /research |
| v5.2 ✅ | Headless CLI + Batch Render                        | Standalone CLI (`annealmusic`), pure-Node offline audio context engine, Chromium Playwright rendering backend, linear and Cartesian parameter sweeps, stems export, piece & listening session offline rendering, concurrency & resume pools, and Slurm cluster support |
| v5.3 ✅ | Session Datalogging                                | Record runtime states (sculpt parameters, drift variables, partial frequencies, amplitudes, and real-time audio features like RMS, centroid, flux, ZCR) to CSV, JSONL, HDF5, and Parquet at configurable rates, premium UI panel under `/research`, bidirectional OSC log capture, and Pyodide preview JSON-RPC bridge methods. |
| v5.4 ✅ | Pyodide Foundation + Script Sandbox                 | Load Pyodide into `/research` Web Worker, custom `anneal` Python module API, CodeMirror 6 Python script editor + persistent REPL prompt, dynamic initial/live cache synchronization, and backend user scripts CRUD endpoints with Alembic migrations. |
| v5.5 ✅ | Scientific Python Integration                      | Curated Scientific Python package whitelist (`scipy`, `pandas`, `matplotlib`, `sklearn`), Magic AST-scan auto-import loader, Web Worker Agg-PNG plot rendering bridge, multi-figure tabbed plot UI, flat `session_log` / async `stream_log` / async `sweep` coroutines, and virtual file browser MEMFS panel. |
| v5.6 ✅ | Perceptual Experiment Framework                    | Programmatically define stimulus sets and blocks in Python, deploy clinical-aesthetic runner, counterbalance with Williams Latin Square rows, collect 30Hz continuous parameters, and export IRB-compliant ZIP archives. |
| v5.7 ✅ | Research Arc Closeout                              | Complete API reference docs-site (VitePress), Cookbook (16 persona recipes), dynamic academic citation prints (CLI + Pyodide), automated CI notebook cell-verifiers, SemVer stability matrices, and v5 retrospective |
| v6.0 ✅ | Lesson Foundation                                  | Stand up the education surface: the `/learn` route with its own bundle, lesson + track + step data model, lesson player UI, same-origin iframe integration, postMessage transport, parameter sandbox constraints, temporary glows, and 3 pre-seeded lessons. |
| v6.1 ✅ | LLM Lesson Generation                              | Generate lesson content from authored specs: per-step LLM pipeline (text/demo/prompt/reflection + SVG/mermaid diagrams) reusing the v1.7 LLM infra, allowlist SVG sanitizer, mermaid linter, schema-valid demo patches, immutable per-step caching in `ai_generations`, manual per-step override, monthly budget ceiling, and an admin generation console at `/learn#admin`. |
| v6.2 ✅ | Audio Clip Library                                 | A curated library of 49 short audio examples (engine archetypes, physical sub-models, FM ratios, granular/wavetable textures, composition shapes, ambient-history homages, production demos, psychoacoustic phenomena) referenced by lessons via a new `audio-clip` step type; `audio_clips` model + embeddings, public metadata/streaming + admin CRUD/search, a shared embedding+tag+affinity retrieval used by both admin search and the LLM pipeline, engine audio-context pause during playback, an admin clip manager, and a CI license gate. |
| v6.3 ✅ | Progress Tracking + Next-Lesson Picker             | Private, cross-device per-lesson progress (`not_started`/`in_progress`/`completed`, with `abandoned` *computed* not stored) with pause/resume of step + scroll position; `lesson_progress` model (migration `0021`) and a single source-of-truth `progress_state` service; anon progress stays in localStorage and is migrated once on first sign-in via an idempotent max-merge import. A two-stage next-lesson picker (deterministic candidate filter → Haiku 4.5 ranking, 5-minute TTL cache, deterministic fallback) surfaces 1–3 calm "why this next" cards after a completion or on `/learn` arrival, plus an onboarding picker for new users. Reflection text is never sent to the LLM; the calm-by-design CI gate now scans `src/learn`. |
| v6.4 ✅ | Curriculum Content                                 | The actual curriculum: **five tracks, 55 lessons** authored as specs across synthesis fundamentals, composition technique, ambient history & listening, production/DAW, and music+science crossover (`api/app/services/curriculum_content.py`), with a prerequisite **DAG** rooted at `synthesis-fundamentals/intro` (migrations `0022`/`0023`). New authoring tooling in the `#admin` console: an LLM-assisted **spec generator**, **batch generation**, a **review dashboard**, a **prerequisite-graph editor** (cycles rejected server-side), and a pure **quality-check pipeline** (step coverage, clip existence, demo/SVG validity, word-count, DAG, spec integrity, framing compliance, difficulty monotonicity) — heuristics defined once and shared. An honest-framing lexicon (`framing_lexicon.py`) guards 432/solfeggio-style topics. Discoverability: search-by-topic, track/difficulty filters, a "Start here" onboarding banner, and per-lesson prerequisite hints in the curriculum browser. See [docs/CURRICULUM.md](CURRICULUM.md). |
| v6.5 ✅ | **v6 Closeout** — Analytics + Discoverability + Release | **Closes the v6 education arc.** Admin-only, aggregate **lesson analytics** (per-lesson views/completion/avg-time, step **drop-off curve**, per-step time, prompt tried/skip, reflection rate; per-track completion + **path popularity**; per-clip play/replay/skip; CSV export) computed portably from `lesson_progress` (`api/app/services/analytics.py`, routes under `/api/v1/admin/analytics/*`), with a Postgres `lesson_analytics` materialized view (migration `0024`) as the prod/BI rollup. The player additively emits `clip_play`/`clip_replay`/`prompt_tried`/`prompt_skipped` signals. **In-app discoverability** via one understated, opt-out primitive (`LessonHintLink`) on the engine selector, mode toggle, and a dismissable first-time banner, with a global "Show learning hints" setting and a single source-of-truth hint map. No per-user analytics, ever. See [docs/V6_RETROSPECTIVE.md](V6_RETROSPECTIVE.md). **The v6 education arc is complete.** |
| v7.0 ✅ | **Research Collaboration Foundation** — Studies | **Opens the v7 research-collaboration arc.** The multi-investigator **Study** model: a versioned, citable bundle of investigators + linked resources (stimuli/protocols/data/analysis) with roles (`pi`/`co-investigator`/`analyst`/`viewer`), a strict permission matrix behind one `require_study_role` helper, and full provenance to an immutable `study_audit_log` via a single write-path. **Immutable snapshots** freeze the study + resolved resource metadata + content hashes (no binary payloads); **per-study Zenodo DOIs** (concept + version) mint on publish behind a pre-flight checklist, with a robust retrying HTTP client defaulting to the sandbox + an offline stub. **BibTeX/APA/Chicago** citations server-side; **ORCID + ROR** on accounts. New tables (migration `0025`), `src/studies/` UI as a research-console tab. Anonymous-first preserved (public studies browsable + citable; private studies 404 to strangers). See [docs/STUDIES.md](STUDIES.md), [docs/CITATION.md](CITATION.md), [docs/v7.0-PLAN.md](v7.0-PLAN.md). |
| v7.2 ✅ | **Clinical Stimulus-Grade Audio**                  | Precisely calibrated SPL levels target, Williams Latin Square cryptographic balanced randomization, sub-millisecond scheduled onset triggers and timing reports, IRB withdraw dispose policy, adverse event capture, stimulus SHA-256 integrity checks, and Outfit/Inter quiet minimal glassmorphism UI console. See [docs/CLINICAL_DEFAULTS.md](CLINICAL_DEFAULTS.md) and [docs/CLINICAL_TIMING.md](CLINICAL_TIMING.md). |
| v7.3 ✅ | **Sonification Library & Recipes**                 | Curated catalog of 20 canonical sonification mappings across 4 families (Time Series, Scalar Fields, Networks, Structured Events), dynamic min/max auto-calibration to safe synthesizer param bounds, interactive dashboard on the research console with custom data uploads, and compiled handbook `docs/SONIFICATION_RECIPES.md`. |
| v7.4 ✅ | **Biofeedback Ingest**                             | Unified biosignal adapters (Polar H10/Verity, OpenBCI Cyton, Muse 2, Empatica), dynamic `'live-biosignal'` sonification parameter modulations, participant opt-in consent checkboxes (GDPR), baseline calibration wizard, Parquet telemetry stream uploads, GDPR cascade data shredding, and native iOS Swift/Android Kotlin BLE GATT bridge plugins with integrated virtual simulators. |
| v7.5 ✅ | **Clinical Study Export & Reproducibility**        | Fully reproducible study export bundles (.zip) with version locks, stimuli parameters, custom protocols, anonymized telemetry with Laplace Differential Privacy, analysis scripts, and calibration hashes; auditor interface at `/reproduce` with schema check, silent batch stimulus re-render verification, CPython sandboxed script runs, and developer Node CLI. See [docs/STUDY_EXPORT.md](STUDY_EXPORT.md) and [docs/REPRODUCIBILITY.md](REPRODUCIBILITY.md). |
| v7.6 ✅ | **Scientific Communication Tools**                | Headless Playwright canvas streams and non-blocking FFmpeg H.264/AAC MP4 video transcoding, client browser recorders, < 30 KB gzipped academic iframe player `/embed-figure` with canvas waveforms, ARIA transcript layers, citation sidecars, presenter slide layouts `/talk` with pre-cached audio backups, social outreach cards, and secure PI accessibility editors. |



## Shipped notes

- **v0.2** — URL state sharing landed with schema version `1`
  (`#s=1:<key=value…>`, human-readable). Volume is intentionally excluded
  (listening preference, not a patch attribute). Deferred per plan: `engine` key
  → v0.3 (schema v2), arc-mode timeline → v0.4, server-side short links → v0.7,
  gallery → v0.8. If a future payload outgrows the readable form (~500 chars),
  switch to base64-of-JSON.
- **v0.3** — engine-swap abstraction (`AnnealEngine` + `Orchestrator`) with the
  sine bank refactored into an engine and **FM** added as the second selectable
  engine. FM ships with modulator self-**feedback** in scope (originally pencilled
  for v0.3.1). Engines hot-swap via an equal-gain ~600ms crossfade. URL **schema
  v2** adds `e=<id>` + namespaced engine params (`fm.*`); v1 links load as sine.
  Deferred per plan: per-partial independent FM ratios and >2-operator stacks (not
  on roadmap), granular → v0.9, physical modeling → v1.0. Two non-breaking engine
  interface extension points noted for those: `loadBuffer` (granular) and
  `excite` (physical).
- **v0.4** — session modes on a new orchestrator **session-state machine**
  (`idle → starting → running-open | running-arc → stopping → idle`). **Arc mode**
  runs a fixed-duration session along a scripted envelope via the pure `ArcRunner`,
  ticked off `AudioContext.currentTime`. Three preset arcs (**Bell Curve**, **Dawn**,
  **Dusk**); targets are multipliers on the user's starting values. URL **schema v3**
  adds `m=<open|arc>` (+ `arc`/`dur`); v1/v2 load as open. Deferred per plan:
  user-defined arcs / timeline editor → post-v1.0; pause/resume → not on roadmap;
  manual override of locked controls → v0.4.1 if requested; per-segment per-engine
  targets and engine switching mid-arc → not on roadmap. Known limit: both current
  engines lock density while playing, so Dawn/Dusk's density target is held until an
  unlocked engine (granular, v0.9) ships.
- **v0.5** — **live instrument input**. A mic / line-in / audio interface routes
  through a per-voice chain (high-pass, gentle compressor, optional soft-clip,
  user level, and a **drift-modulated filter** that tracks the field) into the
  shared post-fx as a sibling of the engine. Opt-in via `getUserMedia` with
  music-friendly constraints (AEC/NS/AGC off); **monitoring muted by default**
  (feedback-safe, headphones messaged); device picker; warm-amber level meter;
  latency estimate; a visualizer input ring; and a feedback guard. The audio
  core (context + post-fx) was decoupled from the session lifecycle so input can
  be live before Begin and survives engine swaps / arc start-stop. Input is a
  runtime/hardware concern — **never in the URL** (no schema bump). Deferred per
  plan: stereo-preserved-through-chain (summed to mono in v0.5), pitch
  detection / harmonization (not on roadmap), sidechain/ducking (not on roadmap),
  built-in tuner (not on roadmap), MIDI (not on roadmap).
- **v0.6** — **loop pedal**. Three independent slots (A/B/C) capture the
  processed live input, loop it seamlessly (equal-power seam crossfade), layer
  it, and **freeze** it into endless granular re-synthesis (`GranularPlayer`,
  `currentTime`-scheduled Hann grains with size/density/jitter + optional
  drift-coupling). Capture is ambient (no tempo): arm, start on first sound,
  auto-stop at 60 s, discard sub-250 ms. First-class hotkeys (`1/2/3`,
  `Shift+1/2/3`); visualizer loop rings. **URL schema v4** carries loop config
  (flags + grain params) but never buffer audio — buffer-level sharing waits for
  the v0.7 backend. Loops survive engine swaps / arc start-stop like input does.
  Deferred per plan: pitch-shift / reverse playback, >3 slots, tempo-quantized
  loops (never), slot chaining/scenes, capture-to-file export (v1.0).
  Completes instrument integration; next is the **backend** (v0.7).
- **v0.7** — **backend + persistence**. A FastAPI + PostgreSQL + S3-compatible
  service (`api/`) persists **patches** (full encoded URL state), **captures**
  (loop audio buffers), and **recordings** (schema + endpoints only; export is
  v1.0). **Anonymous-first**: every browser gets a stable `anonId` carried in the
  `x-anon-id` header (minted server-side when absent); no login. URLs go
  hierarchical — inline `#s=4:` links keep working offline forever, `/p/<slug>`
  short links resolve saved patches via the backend. The **URL schema stays the
  single source of truth**: a generated `schema/manifest.v4.json` (from the TS
  defs) is what the server validates against, with a CI drift guard. Captures are
  opt-in per save (params-only default), uploaded as WAV and transcoded to Opus,
  **ref-counted** with a scheduled orphan sweep. Rate limits + quotas from day
  one; Alembic migrations; `docker compose` local dev (Postgres + MinIO).
  Deviations from the PrismTask template: web stays on **Firebase**, only the API
  runs on **Railway**; object storage is **Cloudflare R2** (zero egress).
  The audio engine code is unchanged — the client still runs fully with the
  backend down. Deferred per plan: real auth + claim-by-email → post-v1.0,
  public gallery surface → v0.8, recording export pipeline + embed → v1.0,
  soft-delete/undo → never. Next is the **public gallery** (v0.8).
- **v0.8** — **public gallery**. A browsable `/gallery` route surfaces
  `visibility: public` patches: responsive card grid, sort (newest / oldest /
  most-loaded), filters (engine / mode / has-captures), debounced Postgres
  full-text search, keyset-cursor "Load more". Each card shows a **deterministic
  static visualizer frame** (reuses `drawFrame`) and a **Preview** button playing a
  short server-rendered **Opus thumbnail**. Previews are rendered **server-side in
  headless Chromium** (Option B) so they use the *exact* client engine + DSP — the
  engine is real-time and timer-driven, so it's played in real time and recorded,
  not offline-synthesized; an in-process `asyncio` queue (concurrency 2, retries)
  renders asynchronously after publish (write-once, since state is immutable).
  **Moderation** is lightweight: publish-time auto-screening (banned-word + spam
  heuristics, env-extensible) and a public **report** flow feeding a minimal
  key-gated `/admin` panel (dismiss / uphold → `flagged`, hidden from gallery +
  short links). **Load counts** increment per IP+patch. New columns on `patches`
  (`preview_*`, `load_count`, `published_at`, derived `engine`/`mode`/
  `has_captures`) + a `reports` table (migration `0002_gallery`); `visibility`
  admits `flagged`. `react-router` introduced for the new routes. Deferred per
  plan: comments / likes / follows / profiles, algorithmic feeds, collections,
  staff-picks, public OG share images, semantic search, third-party moderation
  services → post-v1.0 / never. Next is the **granular engine** (v0.9).
- **v0.9** — **granular engine**, the third selectable synthesis engine, slotting
  into the v0.3 `AnnealEngine` interface. The v0.6 freeze granular code was
  refactored into a reusable **`GrainCloud`** core (look-ahead scheduler + Hann
  windows moved to `src/audio/granular/`), consumed by both the loop freeze and
  the new engine — one implementation, two consumers. The engine runs N clouds
  over the harmonic lattice (one per partial); a partial's pitch maps to the
  cloud's grain playback rate (cents vs. the source's reference pitch), and drift
  detune rides on top via the same `setPartialDetune` path. A curated **bank of 8
  CC0 sources** (synthesized offline by `scripts/gen-sources.ts`, ~3 MB of Opus in
  `public/sources/`) loads lazily on selection. **Schema v5** adds `e=granular` +
  `gr.*` params (under a per-engine URL namespace, so `gr` ≠ the id `granular`);
  v1–v4 still load. Two small, additive interface extensions: per-engine
  `crossfadeMs` (granular asks for 800 ms) and `urlNs`. Server-side preview works
  unchanged (Option B fetches sources same-origin). The abstraction held — the
  only strain was the non-numeric source id, encoded as a stable append-only
  **index** to keep `EngineParams` numeric. Deferred per plan: user-uploaded
  sources, multi-source-per-partial, reverse/spectral grains → v1.0+ / never.
  Next is **physical modeling** (v1.0).
- **v1.0** — the **ship**. Three features completing the vision: (1) the
  **physical modeling engine** (4th engine) with string/tube/plate sub-models,
  per-partial AudioWorklets, pure-TS DSP as the single source of truth, and
  **schema v6** (`ph.*`); (2) **recording export** — realtime capture (Opus/WAV,
  60-min cap) tapped post-fx, client-side offline render via
  `OfflineAudioContext`, a My Recordings drawer, and the `/r/<slug>` player on the
  v0.7 recordings quota; (3) the **embed route** — a ~1.6 KB React-free
  `/embed/<slug>` player streaming v0.8 previews, the only iframe-able surface,
  with a CI-enforced < 50 KB budget. The `AnnealEngine` interface absorbed an
  async-start, worklet-backed engine with only additive changes
  (`setErrorHandler`). Biggest surprise: Vite has no AudioWorklet bundling, so the
  worklet ships as a dedicated self-contained build. See `docs/RETROSPECTIVE.md`.
  **The roadmap as defined is complete.**
- **v1.2** — **User-Uploaded Granular Sources**. Lands high-fidelity custom engine sources (up to 25MB). Implements the HSL-styled **Trim Dialog** (sub-60s bounds downsampling and looping preview). Reuses `ffmpeg` transcoding on the backend to transcode segment uploads into mono Opus (96kbps). Features a **My Sources** panel drawer with slot progress tracking, inline rename, and cascading deletion confirmation prompts.
- **v1.3** — **Identity & Multi-Device Claiming**. Adds real email magic-link and secure Google/GitHub OAuth accounts. Introduces the confirm-only **manual guest claiming flow** enabling cross-device sync of patches, recordings, and custom sources without auto-claiming. Generates premium, on-brand **deterministic Lissajous phase-portrait wave SVGs** for public creator profiles (`/u/:account_id`). Hardens security with rate limits, CSRF-resistant cookies, and email enumeration resistance.
- **v1.4** — **Mobile Shell (Capacitor)**. Packages the existing web application in a native wrapper targeting iOS and Android platforms via Capacitor 6.x. Introduces a global `DeepLinkHandler` supporting seamless magic-link and patch deep routing, native cookie sharing via `CapacitorCookies`, custom `AVAudioSession` and `AudioManager` native focus/interruption shims, and Vite mobile build route tree-shaking for compact release assets.
- **v1.5** — **DAW Export / Stems**. Enables high-fidelity multitrack session stem rendering and ZIP file bundling. Captures raw engine outputs, live mic signals, and loop pedal buffers individually, BWF/iXML metadata injection for sample alignment inside DAWs, seeded determinism for offline rendering parity, memory-conscious sequential rendering contexts, and native mobile Capacitor sharing integrations.
- **v1.6** — **MIDI Input + Output**. Brings native MIDI controller and keyboard integration into the generative ambient meditation sandbox. Exposes interactive settings page under `/midi` for standard fader/knob mappings (using Linear, Exponential, and Logarithmic response curves), monophonic keyboard notes to set root pitch (Sustain vs. Return note-off options), dynamic strike velocity maps, 24 PPQN sync output clock, throttled 60Hz CC outgoing telemetry streams, and elegant browser compatibility warnings for Safari/Capacitor environments.
- **v1.8** — **Collaborative Sessions (Jam Mode)**. Ships real-time co-sculpting capabilities (Jam Mode). Synchronizes sculpt states dynamically using Yjs CRDTs while keeping audio synthesis purely local. Establishes ultra-low latency WebRTC P2P direct data streams and automatically fails over to secure WebSocket signaling relays through FastAPI if NAT traversal fails. Shares captured loops seamlessly as WAV uploads synchronized instantly via CRDT. Includes co-author patch saves, custom Lissajous avatars, interactive remote glow cursors, and robust mobile background-reconnect shims.
- **v4.3** — **Bells & Punctuation**. Synthesizes high-fidelity CC0 bell assets (singing bowls, deep gongs, Zen Rin) mapped to concurrent schedules, featuring a gorgeous interactive timeline editor with bell visual markers and a standalone meditation timer.
- **v4.4** — **Breath Pacing Visuals**. Visual-only silent breathing pace visual overlays Dimming ambient Visualizers dynamically, implementing standard pacing rhythms (Box, 4-7-8, Coherent, Resonance) with dynamic device haptic syncs.
- **v4.5** — **Session History & Library**. Integrates secure mindfulness play records (`/me/sessions`), curated editorial catalog (`/listen`) tagged by intention/length, admin curation tables, and custom Alembic SQLite/Postgres schemas.
- **v4.6** — **Mindful Health & Accessibility**. iOS HealthKit and Android Health Connect logging, a11y focus outline optimizations, minimum target expansions, and prefers-reduced-motion freezing.
- **v5.0** — **Research Console Route**. Sandboxed `/research` workspace served as decoupled assets, coordinating telemetry observations and slider parameter updates using JSON-RPC 2.0 BroadcastChannel shims.
- **v5.1** — **Bidirectional Open Sound Control (OSC)**. Standalone npm bridge (`tools/osc-bridge/`), native iOS Apple Network UDP sockets, datagram Android channels, throttled bandwidth rules, and glassmorphic telemetry OSC configurations panel.
- **v5.2** — **Headless CLI & Batch Render**. Standalone `annealmusic` tool supporting high-performance pure Node and headless Chromium Playwright engines, multi-parameter sweeps (linear ranges & Cartesian expansions), piecewise and session duration calculators, jobs worker queues (`--jobs N`), resume capability, SHA-256 manifest outputs, MSE sample-level parity check, and Slurm job array scripts.
- **v5.3** — **Session Datalogging**. High-performance observability suite recording every state change, partial detail, and audio-analysis feature (RMS, ZCR, spectral centroid, spectral flux, magnitude spectrum) at configurable rates (up to 100Hz, default 50Hz) to scientific formats. Employs a pre-allocated 100MB client-side ring buffer to protect memory. Zero browser bundle bloat is maintained by generating lightweight CSV/JSONL natively in-browser and offloading complex HDF5/Parquet generation to the CLI and a robust Pandas/PyArrow Python converter. Synthesizes deterministic offline rendering datalogs synchronized sample-for-sample. Logs bidirectional OSC network packets, and introduces four Python-programmable JSON-RPC control and real-time streaming bridge methods.
- **v5.4** — **Pyodide Foundation + Script Sandbox**. Sandboxed background Web Worker (`src/research/python/pyodide-worker.js`) running Pyodide `0.26.4` and packaging CPython `3.12`. Re-implements secure network overlays blocking HTTP/Socket/fetch egress. Syncs live parameter store updates at 50Hz over BroadcastChannel so Python-side `state.get()` and `engine.get_spectrum()` run synchronously and instantly. Shipped CodeMirror 6 Python editor with REPL console, examples library, and secure backend `user_scripts` CRUD REST API endpoints.
- **v5.5** — **Scientific Python Integration**. Curated, sandboxed Scientific Python suite loaded from CDN via micropip. Pre-scans scripts to dynamically load whitelisted libraries (`scipy`, `pandas`, `matplotlib`, `sklearn`) with console notifications, and blocks unauthorized imports. Implements headless matplotlib Agg-to-PNG virtual Web Worker rendering and displays figures in a premium tabbed canvas widget. Exposes flat `session_log` DataFrames, real-time async `stream_log` generators, and multi-parameter grid `sweep` utilities. Synthesizes client-side offline audio renders directly from Python, exporting float channel arrays or compiling WAV files written to MEMFS with full download and deletion controls in the workspace.
- **v5.6** — **Perceptual Experiment Framework**. Implemented an in-browser experimentation API (`anneal.experiment`) and a modular, clinical-aesthetic runner UI with strict zero-data-processor IRB compliance. Equips researchers to script stimuli, blocks, and counterbalance designs, deploy 6 interactive response inputs (including 30Hz continuous samplers and reaction times), and export comprehensive ZIP payloads containing manifest metadata, responses CSV, and detailed DSP datalogger JSONL ticks.
- **v5.7** — **Research Arc Closeout**. Consolidated every research-surface API (JSON-RPC Bridge, OSC Address Namespace, CLI Commands, Python whitelisted modules, Datalogger Schema, and Experiment Framework) into a highly navigable, client-side searchable VitePress doc site served at `/research/`. Shipped 16 fully self-contained, working cookbook recipes, programmatic print commands in both the CLI (`annealmusic cite`) and Python sandbox runtime (`anneal.cite()`), dynamic ORCID/ROR/Zenodo metadata configurations, automated headless CI notebook verification, and the v5 engineering retrospective review (`docs/V5_RETROSPECTIVE.md`).
- **v7.5** — **Clinical Study Export & Reproducibility**. Enables clinical and sonification studies to be fully citable and reproducible via unified study export bundles (`.zip`). Packages metadata schema registers, version locks, stimuli parameters, custom research protocols, anonymized participant session records (stripping absolute timestamps, masking participant IDs with UUIDs, and optionally adding Laplace Differential Privacy), calibration hashes, researcher-authored Python scripts, and formatted BibTeX citations. Integrates a premium, highly responsive glassmorphic auditor console at `/reproduce` with sleek micro-animations for zip uploads, schema/hash verification, stimulus wave batch re-rendering and checking (bit-identical, perceptual, and statistical parity), CPython sandboxed script runs in isolated subprocesses, and comprehensive discrepancy reporting. Extends the standalone CLI (`annealmusic`) with `export` and `reproduce` commands and updated zip manifest validation support.
- **v7.6** — **Scientific Communication Tools**. Empowers researchers to publish and disseminate sonifications and listening sessions. Delivers a headless background rendering pipeline utilizing Chromium Playwright to record synchronized canvas visualizer streams and AudioContext buffers into WebM, transcoded via non-blocking asynchronous Python FFmpeg subprocesses into universally citable H.264/AAC MP4 videos with automatic BibTeX reference sidecars. Offers an ultra-lightweight, high-performance `< 30 KB` gzipped Vanilla TypeScript academic iframe widget (`/embed-figure/:slugOrId`) supporting canvas waveforms, playback speed sliders, high-contrast modes, and ARIA screen reader description overlays. Provides a distraction-free Beamer-ready presentation route (`/talk/:slugOrId`) with pre-cached local audio fallbacks, rich social Open Graph outreach card packs, and a secure React-based PIs `AccessibilityEditor` panel workspace.



## Principles

- Each version is one Claude Code prompt cycle.
- Each version ships behind a feature flag or as its own module; no version blocks the previous from being used.
- The engine-swap abstraction (v0.3) is the key architectural unlock — subsequent engines slot into the same interface.
- Backend (v0.7) is deferred as long as possible; everything before is pure client-side.
- Cross-browser Web Audio behavior is verified per version; Safari caveats logged in `docs/COMPAT.md`.

## Post-v1.0 ideas (deferred across the project, not committed)

Consolidated from every "deferred" flag raised v0.1 → v1.0:

- Real auth (email / OAuth / social); claim anon-saved content via auth
- Creator display names + profiles; comments / likes / follows on the gallery
- Featured / staff-picked gallery surface; public preview pages (own URL, OG image)
- Multi-input / multi-track input; MIDI input / output
- DAW export (stems); spectral processing tools; sidechain / ducking
- Collaborative sessions (two users sculpting one field)
- User-uploaded sources for the granular engine; reverse/spectral grains
- More physical models (membrane, bowed string, …); more engines beyond the four
- AI-assisted patch generation; built-in tuner
- WebGL / shader visualization upgrade
- Mobile native shells (Capacitor / native Kotlin)
- Tempo-locked anything (intentionally against the aesthetic)
