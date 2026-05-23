# Cross-browser compatibility notes

Web Audio behavior that differs between Chrome and Safari, and how AnnealMusic
handles it. Update this file whenever a new version touches the audio path.

## AudioContext construction (Safari)

Older Safari only exposes `webkitAudioContext`. The engine resolves the
constructor as `window.AudioContext ?? window.webkitAudioContext`
(`src/audio/AnnealMusicEngine.ts`), so it works on both. A typed
`WebkitWindow` shim provides the fallback without `any`.

## Autoplay / user-gesture requirement (both)

Browsers require an `AudioContext` to be created/resumed inside a user gesture.
The engine is constructed and `start()`ed only from the "Begin" button click,
and calls `ctx.resume()` if the context starts `suspended`. Do not move engine
construction into an effect that runs on mount, or audio will be blocked.

## `ConstantSourceNode` (Safari)

Used for the per-partial baseline gain. Supported in modern Safari (14.1+).
If support for very old Safari is ever needed, fall back to a DC-offset via a
gain on a unit signal. Not a concern for current evergreen targets.

## ScriptProcessor vs AudioWorklet

Not used here — synthesis is entirely native nodes (oscillators, gains,
biquad, convolver, analyser), which behave consistently across browsers.

## Convolver IR

The reverb impulse response is generated with `Math.random()` white noise
(`src/audio/ir.ts`); identical across browsers. No external IR files to load.

## Sample rate

`AnalyserNode` bin math reads `analyser.context.sampleRate` at draw time rather
than assuming 44.1/48 kHz, so the spectrum probe stays correct on devices with
other rates (common on mobile Safari).

## Teardown timing

`stop()` fades out, then stops sources and closes the context after ~2.2s.
Calling `start()` again creates a fresh context (contexts are not reused after
`close()`), matching prototype behavior on both engines.
