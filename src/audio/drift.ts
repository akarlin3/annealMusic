import type { DriftPartial } from '@/types/audio';

/** Mean-reversion strength of the Ornstein–Uhlenbeck term. */
const THETA = 0.25;
/** Noise amplitude scale (cents) applied to the `drift` parameter. */
const SIGMA_SCALE = 18;
/** Coupling strength scale applied to the `coupling` parameter. */
const COUPLING_SCALE = 0.9;
/** Detune clamp in cents. */
const DETUNE_CLAMP = 60;

export interface DriftParams {
  drift: number;
  coupling: number;
}

/**
 * Advance the detune of every partial by one drift step.
 *
 * Combines an Ornstein–Uhlenbeck pull toward 0, a Kuramoto-style pull toward
 * the partials' mean detune (coupling), and additive scaled noise. Pure: does
 * not mutate its inputs. `rng` is injected so the step is deterministic under
 * test.
 *
 * @returns the new detune (cents) for each partial, in input order.
 */
export function driftStep(
  partials: readonly DriftPartial[],
  params: DriftParams,
  dt: number,
  rng: () => number,
): number[] {
  if (partials.length === 0) return [];

  const mean = partials.reduce((s, p) => s + p.detune, 0) / partials.length;
  const sigma = params.drift * SIGMA_SCALE;
  const k = params.coupling * COUPLING_SCALE;

  return partials.map((p) => {
    const ou = -THETA * p.detune * dt;
    const couple = k * (mean - p.detune) * dt;
    const noise = sigma * (rng() - 0.5) * Math.sqrt(dt);
    let next = p.detune + ou + couple + noise;
    if (next > DETUNE_CLAMP) next = DETUNE_CLAMP;
    if (next < -DETUNE_CLAMP) next = -DETUNE_CLAMP;
    return next;
  });
}
