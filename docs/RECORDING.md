# Recording (v1.0)

Capture a session to a downloadable file, saved against the v0.7 `recordings`
quota (10 per anon user, 1 GiB total). Two render modes and two formats.

## Realtime capture

Records exactly what you hear — the post-fx master output, which already sums
the engine, live input, and loops. Hit **Record**, play, hit **Stop**; a save
dialog asks for a title and visibility, shows a size estimate, then uploads.

- **Tap point**: `masterVol` (post-fx, post-volume) via the orchestrator's
  `getRecordingTap()`. A dedicated destination node never perturbs the speakers.
- **Opus** (default, small): `MediaStreamAudioDestinationNode` →
  `MediaRecorder` (`audio/webm;codecs=opus`). The server stores it for the
  `/r/<slug>` player and download.
- **WAV** (lossless, opt-in): the same AudioWorklet PCM tap the loop pedal uses,
  finalized with `encodeWav` on stop.
- **Limits**: 60-minute hard cap, with a warning toast at 50 minutes and an
  automatic stop at 60.

> Format is chosen **before** recording (a small Opus/WAV toggle by the Record
> button) because the two capture paths genuinely differ (MediaRecorder vs.
> lossless PCM). The save dialog confirms it alongside the size estimate.

## Offline render

`OfflineRenderer` re-renders a saved patch deterministically in an
`OfflineAudioContext`, faster than realtime, reusing the real engine DSP, the
`driftStep` math, the `ArcRunner`, and the reverb IR. Arc patches render their
full arc; open patches default to 5 minutes. Drift/arc evolution is stepped at
audio-time checkpoints via `OfflineAudioContext.suspend()`.

**Client vs. server.** Client-side is the default (no server cost). Fallback
chain: (1) client `OfflineAudioContext`; (2) if the device lacks
`OfflineAudioContext` or AudioWorklet (physical patches on weak devices), the
v0.8 server render path (Playwright/Chromium, native worklet support); (3) if
neither, realtime capture only.

## Sharing & management

- **My Recordings** drawer (sibling to My Patches): inline play, download,
  delete, and a copy-able `/r/<slug>` short link.
- **`/r/<slug>`**: a minimal public player. Public recordings play for anyone;
  private recordings are visible only to their owner. A finished recording can
  reference its source patch (a link back to `/p/<patch_id>`).

## Upload pipeline

`POST /api/v1/recordings` is a multipart upload — the audio file plus the
`format`, `duration_ms`, `title`, `visibility`, and optional `patch_id` fields.
It stores the blob, mints a short slug, and enforces the per-user count and
global byte quotas.
