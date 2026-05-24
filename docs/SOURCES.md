# Granular source bank (v0.9)

The granular engine reads from a small curated bank of source buffers. In v0.9
all sources are **original works, synthesized algorithmically** and released
**CC0** — see `LICENSES.md`. User-uploaded sources are deferred (v1.0+).

## Why synthesized?

It is the only path that is fully self-contained (no third-party downloads to
vet), reproducible (a committed deterministic generator), legally clean (no
attribution risk), and small (~3 MB for the whole bank). It also fits the app's
identity — AnnealMusic is a synthesis instrument. The registry's `license` field
is freeform, so licensed/recorded sources can be added later without code change.

## Regenerating the assets

```sh
# Requires ffmpeg with libopus on PATH (or set FFMPEG=/path/to/ffmpeg).
npm run gen:sources
```

`scripts/gen-sources.ts` synthesizes each source from a seeded PRNG (so output is
identical run to run), writes a temporary 16-bit mono WAV, and encodes Ogg/Opus
at ~96 kbps into `public/sources/<id>.opus`. `ffmpeg-static` is intentionally not
a package dependency (its postinstall binary fetch would break `npm ci` under
restricted CI network policies); install ffmpeg yourself for regeneration.

## The sources

| index | id         | label       | description                                            | fundamental | duration |
| ----- | ---------- | ----------- | ------------------------------------------------------ | ----------- | -------- |
| 0     | glasspad   | Glass Pad   | Slow-attack additive glass chord, shimmering harmonics | 110 Hz      | 28 s     |
| 1     | bowedmetal | Bowed Metal | Inharmonic bowed-bowl sustain with beating partials    | —           | 26 s     |
| 2     | tapeorgan  | Tape Organ  | Tape-saturated organ stack with slow wow/flutter       | 82 Hz       | 28 s     |
| 3     | pinewind   | Pine Wind   | Filtered-noise wind through pine needles, gusting      | —           | 30 s     |
| 4     | deepdrone  | Deep Drone  | Low sine/triangle drone with slow detuned beating      | 55 Hz       | 30 s     |
| 5     | choirair   | Choir Air   | Formant-filtered noise, a breathy vocal-pad texture    | 147 Hz      | 26 s     |
| 6     | rainglass  | Rain Glass  | Sparse decaying raindrops on glass, transient field    | —           | 28 s     |
| 7     | warmtape   | Warm Tape   | Pink-noise hiss and low hum, a blank-tape ambience bed | —           | 26 s     |

`index` is the stable share-URL identifier (`gr.source=<index>`, schema v5). The
registry is **append-only**: never reorder or remove an entry, or existing share
links would resolve to a different source. Tagged `fundamental` sources align to
musical pitch; untagged textures play their lowest partial at native rate.
