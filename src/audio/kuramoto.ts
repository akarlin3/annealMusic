export interface KuramotoState {
  readonly phases: readonly number[];
  readonly naturalFreqs: readonly number[];
}

export interface KuramotoParams {
  coupling: number;
  freqSpread: number;
  /**
   * Optional **per-partial coupling profile** — a heterogeneous-coupling vector
   * `p_i` that scales how strongly oscillator `i` is pulled toward the
   * collective mean field. The effective per-partial coupling becomes
   * `K_i = coupling · COUPLING_SCALE · p_i`, so the drift term is
   * `ω_i + (K_i/N)·Σ_j sin(θ_j − θ_i)`.
   *
   * - **Omitted / all entries `1`:** every `K_i` equals the scalar
   *   `K = coupling · COUPLING_SCALE` — **bit-identical to the homogeneous
   *   model** (`p_i = 1` multiplies `K` by exactly `1.0` in IEEE-754).
   * - **Graded (e.g. high band `1`, low band `→0`):** the strongly-coupled band
   *   locks to the mean field while the weakly-coupled band keeps drifting at
   *   its natural frequency — so the order parameter's per-partial coherence
   *   `c_i` correlates with frequency. This is the structured-sync capability
   *   that drives spectral redistribution (see `docs/KURAMOTO.md` §6).
   *
   * Indexed by partial position; entries beyond the partial count are ignored
   * and missing entries default to `1`.
   */
  couplingProfile?: readonly number[];
}

/** Coupling strength scale. Sweeps from incoherent (< Kc) to locked (> Kc) */
export const COUPLING_SCALE = 4.0;

/** Small phase-noise amplitude to keep the transition smooth (Euler–Maruyama) */
export const NOISE_SIGMA = 0.15;

/**
 * Build a **clustered coupling profile** from a single continuous control.
 *
 * `bias ∈ [−1, 1]` tilts which frequency band locks, as a smooth linear ramp in
 * normalized partial index `x_i = i/(N−1) ∈ [0, 1]` (low index = low frequency):
 *
 * - **`bias = 0`:** every entry is exactly `1` → homogeneous (current behavior).
 * - **`bias > 0` (favor the high band):** `p_i = 1 − bias·(1 − x_i)` — the
 *   highest partial keeps full coupling (`1`) and the lowest drops to `1 − bias`.
 *   The high band locks, the low band drifts → centroid **rises**.
 * - **`bias < 0` (favor the low band):** `p_i = 1 − |bias|·x_i` — mirror image →
 *   centroid **falls**.
 *
 * The ramp is continuous in both `i` and `bias`, so the resulting centroid shift
 * is a smooth, bypassable control rather than a binary mode. `bias` is clamped
 * to `[−1, 1]`; `p_i` therefore stays in `[0, 1]` (never amplifies coupling).
 */
export function clusterCouplingProfile(n: number, bias: number): number[] {
  const b = bias < -1 ? -1 : bias > 1 ? 1 : bias;
  if (n <= 1 || b === 0) return Array.from({ length: n }, () => 1);
  return Array.from({ length: n }, (_, i) => {
    const x = i / (n - 1); // 0 (lowest freq) … 1 (highest freq)
    return b > 0 ? 1 - b * (1 - x) : 1 - -b * x;
  });
}

/**
 * Initialize the Kuramoto state.
 * Seeds phases uniformly on the circle and natural frequencies from a symmetric spread.
 */
export function initKuramoto(
  n: number,
  freqSpread: number,
  rng: () => number,
): KuramotoState {
  const phases = Array.from({ length: n }, () => rng() * Math.PI * 2);
  const naturalFreqs = Array.from({ length: n }, (_, i) => {
    if (n <= 1) return 0;
    // Symmetrically spread from -freqSpread to +freqSpread
    return freqSpread * (-1 + (2 * i) / (n - 1));
  });
  return { phases, naturalFreqs };
}

/**
 * Advance the Kuramoto phases by one step using Euler–Maruyama integration.
 * Pure: does not mutate the input state.
 */
export function kuramotoStep(
  state: KuramotoState,
  params: KuramotoParams,
  dt: number,
  rng: () => number,
): { phases: number[]; r: number; psi: number } {
  const n = state.phases.length;
  if (n === 0) {
    return { phases: [], r: 0, psi: 0 };
  }

  const K = params.coupling * COUPLING_SCALE;
  const profile = params.couplingProfile;
  const nextPhases: number[] = [];

  for (let i = 0; i < n; i++) {
    const theta_i = state.phases[i]!;
    const omega_i = state.naturalFreqs[i]!;

    let sum = 0;
    for (let j = 0; j < n; j++) {
      sum += Math.sin(state.phases[j]! - theta_i);
    }

    // Heterogeneous coupling: each oscillator feels K_i = K · p_i toward the
    // mean field. With no profile (or p_i = 1) this is exactly the scalar K,
    // bit-identical to the homogeneous model.
    const K_i = profile === undefined ? K : K * (profile[i] ?? 1);
    const driftTerm = omega_i + (K_i / n) * sum;
    const noiseTerm = NOISE_SIGMA * (rng() - 0.5) * Math.sqrt(dt);

    let nextTheta = theta_i + driftTerm * dt + noiseTerm;

    // Wrap phases to [0, 2π)
    nextTheta = ((nextTheta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    nextPhases.push(nextTheta);
  }

  // Compute complex order parameter: r * e^(i * psi) = (1/N) * sum(e^(i * theta))
  let sumCos = 0;
  let sumSin = 0;
  for (let i = 0; i < n; i++) {
    sumCos += Math.cos(nextPhases[i]!);
    sumSin += Math.sin(nextPhases[i]!);
  }

  const meanCos = sumCos / n;
  const meanSin = sumSin / n;

  const r = Math.sqrt(meanCos * meanCos + meanSin * meanSin);
  let psi = Math.atan2(meanSin, meanCos);
  if (psi < 0) psi += 2 * Math.PI;

  return { phases: nextPhases, r, psi };
}
