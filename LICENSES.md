# Third-party & asset licenses

This file is the machine-readable attribution record for shipped assets. Every
granular source in `public/sources/` must appear here with a license. A test
(`src/audio/sources/registry.test.ts`) fails the build if any registry entry is
missing a license string.

## Granular source bank (`public/sources/`)

All v0.9 sources are **original works** synthesized algorithmically by
`scripts/gen-sources.ts` and released into the public domain under
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).
No attribution is required; none of these files contain third-party material.

| id         | file                    | license | attribution                              |
| ---------- | ----------------------- | ------- | ---------------------------------------- |
| glasspad   | sources/glasspad.opus   | CC0-1.0 | Original (synthesized) — Anneal Ambiance |
| bowedmetal | sources/bowedmetal.opus | CC0-1.0 | Original (synthesized) — Anneal Ambiance |
| tapeorgan  | sources/tapeorgan.opus  | CC0-1.0 | Original (synthesized) — Anneal Ambiance |
| pinewind   | sources/pinewind.opus   | CC0-1.0 | Original (synthesized) — Anneal Ambiance |
| deepdrone  | sources/deepdrone.opus  | CC0-1.0 | Original (synthesized) — Anneal Ambiance |
| choirair   | sources/choirair.opus   | CC0-1.0 | Original (synthesized) — Anneal Ambiance |
| rainglass  | sources/rainglass.opus  | CC0-1.0 | Original (synthesized) — Anneal Ambiance |
| warmtape   | sources/warmtape.opus   | CC0-1.0 | Original (synthesized) — Anneal Ambiance |

If a future source is licensed from a third party (e.g. a Freesound CC0/CC-BY
recording), add a row with the exact license and a full attribution line, and
set the `attribution` field on its `SourceDef` in
`src/audio/sources/registry.ts`.
