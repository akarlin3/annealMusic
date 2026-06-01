# Anneal — design prototype

This is the handoff from [Claude Design](https://claude.ai/design) for the
**Anneal** concept: a single connected, interactive prototype that gives a face
to the AnnealMusic codebase across all of its surfaces. It is a faithful,
pixel-level mockup built on the project's real design system — the three voices
(Meditation / Musician / Researcher), the warm-amber-on-near-black palette,
Instrument Serif / Geist / Geist Mono type, and the "Calm by Design" philosophy.

> **Status: design prototype, not production code.** The production app already
> implements these features in `src/` (React + TypeScript + Vite). This bundle
> is the visual/interaction reference to port from incrementally — keep it out
> of the production build.

## What's here

- **`Anneal.html`** — the runnable, self-contained prototype. All styles and all
  22 React modules are inlined into one file. Open it via any static server (or
  directly) and it boots React 18 + Babel-standalone from CDN, then mounts the
  full app.
- **`src/`** — the original, unbundled modules, kept for readability and porting.
  They are plain `text/babel` classic scripts that share global scope and load in
  a fixed order (see the script list at the bottom of the original shell). They
  are the source `Anneal.html` was assembled from.

## Run it

It needs a static server (the CDN scripts and inlined Babel compile at runtime;
a server avoids `file://` fetch restrictions):

```sh
npx serve prototypes/anneal
# then open the printed URL and load /Anneal.html
```

or any equivalent (`python3 -m http.server`, etc.). An internet connection is
required so the React and Babel CDN scripts can load.

## The surfaces

One shared generative engine and the three live-switchable voices run beneath
fourteen surfaces:

- **Practice** — Onboarding, Listen (Sculpt + Perform tools), Breathe, Attune (biofeedback)
- **Create** — Sounds (patch bank + AI generation + save + export), the Perform loop pedal & live input
- **Discover** — Library (editorial), Gallery (community + embed + report)
- **Reflect & learn** — History, Learn (lesson player)
- **Research** — consent-gated experiment runner + datalogger
- **Account** — Settings (Health sync, hints, CSV export), plus Embed and Export dialogs

### Notes
- Audio starts on the first **Begin** click (browsers require a user gesture).
- The canvas visualizer animates only when the tab is in the foreground.
- Reduced-motion is fully honored; the Tweaks panel (gear, top-right) adjusts
  voice, field intensity, accent hue, type scale, density, and the calm toggles.

## How it maps to the codebase

Each surface mirrors a system that already exists under `src/` — e.g. the
synthesis engines (`docs/MODELS.md`), biofeedback (`docs/BIOFEEDBACK.md`), the
experiment runner, the gallery, the loop pedal, the embeddable player, and the
Health-sync settings. Use this prototype as the target when bringing those
surfaces up to the Anneal visual language.
