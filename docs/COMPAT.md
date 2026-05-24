# Cross-browser compatibility notes

Web Audio behavior that differs between Chrome and Safari, and how AnnealMusic
handles it. Update this file whenever a new version touches the audio path.

## AudioContext construction (Safari)

Older Safari only exposes `webkitAudioContext`. The orchestrator resolves the
constructor as `window.AudioContext ?? window.webkitAudioContext`
(`src/audio/orchestrator.ts`), so it works on both. A typed
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

## Clipboard (Copy Link) — Chrome / Safari / Firefox + iOS

The Copy Link button (`src/components/CopyLinkButton.tsx`) writes the shareable
URL using the async `navigator.clipboard.writeText` API, with a
`document.execCommand('copy')` fallback (off-screen `<textarea>` + `select()`)
and a final `window.prompt` so the user can copy manually if both fail.

- **Chrome / Firefox (desktop):** `navigator.clipboard.writeText` works from the
  button's click handler. On Firefox over plain HTTP it may be unavailable
  (non–secure context); the `execCommand` fallback covers that.
- **Safari (desktop + iOS):** clipboard writes require a user gesture. The write
  happens synchronously inside the button's click handler, which satisfies the
  gesture requirement. iOS Safari historically restricts clipboard access; the
  `execCommand` path (with `focus()` + `select()` before `execCommand`) is the
  compatibility net, and the prompt is the last resort.
- **Secure-context requirement:** `navigator.clipboard` is only exposed on HTTPS
  (and `localhost`). Production is HTTPS via Firebase Hosting, so the modern API
  is the normal path; the fallback exists for edge cases and older engines.
- **Capacitor / WebView (future Android shell):** only standard web clipboard
  APIs are used — no Electron-only or Node clipboard calls — so the same code
  works inside a WebView. A native clipboard plugin can be layered later without
  changing call sites.

## Teardown timing

`stop()` fades out, then stops sources and closes the context after ~2.2s.
Calling `start()` again creates a fresh context (contexts are not reused after
`close()`), matching prototype behavior on both engines.

## Engine crossfade (both)

Engine swaps run both engines briefly in parallel, each through its own bus
`GainNode`, and equal-gain linear-ramp crossfade over ~600ms
(`src/audio/orchestrator.ts`). The ramps use an explicit `setValueAtTime` anchor
before `linearRampToValueAtTime`, so there is no implicit value jump or click on
either Chrome or Safari. Rapid switches coalesce to the latest requested engine.

## FM engine — modulation depth & feedback (both)

The FM engine (`src/audio/engines/fm.ts`) wires `modulator → gain → carrier.frequency`
(additive a-rate modulation of an `AudioParam`) and, for feedback,
`modulator → gain → modulator.frequency`. Connecting an audio-rate signal to a
frequency `AudioParam` and self-feedback loops both behave consistently across
Chrome and Safari (native nodes only; no `AudioWorklet`). Feedback gain is
bounded (`feedback × modFreq × 3`) so even at maximum it stays at the harsh edge
rather than producing denormals/NaNs. No FM-specific timing quirks observed; the
shared baseline + LFO amplitude shape means FM and sine have identical envelopes.

> Note: cross-browser behavior here is reasoned from the Web Audio spec and the
> all-native node graph; a hands-on Safari listen is still worth doing before a
> tagged release.

## Arc timing — AudioContext clock (both)

Arc mode (`src/session/ArcRunner.ts` + the orchestrator's arc tick) advances on
`AudioContext.currentTime`, not `setInterval` wall-time or `Date.now()`. The tick
fires on a 20 Hz `setInterval`, but the elapsed value passed to `ArcRunner.tick()`
is recomputed from `ctx.currentTime − arcT0` each fire, so interval jitter/coalescing
never accumulates and the arc lands on its target duration regardless of session
length. Tested durations: 3, 12, and 15 min end-to-end, and a 60-min run simulated
against a mocked clock (`src/audio/orchestrator.test.ts`, `ArcRunner.test.ts`) —
end fires within one tick (≤50 ms) of the audio clock reaching the duration.

- **Backgrounded tabs (both):** when a tab is hidden, browsers throttle timers and
  may suspend the `AudioContext` — `currentTime` stops advancing _and_ audio pauses.
  The arc therefore effectively pauses with the sound and resumes on refocus; there
  is no silent over-run or audible glitch. There is no pause/resume control in v0.4.
- **Final fade:** the last 4 s ramp `masterVol` to 0 (`linearRampToValueAtTime`),
  then the orchestrator tears down to idle — same all-native ramp behavior as the
  engine crossfade, so no Chrome/Safari difference.
