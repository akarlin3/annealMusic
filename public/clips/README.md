# Audio clip library assets (v6.2)

This directory holds the shipped audio clips referenced by lessons, as Opus
files (`<slug>.opus`, 96 kbps mono — consistent with `public/bells/` and
`public/sources/`).

**The binaries are generated, not hand-committed.** The source of truth is the
manifest at `api/data/clip_library.json`. Regenerate the audio with:

```bash
python tools/gen_clips.py            # requires ffmpeg → <slug>.opus
python tools/gen_clips.py --wav      # no ffmpeg → <slug>.wav (inspection only)
```

The two CC0 acoustic reference recordings (`ref-tibetan-bowl-acoustic.opus`,
`ref-gong-acoustic.opus`) are **not** synthesised — drop the real CC0 source
recordings here and record their provenance in `docs/AUDIO_CLIPS.md` +
`LICENSES.md`.

See `docs/AUDIO_CLIPS.md` for the full library listing and license attributions.
