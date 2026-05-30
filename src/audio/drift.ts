import type { DriftPartial } from '@/types/audio';
import { initKuramoto, kuramotoStep } from './kuramoto';

/** Mean-reversion strength of the Ornstein–Uhlenbeck term. */
const THETA = 0.25;
/** Noise amplitude scale (cents) applied to the `drift` parameter. */
const SIGMA_SCALE = 18;
/** Coupling strength scale applied to the `coupling` parameter for detune. */
const DETUNE_COUPLING_SCALE = 1.8;
/** Detune clamp in cents. */
const DETUNE_CLAMP = 60;
/** Default natural frequency spread for Kuramoto model. */
const DEFAULT_FREQ_SPREAD = 0.5;

export interface DriftParams {
  drift: number;
  coupling: number;
}

export interface DriftStepResult {
  readonly detunes: readonly number[];
  readonly phases: readonly number[];
  readonly r: number;
  readonly psi: number;
}

/**
 * Advance the detune and Kuramoto phases of every partial by one drift step.
 *
 * Combines an Ornstein–Uhlenbeck pull toward 0, a phase-coupled Kuramoto model
 * whose order parameter r maps to a detune contraction pull toward the mean detune,
 * and additive Euler-Maruyama noise.
 *
 * Pure: does not mutate its inputs. `rng` is injected for deterministic tests.
 *
 * @returns the new detunes (cents), evolved phases, and order parameter r/psi.
 */
export function driftStep(
  partials: readonly DriftPartial[],
  params: DriftParams,
  dt: number,
  rng: () => number,
): DriftStepResult {
  if (partials.length === 0) {
    return { detunes: [], phases: [], r: 0, psi: 0 };
  }

  // 1. Initialize Kuramoto phases and natural frequencies if they are missing
  const hasKuramotoState = partials.every(
    (p) => p.phase !== undefined && p.naturalFreq !== undefined,
  );
  let kPhases: number[];
  let kNaturalFreqs: number[];

  if (hasKuramotoState) {
    kPhases = partials.map((p) => p.phase!);
    kNaturalFreqs = partials.map((p) => p.naturalFreq!);
  } else {
    // Graceful initialization/fallback (preserves simple test paths)
    const initial = initKuramoto(partials.length, DEFAULT_FREQ_SPREAD, rng);
    kPhases = [...initial.phases];
    kNaturalFreqs = [...initial.naturalFreqs];
  }

  // 2. Advance the Kuramoto model by one Euler-Maruyama step
  const {
    phases: nextPhases,
    r,
    psi,
  } = kuramotoStep(
    { phases: kPhases, naturalFreqs: kNaturalFreqs },
    { coupling: params.coupling, freqSpread: DEFAULT_FREQ_SPREAD },
    dt,
    rng,
  );

  // 3. Compute detunes using Ornstein–Uhlenbeck + Detune Contraction + Noise
  const mean = partials.reduce((s, p) => s + p.detune, 0) / partials.length;
  const sigma = params.drift * SIGMA_SCALE;
  const k = params.coupling * DETUNE_COUPLING_SCALE;

  const detunes = partials.map((p) => {
    const ou = -THETA * p.detune * dt;
    // Detune pull towards the mean is scaled by Kuramoto's order parameter r
    const couple = k * r * (mean - p.detune) * dt;
    const noise = sigma * (rng() - 0.5) * Math.sqrt(dt);
    let next = p.detune + ou + couple + noise;
    if (next > DETUNE_CLAMP) next = DETUNE_CLAMP;
    if (next < -DETUNE_CLAMP) next = -DETUNE_CLAMP;
    return next;
  });

  return { detunes, phases: nextPhases, r, psi };
}
