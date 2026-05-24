import type { Arc } from '@/session/types';

/**
 * The preset arcs shipped in v0.4. Numeric `targets` are multipliers on the
 * user's captured start value; `'restoreStart'` eases back to it; `'min'`/`'max'`
 * resolve to a param's bound. See `docs/v0.4-PLAN.md` §3 for the design rationale.
 *
 * Note: both v0.4 engines lock density while playing, so the `density` targets in
 * Dawn/Dusk are dropped at runtime (ArcRunner records a warning); those arcs sweep
 * brightness + spread until an unlocked engine ships.
 */
export const PRESET_ARCS: readonly Arc[] = [
  {
    id: 'bell',
    name: 'Bell Curve',
    description: 'Open, deepen, return.',
    segments: [
      {
        fraction: 0.33,
        curve: 'easeInOut',
        targets: { rootFreq: 0.7, coupling: 1.3, drift: 0.6, space: 1.4 },
      },
      {
        fraction: 0.34,
        curve: 'linear',
        targets: { rootFreq: 0.7, coupling: 1.3, drift: 0.8, space: 1.4 },
      },
      { fraction: 0.33, curve: 'easeInOut', targets: 'restoreStart' },
    ],
  },
  {
    id: 'dawn',
    name: 'Dawn',
    description: 'Sparse and dark, gradually opening.',
    segments: [
      {
        fraction: 1.0,
        curve: 'easeInOut',
        targets: { brightness: 1.6, density: 'max', spread: 1.05 },
      },
    ],
  },
  {
    id: 'dusk',
    name: 'Dusk',
    description: 'Bright and open, gradually closing.',
    segments: [
      {
        fraction: 1.0,
        curve: 'easeInOut',
        targets: { brightness: 0.4, density: 'min', spread: 0.95 },
      },
    ],
  },
];

/** Look up a preset arc by id, or `undefined` if unknown. */
export function getArcById(id: string): Arc | undefined {
  return PRESET_ARCS.find((a) => a.id === id);
}
