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
| v0.3    | FM engine as second selectable                     | Engine-swap abstraction (architectural)    |
| v0.4    | Arc mode (timer + scripted envelopes)              | Session-state machine                      |
| v0.5    | Mic input (live processed)                         | Instrument integration begins              |
| v0.6    | Loop pedal (capture / replay / freeze)             | Full instrument integration                |
| v0.7    | Backend + persistence (patches table, anon IDs)    | Unlocks gallery + recordings               |
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
