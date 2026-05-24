# AnnealMusic Roadmap

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
| v0.8    | Public gallery                                     | Community surface                          |
| v0.9    | Granular engine                                    | Third synthesis engine                     |
| v1.0    | Physical modeling + embed route + recording export | Feature-complete v1                        |

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

## Principles

- Each version is one Claude Code prompt cycle.
- Each version ships behind a feature flag or as its own module; no version blocks the previous from being used.
- The engine-swap abstraction (v0.3) is the key architectural unlock — subsequent engines slot into the same interface.
- Backend (v0.7) is deferred as long as possible; everything before is pure client-side.
- Cross-browser Web Audio behavior is verified per version; Safari caveats logged in `docs/COMPAT.md`.

## Post-v1.0 candidates (not committed)

- WebGL / shader visualization upgrade
- Android shell (Capacitor or PrismTask-style native Kotlin)
- MIDI input
- DAW export (stems)
- Collaborative sessions (two users sculpting one field)
- AI-assisted patch generation
