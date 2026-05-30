export interface KuramotoState {
  readonly phases: readonly number[];
  readonly naturalFreqs: readonly number[];
}

export interface KuramotoParams {
  coupling: number;
  freqSpread: number;
}

/** Coupling strength scale. Sweeps from incoherent (< Kc) to locked (> Kc) */
export const COUPLING_SCALE = 4.0;

/** Small phase-noise amplitude to keep the transition smooth (Euler–Maruyama) */
export const NOISE_SIGMA = 0.15;

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
  const nextPhases: number[] = [];

  for (let i = 0; i < n; i++) {
    const theta_i = state.phases[i]!;
    const omega_i = state.naturalFreqs[i]!;

    let sum = 0;
    for (let j = 0; j < n; j++) {
      sum += Math.sin(state.phases[j]! - theta_i);
    }

    const driftTerm = omega_i + (K / n) * sum;
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
