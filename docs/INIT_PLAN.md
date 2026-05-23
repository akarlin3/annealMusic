# AnnealMusic — Init Plan (Checkpoint 0)

Diagnosis-first plan for scaffolding a production-grade web app around the
existing single-file prototype (`docs/prototype.jsx`). **No production code is
written in this checkpoint.** Awaiting explicit "go" before Checkpoint 1.

## Resolved placeholders

| Placeholder     | Value                                                                             |
| --------------- | --------------------------------------------------------------------------------- |
| `REPO_NAME`     | `annealmusic`                                                                     |
| `GH_OWNER`      | `akarlin3`                                                                        |
| `DEPLOY_TARGET` | **Google Cloud** (not one of the prompt's three presets — see Deploy + Tradeoffs) |
| `DOMAIN`        | `anneal.averykarlin.org`                                                          |

## Prototype audit (read end to end)

The prototype is a single default-exported React component (`AnnealMusic`) that
holds the entire app: state, audio graph, drift loop, visual RAF loop, and UI.
Salient facts the port must preserve exactly:

**Physics / params**

- `HARMONICS = [1, 1.5, 2, 2.5, 3, 4, 5, 6]` — partial frequency ratios; `density` selects the first N.
- Controls (group · range · step): `rootFreq` Pitch 55–220/1; `spread` Pitch 0.7–1.3/0.01; `density` Pitch 2–8/1 **(locked while playing)**; `coupling` Physics 0–1/0.01; `drift` Physics 0–1/0.01; `brightness` Tone 0–1/0.01; `space` Tone 0–1/0.01. Plus `volume` 0–0.8/0.01 (separate footer slider, not in the grouped grid).
- Defaults: root 110, spread 1.0, density 6, coupling 0.3, drift 0.5, brightness 0.5, space 0.4, volume 0.35.

**Audio graph (per `initAudio`)**

- `AudioContext || webkitAudioContext`; `resume()` if suspended.
- `master` gain (starts 0, 3s linear fade-in to 1.0).
- Lowpass `BiquadFilter`, cutoff `200 * 30^brightness`, Q 0.6.
- `AnalyserNode` fftSize 1024, smoothing 0.85.
- `ConvolverNode` with synthesized IR (`makeIR(ctx, 4.0, 2.4)`), `wetGain = space`, `dryGain = 1 - space*0.4`.
- `masterVol` gain = volume.
- Per partial (i in 0..density-1): sine `osc` at `rootFreq * ratio^spread`; gain `g` driven by a `ConstantSource` baseline `0.32/(i+1)` plus a slow sine LFO (`0.025 + rand*0.12` Hz) scaled `0.14/(i+1)`. `osc → g → filter`.
- Routing: `filter → dry → master`; `filter → convolver → wet → master`; `master → masterVol → analyser → destination`.

**Drift loop** — `setInterval` 50 ms, `dt = 0.05`. Ornstein–Uhlenbeck mean-reversion (`theta = 0.25`) toward 0, Kuramoto-style coupling toward the partial mean (`K = coupling*0.9`), additive noise (`sigma = drift*18` cents, scaled by `sqrt(dt)`). Detune clamped ±60 cents, applied via `osc.detune.setTargetAtTime(detune, t, 0.12)`. Uses `Math.random()` (must become injectable `rng` for tests).

**Live updates** — a React effect maps brightness/space/rootFreq/spread/volume to the graph via `setTargetAtTime` (time constants 0.2–0.3). density is intentionally not live (rebuild-only, hence the play-lock).

**Stop** — cancel master ramp, `setTargetAtTime(0, …, 0.6)`, then after 2200 ms stop oscillators/LFOs/baselines and `ctx.close()`.

**Visuals** — canvas RAF loop, DPR-aware resize. Per frame: translucent trail fade `rgba(12,10,9,0.10)`, amber radial halo, one orbiting glow per partial (orbit radius scales with index, vertical squash 0.78, amplitude from analyser bins near each partial's frequency), and a faint bottom spectrum trace. Visual phase advances at `freqHz/220` (decoupled from audio rate). Reads `audioRef`/`paramsRef` live.

**Fonts / palette** — Google Fonts `Instrument Serif` (display), `Geist` (body), `Geist Mono` (mono), currently `@import`ed inside an inline `<style>`. Palette is warm-dark: bg `#0c0a09`, text `#f5f5f4`, amber accents `#f59e0b / #fbbf24 / #fef3c7 / #fed7aa / #fb923c`, stone neutrals `#a8a29e / #78716c / #57534e / #44403c / #292524 / #1c1917 / #14110f`. Custom range-slider CSS for the amber thumb. Footer note: "kuramoto · ornstein–uhlenbeck".

## Project structure

```
.
├─ docs/
│  ├─ prototype.jsx        # original single-file prototype (reference, kept)
│  ├─ INIT_PLAN.md         # this file
│  ├─ ROADMAP.md           # created in Checkpoint 3 (verbatim content)
│  └─ COMPAT.md            # Safari/Chrome Web Audio caveats (Checkpoint 2)
├─ public/                 # static assets served as-is
├─ src/
│  ├─ audio/               # Web Audio engine, drift math, IR generation
│  ├─ components/          # Visualizer, ControlPanel, ArchitectureDiagram, layout
│  ├─ hooks/               # useAnnealMusic (orchestration), useAudioEngine
│  ├─ state/               # param store, defaults, schema (CONTROL_DEFS)
│  ├─ visual/              # canvas draw loop, palette, math helpers
│  ├─ pages/               # App composition
│  ├─ styles/              # global css, tailwind entry, slider styles
│  ├─ types/               # shared TS types (params, partial)
│  ├─ test/                # vitest setup + jsdom helpers
│  └─ main.tsx             # React entry
├─ index.html             # font <link>s, root div
├─ .github/workflows/     # ci.yml, deploy.yml (Checkpoints 3–4)
└─ config files           # vite, tsconfig(s), tailwind, postcss, eslint, prettier
```

## Stack choices

- **React 18** (`react@^18.3`, `react-dom@^18.3`) + **TypeScript 5** strict, with `noUncheckedIndexedAccess: true` and `noImplicitAny`.
- **Vite 5** (`@vitejs/plugin-react`) — fast dev server, simple static `dist/` for any host.
- **Tailwind CSS 3** (+ `postcss`, `autoprefixer`). Port inline styles to Tailwind utilities where natural; keep the small custom slider CSS and the exact palette as CSS variables / `tailwind.config` theme extensions so colors stay identical.
- **Testing: Vitest** + `jsdom` + `@testing-library/react` (component smoke later; unit tests for pure modules now).
- **Lint: ESLint** (`typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`) + **Prettier** for formatting. Justification below.
- **Icons: `lucide-react`** (already used: Play, Pause, ChevronDown, ChevronUp, Circle).
- **Fonts:** move the `@import` into `index.html` `<link rel="preconnect">` + stylesheet links (avoids `@import` render-blocking inside JS-injected style; identical families/weights). Tailwind `fontFamily` maps `display`/`body`/`mono` to the same stacks.

### ESLint vs Biome — pick: ESLint + Prettier

Biome is faster and single-binary, but ESLint wins here because (a) `eslint-plugin-react-hooks` is the canonical guard for the hook-heavy audio/visual effects we're porting and has no first-class Biome equivalent yet, (b) it matches the "PrismTask web tier" convention the prompt asks us to mirror, and (c) the ecosystem/CI examples are ubiquitous. Tradeoff: two tools instead of one, slightly slower lint. Flagged below.

## Dependency manifest

**prod**

- `react` ^18.3, `react-dom` ^18.3
- `lucide-react` ^0.4xx
- `zustand` ^4.5 (state — see State model)

**dev**

- `typescript` ^5.4, `vite` ^5.x, `@vitejs/plugin-react` ^4.x
- `tailwindcss` ^3.4, `postcss` ^8.4, `autoprefixer` ^10.4
- `vitest` ^1.x, `jsdom` ^24.x, `@testing-library/react` ^16, `@testing-library/jest-dom` ^6
- `eslint` ^8.57, `typescript-eslint` ^7, `eslint-plugin-react-hooks` ^4.6, `eslint-plugin-react-refresh` ^0.4
- `prettier` ^3.x, `eslint-config-prettier` ^9
- `@types/react` ^18, `@types/react-dom` ^18, `@types/node` ^20
- (Checkpoint 3) `husky` ^9, `lint-staged` ^15

Exact versions pinned at scaffold time; `^` shown for intent.

## Audio architecture

- **`src/audio/AnnealMusicEngine.ts`** — framework-agnostic class owning the graph and lifecycle: `constructor(params)`, `start()`, `stop(): Promise<void>` (resolves after the 2.2s teardown), `setParams(partial)` (live `setTargetAtTime` updates), `getAnalyser()`, `isRunning()`. Holds the drift interval internally (started in `start`, cleared in `stop`). Knows nothing about React.
- **`src/audio/drift.ts`** — pure `driftStep(partials, params, dt, rng)` returning new detune values (OU + coupling + noise, clamp ±60). `rng: () => number` injected for deterministic tests. The engine maps results onto `osc.detune` via `setTargetAtTime`.
- **`src/audio/ir.ts`** — `makeIR(ctx, duration, decay)` extracted verbatim (the only `Math.random` use kept inline; not under test).
- **Param flow:** React store (Zustand) → `useAudioEngine` hook subscribes and calls `engine.setParams(partial)` on change → engine schedules `AudioParam` ramps. `density` changes require stop/rebuild (the play-lock prevents live changes, matching prototype).
- **Partial type:** `{ osc, g, lfo, baseline, lfoGain, ratio, detune }` strictly typed against lib.dom Web Audio interfaces. A separate plain `{ detune, ratio }[]` view feeds the pure `driftStep` so the math module never touches `AudioNode`s.

## Visual architecture

- **Canvas 2D for v0.1** (keep). The prototype's glow/trail aesthetic relies on `globalCompositeOperation`-free translucent fills and radial gradients that Canvas2D does cheaply at this partial count (≤8). No need for WebGL yet.
- **`src/visual/draw.ts`** — pure-ish `drawFrame(ctx2d, state)` where `state` carries size, spectrum (`Uint8Array | null`), partial freqs, phases, time delta, and palette. No DOM/RAF inside.
- **`src/visual/palette.ts`** — all color constants (exact hex/rgba from prototype) and tuning numbers (orbit factors, squash 0.78, radii).
- **`src/components/Visualizer.tsx`** — owns the canvas element, DPR resize listener, RAF loop, phase advancement, and pulling the analyser frame; delegates pixels to `drawFrame`.
- **WebGL flagged as a later option** (post-v1.0 per ROADMAP); interface kept narrow so it could be swapped behind `drawFrame`.

## State model — Zustand (lightweight store)

Default to a single Zustand store exposing `params: AnnealMusicParams` and `setParam(key, value)` (bounds-clamped against `CONTROL_DEFS`). Rationale: the prototype already funnels everything through one `params` object + `paramsRef`; a store gives us (a) a stable ref-like read for the audio/visual loops without prop-drilling through Visualizer/ControlPanel, and (b) clean growth room for v0.2 URL-state and v0.4 arc mode. Context would re-render the whole tree on every slider tick; prop-drilling gets ugly fast across the canvas + control split. Tradeoff: one extra dep vs. zero-dep Context — justified by the anticipated roadmap growth and the per-frame read pattern.

`isPlaying` and `showArch` are UI state; they can live in the store or local component state — leaning store for `isPlaying` (audio + visual + header all read it), local `useState` for `showArch`.

## CI plan

`.github/workflows/ci.yml` — triggers: `push` (any branch) and `pull_request` → `main`. Steps: `actions/checkout@v4`, `actions/setup-node@v4` (Node 20, npm cache), `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test -- --run`, `npm run build`. Build artifact validated as part of CI.

## Deploy plan — Google Cloud (recommend Firebase Hosting)

The prompt documented Cloudflare/Railway/GitHub Pages but you chose **Google
Cloud**. For a pure client-side SPA the cleanest GCP path is **Firebase
Hosting** (global CDN, automatic managed TLS, simple custom-domain flow, and a
first-party GitHub Action `FirebaseExtended/action-hosting-deploy`). Plan:

1. `firebase.json` with `"public": "dist"`, SPA rewrite (`** → /index.html`), sensible cache headers; `.firebaserc` with the project id.
2. `npm run build` → `dist/`.
3. `.github/workflows/deploy.yml` on push to `main` (after CI green): checkout, setup-node, `npm ci`, `npm run build`, deploy via the Firebase action using a `FIREBASE_SERVICE_ACCOUNT` repo secret.
4. **DNS for `anneal.averykarlin.org`:** add the domain in Firebase Hosting → it issues a TXT verification record, then an `A` record (and/or `AAAA`) to Firebase's published hosting IPs, or a `CNAME` to the Firebase-provided target. Exact records are generated per-project in the console; documented in README, **no DNS changes made by me.**

Alternatives if you prefer "real" GCP primitives (flagged, your call at Checkpoint 4):

- **GCS bucket + external HTTPS Load Balancer + Cloud CDN** — most "GCP-native", but more infra (managed cert, LB, URL map) and ongoing cost for a static site.
- **Cloud Run** serving `dist/` via a tiny static container (`nginx`/`serve`) — flexible but overkill for a SPA (cold starts, container upkeep).

**Recommendation: Firebase Hosting.** I'll confirm this choice with you again at the start of Checkpoint 4 before writing deploy config.

## Tradeoffs explicitly flagged

1. **Deploy target.** "Google Cloud" is broad; I'm recommending Firebase Hosting over GCS+LB+CDN or Cloud Run. Will reconfirm before Checkpoint 4.
2. **ESLint + Prettier over Biome** — two tools, slightly slower, chosen for `react-hooks` linting and PrismTask parity.
3. **Zustand over Context/prop-drilling** — one extra dependency, justified by per-frame reads and roadmap growth.
4. **Canvas2D over WebGL** for v0.1 — simplest faithful port; WebGL deferred.
5. **`setInterval` drift loop** retained (50 ms) to preserve exact behavior, rather than folding drift into the RAF loop. Keeps audio timing decoupled from frame rate as in the prototype; revisit if it ever competes with the visual loop.
6. **Fonts via `index.html` links** instead of in-JS `@import` — same families, better load behavior; a deliberate (non-silent) change from the prototype.
7. **Volume slider** stays outside the Pitch/Physics/Tone grouping (separate footer control), matching the prototype; `CONTROL_DEFS` will model it distinctly.
8. **License** deferred to Checkpoint 3 (default MIT if you stay silent).

## Out of scope (tracked in ROADMAP, not built now)

Instrument input, session arcs, persistence, sharing/URL-state, auth, pricing,
Android shell, WebGL upgrade, richer synthesis.

---

**STOP — Checkpoint 0 complete.** Awaiting explicit "go" to begin Checkpoint 1
(scaffold). Please also confirm (or redirect) the Firebase Hosting deploy
recommendation and the default MIT license.
