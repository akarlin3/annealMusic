# Anneal Ambiance — Retrospective (v1.0)

The roadmap as defined (v0.1 → v1.0) is complete: a physics-driven ambient
sandbox with four synthesis engines, live input + a granular loop pedal, session
arcs, anonymous persistence, a public gallery with server-rendered previews,
recording export, and an embeddable player.

## What went right

- **The engine abstraction held.** `AnnealEngine` (start/stop/output/params/
  detune/partial-frequencies) absorbed a fourth engine whose internals — async
  AudioWorklets, per-partial DSP processors — look nothing like the oscillator
  banks it was designed around. Crossfade, drift, and arc support came for free.
- **Pure-DSP-as-source-of-truth.** Authoring the physical models as plain TS
  classes (then bundling them into the worklet) meant the DSP is unit-tested
  directly in jsdom — no audio device, no flaky integration harness.
- **Injectable seams** (worklet-node factory, capture factory, offline-context
  factory, fetch) kept every new subsystem testable without real browser audio.
- **Reusing v0.8 infra.** Server-side preview rendering (real Chromium) handles
  the physical engine and is the offline-render fallback; the embed leans
  entirely on rendered previews rather than shipping any synthesis.

## What surprised us

- **Vite has no AudioWorklet story.** `new URL('./x.ts', import.meta.url)`
  inlined the _raw, untranspiled_ TypeScript as a `data:` URL — broken at
  runtime. The fix was a dedicated second Vite build producing one
  self-contained classic worklet script. Worth knowing before reaching for
  worklets in any Vite app.
- **Realtime recording format can't be deferred to "stop".** Opus
  (MediaRecorder) and lossless WAV (PCM worklet) are different capture graphs, so
  format is chosen up front — a small deviation from the original "ask on stop"
  sketch, documented in RECORDING.md.
- **The live orchestrator isn't offline-renderable as-is.** Its drift/arc loops
  are wall-clock timers and it calls `AudioContext`-only APIs. Rather than refit
  it, the offline renderer reuses the engine classes + pure drift math + IR on a
  fresh `OfflineAudioContext`, stepping evolution via `suspend()` checkpoints.

## Where the abstraction strained

- Async engine start. Sine/FM start synchronously; granular and physical attach
  audio nodes _after_ an async load. We leaned on the granular precedent
  (synchronous metadata, deferred nodes under cover of the bus fade) and added an
  optional `setErrorHandler` to surface deferred worklet failures. It works, but
  "start is synchronous" is now only true for two of four engines.

## Post-v1.0 priorities

The deferred list (auth, claiming anon content, MIDI, DAW/stem export,
collaborative sessions, user-uploaded granular sources, featured gallery, public
preview pages with OG images, more physical models, comments/likes) is unchanged.
Highest-leverage next steps, in order:

1. **Real auth + claim flow** — unblocks everything social and removes the
   anon-quota ceiling that recordings make more visible.
2. **Creator display names** — the embed already has the slot ("Anonymous"); a
   name makes embeds and the gallery feel authored.
3. **Public preview pages + OG images** — turns every public patch into a
   shareable link that previews nicely, complementing embeds.
4. **Offline-render UX + server fallback wiring** — finish the "Render full arc"
   button end to end with progress and the documented server fallback.
