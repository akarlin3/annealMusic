# Audio Clip Library (v6.2)

A curated library of short audio examples (5–60 s) that lessons reference by
`slug`. Lessons play them through a dedicated **`audio-clip` step type**; the
LLM lesson-generation pipeline can retrieve a relevant clip to anchor a concept
in sound.

- **Source of truth:** `api/data/clip_library.json` (49 clips).
- **Audio:** `public/clips/<slug>.opus` (96 kbps mono), produced by
  `tools/gen_clips.py`. The manifest, not the binaries, is authoritative.
- **Storage convention:** shipped clips set `storage_key = "public:clips/<slug>.opus"`
  and are served as static assets; admin-uploaded clips are stored in object
  storage and streamed via `GET /api/v1/clips/:slug/audio`.

## How it fits together

| Piece                            | Where                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------- |
| Data model (`audio_clips`)       | `api/app/models.py`, migration `0020_v6_2_audio_clips`                            |
| Metadata + audio endpoints       | `api/app/routers/clips.py` (`GET /api/v1/clips/:slug`, `…/audio`)                 |
| Admin upload/edit/archive/search | `api/app/routers/clips.py` (`/api/v1/admin/clips…`)                               |
| Shared retrieval (admin + LLM)   | `api/app/services/clip_retrieval.py` (`search_clips`)                             |
| Embedding                        | `description + concept_tags` via the v1.7 embedding pipeline, at seed/upload time |
| Lesson step                      | `src/learn/stepTypes/AudioClipStep.tsx`, step `type: "audio-clip"`                |
| Engine pause during playback     | bridge `suspendEngine`/`resumeEngine` → `Orchestrator.suspendAudio/resumeAudio`   |
| Admin UI                         | `src/learn/admin/ClipManager.tsx`                                                 |
| License CI gate                  | `tools/check-clip-licenses.mjs`                                                   |

## The `audio-clip` step config

```jsonc
{
  "clip_id": "karplus-archetype", // slug (portable, not a UUID)
  "intro_text": "Listen to a textbook Karplus pluck — bright, percussive, with a clean decay.",
  "outro_text": "Notice the gentle high-frequency roll-off as the delay-line filter softens repeats.",
  "auto_advance": false,
  "loop": false,
}
```

The player shows the intro text, suspends the embedded engine's audio context,
plays the clip (waveform + play/pause/seek/loop), then shows the outro text and
a Continue button (unless `auto_advance`). The engine is resumed on step exit —
only if the player was the one that suspended it.

## LLM clip retrieval

When a lesson spec contains an `audio-clip` step (with a `clip_topic`), the
generator runs `search_clips(query_text=clip_topic, track=…, limit=3)` — a blend
of embedding similarity (0.6), tag intersection (0.3), and track affinity (0.1)
— and the LLM picks one of the three candidates (or declines, preferring no clip
over a weak match) and writes the intro/outro framing.

## Licensing

License attribution is **non-negotiable** — CI (`tools/check-clip-licenses.mjs`)
fails the build if any clip lacks a license, or if a non-`original-by-you` clip
lacks an attribution. License values: `CC0` · `CC-BY` · `original-by-you` ·
`licensed-third-party`.

**Canonical ambient works (Eno, Reich, Stars of the Lid, …) are fully
copyrighted and are _not_ CC-licensed.** v6.2 therefore ships the ambient-history
track as **stylistic homages authored in AnnealMusic** (`original-by-you`), with
descriptions worded _"in the style of …"_ — never reproductions, never claiming
a copyrighted source. Genuinely licensed canonical recordings remain deferred.

### Third-party (non-`original-by-you`) attributions

| slug                        | license | attribution / source                                                                                                                                                             |
| --------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ref-tibetan-bowl-acoustic` | CC0     | Public-domain (CC0) singing-bowl recording from Freesound.org. Replace this placeholder with the chosen recording and paste its exact source URL + uploader here before release. |
| `ref-gong-acoustic`         | CC0     | Public-domain (CC0) gong recording from Freesound.org. Replace this placeholder with the chosen recording and paste its exact source URL + uploader here before release.         |

All other clips are `original-by-you` (authored in AnnealMusic, no third-party
attribution required).

## Library contents

49 clips across the five curriculum tracks:

- **Synthesis fundamentals (14):** engine archetypes (sine/FM/granular/physical),
  physical sub-models (bowed/blown/struck/Karplus), FM ratios (1:1, 2:1, 7:5),
  granular density (sparse/dense), wavetable morph.
- **Composition technique (9):** arc shapes (rise-fall, plateau), transitions
  (crossfade, hard cut), movement (slow drift, LFO pulse), variation
  (density, timbral), layering buildup.
- **Ambient history + listening (11):** 9 stylistic homages (Eno, Reich, Stars
  of the Lid, Budd, Oliveros, Fennesz, Hecker, Grouper, Basinski) + 2 CC0
  acoustic reference recordings (singing bowl, gong).
- **Production / DAW (7):** compression (before/after, pumping), EQ (low-cut,
  presence), mix-bus glue, reverb send, saturation.
- **Music + science crossover (8):** Shepard tone, Risset rhythm, tritone
  paradox, beating tones, just-vs-equal triad, harmonic series, missing
  fundamental, comb-filter / phase coherence.

See `api/data/clip_library.json` for the full per-clip metadata (slug, title,
description, duration, tags, license).
