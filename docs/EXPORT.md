# Anneal Ambiance DAW Stem Export

Anneal Ambiance v1.5 enables musicians and sound designers to render and export high-fidelity, sample-accurate, phase-aligned **multi-track stems** in lossless WAV format, packaged client-side into a zero-dependency ZIP archive.

Stems can be directly imported into any professional digital audio workstation (DAW) including Ableton Live, Logic Pro, Pro Tools, Reaper, FL Studio, and Cubase.

---

## 1. Supported Formats & Quality Configurations

Stems are exported with the following user-configurable specifications:

- **Sample Rate**: 44.1 kHz, 48.0 kHz (Default), or 96.0 kHz (with file size alerts).
- **Bit Depth**: 24-bit PCM (Default) or 32-bit Float.
- **Channels**: Stems representing mono modules (e.g., raw input, individual partial oscillators) are exported as **mono WAVs** to conserve space; master and post-FX tracks are exported as **stereo WAVs**.
- **Phase & Time Alignment**: All stems are sample-accurate, starting exactly at $t=0$, maintaining absolute phase coherence. Leading silence is automatically generated for stems that start playing later in the session.

---

## 2. Active Stems Selection (The 13-Stem Ceiling)

Stems are dynamically tapped from active points in the live or offline audio graph. Inactive loops or disconnected mic feeds are filtered out automatically.

| Stem File             | Channel Format | Tap Point             | Description                                                                                            |
| :-------------------- | :------------- | :-------------------- | :----------------------------------------------------------------------------------------------------- |
| `master.wav`          | Stereo         | Post-FX output        | Complete session mix down (Engine + Loops + Input processed post-reverb/filter).                       |
| `engine.wav`          | Stereo         | Engine raw output     | Clean synthesizer engine output before filter and space reverb.                                        |
| `engine-fx.wav`       | Stereo         | Engine post-FX        | Clean engine output routed through reverb + filter.                                                    |
| `input.wav`           | Mono           | Input tap             | Processed microphone/line-in raw signal (highpass, compressor, waveshaper).                            |
| `input-fx.wav`        | Stereo         | Input post-FX         | Processed input voice routed through space reverb + filter.                                            |
| `loop-[A/B/C].wav`    | Mono           | Loop Slot raw gain    | Individual loop slot playback (post-granular modulation / post-pitch), pre-FX.                         |
| `loop-[A/B/C]-fx.wav` | Stereo         | Loop Slot post-FX     | Individual loop slot routed through space reverb + filter.                                             |
| `partial-[0-15].wav`  | Mono           | Oscillator voice gain | [Opt-in] Isolated engine partials (additive oscillators for Sine/FM) for fine-grained spectral mixing. |

---

## 3. Metadata & Headers

To satisfy professional archiving standards, each WAV file includes standard structural sub-chunks:

### Broadcast Wave Format (BWF) `bext` Header

Written before the `data` sub-chunk (602 bytes):

- **Description**: ASCII description of the track stem.
- **Originator**: `"Anneal Ambiance v1.5.0"`
- **OriginatorReference**: Session patch hash and title.
- **OriginationDate**: `YYYY-MM-DD`
- **OriginationTime**: `HH-MM-SS`
- **TimeReference**: `0` (Synchronized to session start).

### `iXML` Chunk

Enables semantic track identification and project context mapping inside the DAW:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<IXML>
  <PROJECT>Anneal Ambiance Session</PROJECT>
  <SPEED>
    <FILE_SAMPLE_RATE>48000</FILE_SAMPLE_RATE>
    <AUDIO_BIT_DEPTH>24</AUDIO_BIT_DEPTH>
  </SPEED>
  <TRACK_LIST>
    <TRACK>
      <CHANNEL_INDEX>1</CHANNEL_INDEX>
      <INTERLEAVE_INDEX>1</INTERLEAVE_INDEX>
      <NAME>engine</NAME>
      <FUNCTION>synthesis</FUNCTION>
    </TRACK>
  </TRACK_LIST>
</IXML>
```

---

## 4. Performance & Platform Enforcements

To prevent system lockups and Out-of-Memory (OOM) exceptions:

- **Web Browser limits**: Maximum render duration of **30 minutes**.
- **Mobile (Capacitor) limits**: Automatically defaults to a strict **10-minute cap** (warning overrides allowed on high-end devices) to prevent WebView crashes.
- **ZIP Method**: Compiles entirely client-side using the `Store` (uncompressed) method, achieving instant packaging and avoiding CPU/memory-intensive compression steps on raw PCM.
- **Native Mobile Sharing**: Employs `@capacitor/filesystem` to write the ZIP file to the cache directory, and `@capacitor/share` to natively activate AirDrop, iOS Files, Android Documents, or email shares.

---

## 5. Render Modes

### ⚡ Offline Render (Recommended)

Performs faster-than-realtime renders using sequentially instantiated `OfflineAudioContext` passes. All dynamic walks (lattice drift, session arcs, granular center sweeps) are seeded with a Mulberry32 PRNG. This guarantees:

1. **Absolute Determinism**: Rendering the same seed twice yields identical byte-level SHA-256 signatures.
2. **Speed**: A 5-minute session renders in less than 2 seconds.
3. **Memory Safety**: Rapid sequential contexts with intermediate Garbage Collection (GC) sweeps keep memory usage low.

### 🎤 Realtime Capture

Ideal for live vocal performance, instrumental accompaniment, or manual loop pedaling where real-time physical inputs are actively modulated. Captures live audio threads in parallel utilizing `AudioWorkletNode` PCM sample accumulators.

- _Note_: FX-isolated stems are unavailable in realtime mode due to live graph routing constraints.
