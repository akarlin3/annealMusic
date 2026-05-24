# AnnealMusic

A generative ambient meditation sandbox: coupled oscillators drift over a harmonic lattice while you sculpt the field. Physics-driven sound, audio-reactive visuals.

## Tech stack

- **React 18** + **TypeScript** (strict, `noUncheckedIndexedAccess`)
- **Vite 5** build / dev server
- **Tailwind CSS 3**
- **Zustand** for the parameter store
- **Web Audio API** for synthesis (swappable engines + Ornstein–Uhlenbeck drift)
- **Canvas 2D** for the visualizer
- **Vitest** + jsdom for tests, **ESLint** + **Prettier** for quality

## Dev commands

```bash
npm install        # install dependencies
npm run dev        # start the Vite dev server (http://localhost:5173)
npm run build      # typecheck + production build to dist/
npm run preview    # preview the production build
npm run test       # run unit tests (Vitest)
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run format     # Prettier --write
```

## Project structure

```
src/
  audio/         # orchestrator (session machine, post-fx, drift, crossfade, input), IR
    engines/     # AnnealEngine interface, sine + fm engines, registry
  session/       # arc data model, preset arcs, easing curves, ArcRunner
  input/         # InputVoice (live-input chain), devices, latency, meter
  loop/          # LoopSlot state machine, capture, SeamLoopPlayer, GranularPlayer, windows
  components/    # Visualizer, ControlPanel, EngineSelector, InputPanel, LoopPedal, …
  hooks/         # useAnnealMusic (orchestration), useSession, useInput, useLoops
  state/         # param store, defaults, control schema
  visual/        # canvas draw loop, palette, math helpers
  pages/         # App
  styles/        # global css + slider styles
  types/         # shared types
  test/          # vitest setup + Web Audio mock
  share/         # URL state schema, encode/decode, hash read/write
docs/            # INIT_PLAN, ROADMAP, COMPAT, version plans, prototype reference
```

## Engines

Synthesis is organized around a small **engine interface** (`AnnealEngine`):
every engine builds its own voices and exposes a single output node, while the
**orchestrator** owns the shared physics (root, spread, density, coupling,
drift) and post-fx (brightness filter, reverb space, volume) and pushes
per-partial detune from the drift loop into the active engine. This makes
engines hot-swappable: pick one from the segmented control under the header and
the orchestrator **crossfades** (equal-gain, ~600ms) without a page reload.

- **Sine** — the coupled sine bank: one sine oscillator per partial over the
  harmonic lattice. No engine-specific params.
- **FM** — two-operator FM per partial: a sine carrier at the partial frequency,
  a modulator at `carrier × Ratio` with depth `Index × carrier` Hz, plus
  optional modulator self-**Feedback**. Params: **Ratio** (0.5–4), **Index**
  (0–10), **Feedback** (0–1).

Both engines share the same baseline + slow-LFO amplitude shape, so switching
engines changes timbre without changing the overall envelope of the field.

## Session modes

A session runs in one of two modes, chosen with the **Mode** toggle next to the
engine selector:

- **Open** — the original behavior: press Begin and the field drifts forever
  while you sculpt at will.
- **Arc** — a fixed-duration session that scripts the parameters along a preset
  envelope and automates itself to completion. Pick a preset and a duration
  (3–60 min, default 10), press Begin, and the arc plays: sculpt controls are
  locked (showing live interpolated values), a progress bar with segment markers
  runs across the visualizer, and the last 4 seconds fade out (`RETURNING`)
  before the session settles back to idle.

Three preset arcs ship in v0.4: **Bell Curve** (open, deepen, return),
**Dawn** (sparse and dark, gradually opening), and **Dusk** (bright and open,
gradually closing). Arc targets are multipliers on your pre-session sculpting, so
your starting patch is the neutral pose the arc deforms from. Arc timing rides on
the `AudioContext` clock, so long sessions stay accurate. (Both current engines
lock density while playing, so Dawn/Dusk's density move is held — they sweep
brightness and spread instead.)

## Live input

Bring a live instrument — bass, guitar, voice, anything mic'd — into the texture
as another voice. Click **Connect input** in the Input panel to grant microphone
access (the prompt is per click; we never re-prompt aggressively). Once
connected, the signal runs through its own chain — an 80 Hz high-pass, a gentle
compressor, your **Input Level**, and a drift-modulated filter that tracks the
same field as the engine — and into the shared post-fx, so it sits _inside_ the
field rather than on top of it.

A few deliberate choices:

