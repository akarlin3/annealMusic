# AnnealMusic

A generative ambient meditation sandbox: coupled oscillators drift over a harmonic lattice while you sculpt the field. Physics-driven sound, audio-reactive visuals.

## Tech stack

- **React 18** + **TypeScript** (strict, `noUncheckedIndexedAccess`)
- **Vite 5** build / dev server
- **Tailwind CSS 3**
- **Zustand** for the parameter store
- **Web Audio API** for synthesis (coupled sine bank + Ornstein–Uhlenbeck drift)
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
  audio/       # Web Audio engine, drift loop, IR generation
  components/  # Visualizer, ControlPanel, ArchitectureDiagram
  hooks/       # useAnnealMusic (orchestration), useAudioEngine
  state/       # param store, defaults, control schema
  visual/      # canvas draw loop, palette, math helpers
  pages/       # App
  styles/      # global css + slider styles
  types/       # shared types
  test/        # vitest setup
docs/          # INIT_PLAN, ROADMAP, COMPAT, prototype reference
```

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
