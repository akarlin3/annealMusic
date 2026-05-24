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

Synthesis is entirely native nodes (oscillators, gains, biquad, convolver,
analyser), which behave consistently across browsers. **Loop capture** (v0.6)
is the one place we reach for `AudioWorklet`: a tiny processor copies the
processed input's blocks and streams them to the main thread to assemble an
`AudioBuffer`. `AudioWorklet` is available in all evergreen browsers
(Chrome 66+, Firefox 76+, Safari 14.1+ / iOS 14.5+); we deliberately do **not**
fall back to the deprecated `ScriptProcessorNode`. The worklet module is loaded
from a **Blob URL** (no separate file / build-pipeline wiring); `isCaptureSupported`
feature-detects `ctx.audioWorklet.addModule` and capture throws a clear error
where it's absent.

## Loop pedal — memory (mobile)

Each loop slot can hold up to 60 s of audio; three stereo slots cap at ~70 MB
(`60 s × 48 kHz × 2 ch × 4 B ≈ 23 MB` each). That's comfortable on desktop but
can pressure low-end mobile. On slot creation we read the `navigator.deviceMemory`
hint and **log a console warning** (no crash, no hard block) when it's ≤ 2 GB.
Buffers are explicitly nulled on **clear** so they're eligible for GC, and the
audio core is torn down when no engine/input/loop is live. Captured input is
mono in v0.6, so real usage is roughly half the stereo worst case.

## Loop playback timing — AudioContext clock (both)

Both seam-crossfade looping (`SeamLoopPlayer`) and granular freeze
(`GranularPlayer`) schedule against `AudioContext.currentTime` via a look-ahead
loop (`scheduler.ts`): a `setInterval` ticker (25 ms) only decides _how far
ahead_ to plan; every audio event is placed with a precise `start(when)`
timestamp. No `setTimeout`/`setInterval` ever times an audio event directly, so
timing is sample-accurate and consistent across Chrome/Safari/Firefox.

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

## Live input — `getUserMedia` constraints (Chrome / Safari / Firefox)

Live input (`src/input/InputVoice.ts`) opens the stream with
`echoCancellation`, `noiseSuppression`, and `autoGainControl` all set to
`false`, plus `channelCount: 1`. These "voice cleanup" DSP blocks are tuned for
speech intelligibility and mangle sustained musical tones (AEC notches/ducks
returning energy; NS gates quiet tails; AGC fights our compressor), so we want
the raw signal.

- **Chrome / Firefox (desktop):** honor all three flags; the raw signal reaches
  the chain. `getUserMedia` requires a secure context (HTTPS or `localhost`).
- **Safari (desktop + iOS):** requires `getUserMedia` to be invoked from a **user
  gesture** — satisfied by the Connect button's click handler (same requirement
  the `AudioContext` already obeys). Safari has **historically ignored** some
  constraint flags (notably `autoGainControl`, and at times `noiseSuppression`);
  we still pass them (no harm) but treat them as best-effort. This is why the
  default-muted monitor + the feedback guard matter more on Safari.
- **All browsers:** `enumerateDevices()` returns **empty `label`s until
  permission is granted** (privacy). The device picker renders `Input N`
  placeholders until labels are available.
- **Mobile (iOS Safari / Chrome Android):** built-in mic only is expected;
  external interfaces over USB are inconsistent on mobile. The gesture +
  secure-context rules apply; monitoring through the phone speaker will feed back,
  so headphones are messaged in the UI.

## Live input — latency estimate

Web Audio exposes **no** true mic→node input latency. The readout
(`src/input/latency.ts`, the single source of the formula) estimates the output
pipeline as `round((baseLatency + outputLatency) * 1000)` ms:

- **Chrome / Firefox:** both `AudioContext.baseLatency` and `outputLatency` are
  available; the estimate reflects the real output pipeline.
- **Safari:** `outputLatency` is absent, so the formula falls back to
  `2 × baseLatency` as a coarse proxy.

The true round trip also includes the device's input buffer, which the API
hides, so the surfaced value is a **lower-bound estimate** and is labeled as such
in the UI ("~N MS INPUT LATENCY · ESTIMATE"). If a hardware loopback is available,
compare the estimate to a measured round trip and note the offset here.

## Live input — device change / unplug / tab-hide

- **`devicechange` + track end (all browsers):** while connected, `InputVoice`
  listens for `navigator.mediaDevices.devicechange` and the active track's
  `onended`. If the active device disappears (or the track dies), it re-enumerates
  and gracefully reconnects to the **default** device, emitting `device-changed`
  (surfaced as a toast). On failure it emits a typed `error` and the audio graph
  stays alive — no crash. (Verify in dev by unplugging a USB interface mid-session:
  the panel should show the reconnect/disconnect state and audio should not break.)
- **Tab hidden (`visibilitychange`):** we deliberately **do not** suspend or tear
  down the input stream — we don't fight the browser's own context suspension.
  Chrome generally keeps the captured stream alive in a backgrounded tab; Safari
  and Firefox may suspend the `AudioContext` (pausing audio) and resume on
  refocus. In all cases the audio graph survives the background→foreground
  transition. There is no input-specific pause/resume control.

## Live input — cross-browser smoke matrix

Behavior to verify per release (built-in mic + a USB interface where applicable):

| Target              | Built-in mic | USB interface | Notes                                                         |
| ------------------- | ------------ | ------------- | ------------------------------------------------------------- |
| Chrome (desktop)    | ✓            | ✓             | All constraint flags honored; reference behavior.             |
| Safari (desktop)    | ✓            | ✓             | Gesture required; some flags best-effort; no `outputLatency`. |
| Firefox (desktop)   | ✓            | ✓             | Flags honored; device labels need permission.                 |
| Mobile Safari (iOS) | ✓            | n/a           | Gesture + HTTPS; speaker monitoring feeds back — headphones.  |
| Chrome (Android)    | ✓            | n/a           | As iOS; built-in mic only expected.                           |

> As with the engine graph, cross-browser behavior here is reasoned from the Web
> Audio + Media Capture specs and the all-native node chain; a hands-on listen on
> Safari and a mobile device is still worth doing before a tagged release.
