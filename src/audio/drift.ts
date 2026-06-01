import type { DriftPartial } from '@/types/audio';
import { clusterCouplingProfile, initKuramoto, kuramotoStep } from './kuramoto';

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
  /**
   * Structured-sync clustering control, `∈ [−1, 1]`. Tilts which frequency band
   * locks via a heterogeneous coupling profile (see `kuramoto.ts`):
   *
   * - **`0` (default / omitted):** homogeneous scalar coupling — bit-identical
   *   to the prior behavior, so drift/detune and the flat-centroid result are
   *   unchanged.
   * - **`> 0`:** the high band locks while the low band stays incoherent, so the
   *   per-partial coherence (and thus the existing fusion gains) tilt the
   *   spectral centroid **up**.
   * - **`< 0`:** the low band locks → centroid tilts **down**.
   *
   * This is the controllable, bypassable knob that turns the existing per-partial
   * fusion model into spectral redistribution. It feeds the unchanged fusion core
   * through the evolved phases — fusion itself is untouched.
   */
  cluster?: number;
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

  // 2. Advance the Kuramoto model by one Euler-Maruyama step. When a clustering
  // bias is set, build a heterogeneous per-partial coupling profile so one
  // frequency band locks while the other stays incoherent (structured sync).
  // cluster = 0 (or undefined) leaves couplingProfile undefined ⇒ scalar K ⇒
  // bit-identical to the prior homogeneous behavior.
  const cluster = params.cluster ?? 0;
  const couplingProfile =
    cluster === 0 ? undefined : clusterCouplingProfile(kPhases.length, cluster);
  const {
    phases: nextPhases,
    r,
    psi,
  } = kuramotoStep(
    { phases: kPhases, naturalFreqs: kNaturalFreqs },
    {
      coupling: params.coupling,
      freqSpread: DEFAULT_FREQ_SPREAD,
      couplingProfile,
    },
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
