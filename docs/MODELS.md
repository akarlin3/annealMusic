# Physical Modeling (v1.0)

The fourth engine (`e=physical`) synthesizes sound from physical models rather
than spectra. Three sub-models, selected by `ph.model`: **string**, **tube**,
**plate**. All are **continuously excited** — fed a steady stream of filtered
noise rather than a single pluck/strike — so they sustain for ambient use
instead of decaying like a struck note. That excitation pivot is the whole
reason physical modeling fits Anneal Ambiance.

## Architecture

- **Pure DSP** (`src/audio/engines/physical-dsp/`): plain TypeScript classes,
  no Web Audio or worklet globals. These are the single source of truth and are
  unit-tested directly (`dsp.test.ts`).
- **Worklet wrappers** (`src/audio/engines/physical-worklets/`): thin
  `AudioWorkletProcessor`s that marshal k-rate AudioParams into the DSP classes
  and pull samples. Bundled by `vite.worklet.config.ts` into one self-contained
  classic script at `public/worklets/physical.js` (Vite has no native
  AudioWorklet support, and a classic script loads in every browser).
- **`PhysicalEngine`** (`physical.ts`): one worklet node per partial over the
  harmonic lattice, summed into one output gain. Worklet modules register lazily
  on first physical select. Node creation goes through an injectable factory so
  the engine is unit-testable without a real worklet.

## Sub-models

### String — `KarplusStrong`

A proper digital waveguide w/ 3rd-order Lagrange fractional-delay loop and exact loop phase-delay compensation. Continuous filtered-noise injection replaces the classic single pluck, giving a bowed/aeolian sustain. `damping` → feedback gain (decay/Q); `brightness` → loop low-pass cutoff + excitation color. Yields sub-cent tuning accuracy across the entire frequency range.
Refs: Karplus & Strong (1983); Jaffe & Smith (1983, extensions); Smith (fractional delay).

### Tube — `Waveguide`

A cylindrical bidirectional delay (two rails) with a closed-end inverting
reflection and a memoryless Smith-style reed at the mouth: a breath pressure
(continuous excitation) drives the pressure difference through a soft,
stiffness-gated reed. `damping` → bore loss; `brightness` → bore/breath color;
`ph.reed` → reed stiffness.
Ref: Julius O. Smith, _Physical Audio Signal Processing_ (CCRMA) — digital
waveguide woodwind/clarinet models.

### Plate — `ModalBank`

A bank of ~20 bandpass biquad resonators tuned to a stretched plate
eigenfrequency series `f0·sqrt(1 + B·n²)`, excited by continuous noise.
`damping` → mode Q (ring time); `brightness` → per-mode rolloff; `ph.inharm` →
inharmonicity `B`.
Ref: modal synthesis; plate eigenfrequency stretching after Chaigne & Lambourg
(distribution only — this is a perceptual model, not a PDE solve).

## CPU budget & fallback

Worst case is plate: 20 modes × 8 partials = 160 biquads. If the platform has
no AudioWorklet, `PhysicalEngine.start` throws `PhysicalUnsupportedError`; the
orchestrator refuses the engine swap and surfaces a toast (never a silent
failure). The plate mode count (`PLATE_MODES = 20`) is a single constant the
build can lower for weak devices.

## Parameters (`ph.*`, URL schema v6)

| Key                  | Range                     | Effect                               |
| -------------------- | ------------------------- | ------------------------------------ |
| `ph.model`           | 0=string, 1=tube, 2=plate | sub-model (rebuilds voices)          |
| `ph.excitationLevel` | 0–1                       | noise-injection drive                |
| `ph.damping`         | 0–1                       | feedback gain / mode Q               |
| `ph.brightness`      | 0–1                       | excitation + loop/bore filter cutoff |
| `ph.reed`            | 0–1                       | tube reed stiffness                  |
| `ph.inharm`          | 0–1                       | plate eigenfrequency inharmonicity   |

Server-side preview rendering (v0.8, Playwright/Chromium) supports module
worklets natively, so physical patches render server-side with no polyfill.