- **Browser audio processing is disabled.** `echoCancellation`,
  `noiseSuppression`, and `autoGainControl` are turned off so the signal hits the
  engine clean — those features are tuned for speech on a call and mangle music.
- **Monitoring is off by default.** You hear yourself acoustically or through
  your amp/instrument; the AnnealMusic field is best heard on **headphones**.
  Turning monitoring on routes your processed input to the speakers — which can
  feed back, so use headphones. A guard dims monitoring if it detects sustained
  runaway level.
- **For best results, use headphones** (prevents feedback and keeps the input
  clean).
- **Latency** is shown as an estimate ("~30 ms input latency") so you can
  compensate — Web Audio doesn't expose true input latency, so it's a labeled
  estimate, not a measurement.
- Input is **never saved or shared**: it's a runtime/hardware concern, absent
  from the URL. It stays controllable in every mode and survives engine swaps and
  arc start/stop.

For wiring up an audio interface (bass DI, guitar, mic), see
[`docs/INPUT_GUIDE.md`](docs/INPUT_GUIDE.md).

## Loop pedal

Capture the live input into one of **three loop slots** (A / B / C), play them
back seamlessly, layer them, and **freeze** any of them into an endless granular
drone. Loops tap the input _after_ its voice chain (compressed, high-passed,
drift-modulated), so they sound like the input as it currently sits in the
field, and they sum into the same post-fx as the engines.

- **Capture** is not metronomic — there's no tempo or click. Arm a slot, and it
  starts recording on the first sound; stop it (or hit the 60-second cap) to
  commit. Captures shorter than 250 ms are discarded.
- **Seamless looping**: buffers loop with a short equal-power crossfade at the
  seam (≤120 ms, scaled to buffer length) so there's no click.
- **Freeze = granular re-synthesis**: a frozen slot stops looping linearly and
  continuously triggers short Hann-windowed grains from wandering positions in
  the buffer — a single chord becomes an infinite drone of itself. Grain
  **size**, **density**, **position jitter**, and **pitch jitter** are
  per-slot sliders; an optional **drift-coupled** toggle ties grain wander to
  the same drift field.
- **No undo.** Re-arming a slot overwrites its capture.
- Loops are independent of session state — they keep playing through engine
  swaps and arc start/stop, like the input does.

**Keyboard control** (a loop pedal wants hotkeys):

| Key           | Action                                         |
| ------------- | ---------------------------------------------- |
| `1` `2` `3`   | Slot A/B/C: arm → capture → (then) mute/unmute |
| `Shift+1/2/3` | Freeze ↔ unfreeze the slot                     |

Keys are ignored while a text field/slider/select is focused, and when a
modifier other than Shift is held (so browser tab shortcuts aren't shadowed).

Captured **audio** never goes in the URL (that's the wrong place for buffer
data — v0.7's backend will handle buffer sharing). Loop **parameters**
(muted / frozen / grain settings) do ride along in the share link. See
[`docs/LOOP_GUIDE.md`](docs/LOOP_GUIDE.md).

## Sharing

The full sculptable parameter set (everything except volume, which is a per-user
listening preference) is encoded in the URL fragment, so any session is
shareable as a link. Click **Copy Link** in the header to copy the current
state; opening that link restores the parameters before the first sound. The
fragment uses a versioned, human-readable schema — `#s=<version>:<key=value…>` —
and updates live (debounced) as you sculpt, via `history.replaceState` so it
never pollutes browser history.

Schema **v4** adds per-slot loop config — flags (`L<id>.m`/`f`/`c` for
muted/frozen/drift-coupled) and, for frozen slots, grain params
(`L<id>.gs/gd/gp/gx`) — on top of v3's session mode (`m=<open|arc>`, plus
`arc=<id>&dur=<sec>`), v2's engine selector (`e=<id>`), and namespaced engine
params (e.g. `fm.modRatio`). Buffer **audio** is never encoded. Example (an arc
session with a frozen loop):

```
https://anneal.averykarlin.org/#s=4:m=arc&arc=bell&dur=720&e=fm&rootFreq=147&spread=1.08&density=7&coupling=0.62&drift=0.30&brightness=0.74&space=0.55&fm.modRatio=2.00&fm.modIndex=4.50&fm.feedback=0.20&LA.f=1&LA.gs=140&LA.gd=14&LA.gp=0.50&LA.gx=0
```

A link with frozen slots but no buffers loads the slots **empty** with the
frozen/grain config remembered — capture into the slot and it applies on commit.
**v1**–**v3** links still load — earlier schemas ignore loop keys, v1/v2 are
interpreted as `mode=open` (v1 also as the sine engine). An unknown arc id loads
open mode with a notice, out-of-range values are clamped, malformed fragments
fall back to defaults, and links from a newer schema version load defaults and
surface a notice.

## Backend (v0.7)

A FastAPI + PostgreSQL + S3-compatible service in [`api/`](api) persists
user content — **patches** (the full encoded URL state), **captures** (loop-pedal
audio), and **recordings** (schema only; export is v1.0). Identity is
**anonymous-first**: every browser gets a stable `anonId` (UUID) on first save,
carried in the `x-anon-id` header; no login. The client runs **fully with the
backend offline** — only Save / My Patches / `/p/<slug>` need it.

URLs are hierarchical: **Copy Link** still produces the self-contained inline
`#s=4:` link (works offline forever); **Save** mints a server short link
`/p/<slug>` and unlocks captures + the My Patches drawer. Saving defaults to
params-only; "include captures" is an explicit opt-in (uploaded as WAV, transcoded
to Opus, ref-counted server-side).

The URL schema stays the **single source of truth**: `npm run gen:schema`
compiles the TypeScript definitions into [`schema/manifest.v4.json`](schema),
which the server validates patch payloads against (a CI contract test fails on
drift). See [`docs/API.md`](docs/API.md) for the endpoint reference and
[`docs/DEPLOY.md`](docs/DEPLOY.md) for local dev (`docker compose up`: Postgres +
MinIO + API + web) and Railway deploy. Design rationale is in
[`docs/v0.7-PLAN.md`](docs/v0.7-PLAN.md).

The API deploys to **Railway** (managed Postgres); object storage is
**Cloudflare R2** (S3 API, zero egress). The web app stays on Firebase Hosting.

## Gallery (v0.8)

The [**`/gallery`**](https://anneal.averykarlin.org/gallery) route surfaces patches
their creators set to `public`. It's a separate, deep-linkable page — browse
anonymously, **Preview** a short audio thumbnail inline, and **Load** any patch
into the sandbox in one click. Sort (newest / oldest / most-loaded), filter
(engine, mode, has-captures), and full-text search are basic and predictable;
pagination is a stable "Load more" cursor.

Each card shows a **deterministic static frame** of the patch's visualizer (same
params → same art). Audio previews are **rendered server-side**: because the
engine is real-time and depends on the browser's Web Audio DSP, previews are
produced by playing the *real* engine in **headless Chromium** and capturing 20 s
to Opus — same code, same sound. Rendering is async; a card shows "preview
rendering" until it's ready.

A patch becomes public only when its creator toggles it; flipping back to
`unlisted` removes it from the gallery within a minute. Publishing auto-screens the
title/description, and any card can be **reported** (`…` → Report) for review.
Moderation + the minimal `/admin` panel are documented in
[`docs/MODERATION.md`](docs/MODERATION.md) and [`docs/ADMIN.md`](docs/ADMIN.md);
design rationale is in [`docs/v0.8-PLAN.md`](docs/v0.8-PLAN.md).

## Deploy

Production target: **Google Cloud — Firebase Hosting** (static SPA, global CDN,
managed TLS). The deploy workflow (`.github/workflows/deploy.yml`) triggers when
CI succeeds on `main`, then builds and deploys `dist/`. Production builds emit no
source maps (`vite.config.ts` → `build.sourcemap: false`).

### One-time setup

1. Create a Firebase project and enable Hosting. Set its project id as the
   `default` in [`.firebaserc`](.firebaserc) (currently `annealmusic`) and as the
   `projectId` in the deploy workflow.
2. Create a service account with the **Firebase Hosting Admin** role, download
   its JSON key, and add it as the `FIREBASE_SERVICE_ACCOUNT` GitHub Actions
   secret. (`firebase init hosting:github` can generate this for you.)
3. Push to `main` — once CI is green the deploy workflow publishes to the `live`
   channel.

### DNS for `anneal.averykarlin.org`

Custom-domain records are issued per-project by Firebase Hosting when you add
the domain in the console. Typically:

1. Add `anneal.averykarlin.org` under Hosting → Add custom domain.
2. Add the **TXT** record Firebase provides to verify ownership.
3. Add the **A** records (Firebase's hosting IPs) — or the **CNAME** target
   Firebase provides — at your DNS provider for the `anneal` subdomain.
4. Wait for the managed certificate to provision.

> No DNS changes are made by this repo; configure them at your DNS provider.

## Contributing

This is an early-stage personal project (v0.1). See [`docs/ROADMAP.md`](docs/ROADMAP.md)
for the planned trajectory. Each version is a focused slice; open an issue to
discuss before larger changes.

## License

[MIT](LICENSE).
