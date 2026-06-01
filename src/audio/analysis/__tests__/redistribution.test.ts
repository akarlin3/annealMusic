import { describe, expect, it } from 'vitest';
import {
  clusterCouplingProfile,
  initKuramoto,
  kuramotoStep,
} from '@/audio/kuramoto';
import { applyFusion } from '@/audio/fusion';
import {
  applyHannWindow,
  computeFFTSpectrum,
  getMagnitudeSpectrum,
  spectralCentroid,
} from '@/audio/analysis/spectrum';

/**
 * The make-or-break measurement for **structured-sync spectral redistribution**
 * (see `docs/KURAMOTO.md` §6 and `docs/DSP_THEORY.md`).
 *
 * The prior fusion result (`fusion.test.ts`) showed that *uniform* sync only
 * reinforces energy — the spectral centroid stays flat (539 → 539 Hz) because a
 * scalar global coupling makes every partial's coherence `c_i` near-uniform, so
 * the fusion gains rescale the spectrum uniformly. This suite drives the
 * **unchanged** per-partial fusion model from **structured** sync instead: a
 * heterogeneous coupling profile (`clusterCouplingProfile`) locks one frequency
 * band while the other stays incoherent, so `c_i` correlates with frequency and
 * the fusion gains *redistribute* the spectrum — a measurable centroid shift.
 *
 * Everything runs the real `kuramotoStep` dynamics to steady state under a
 * seeded mulberry32 RNG, then renders the resulting partial bank exactly like
 * `fusion.test.ts` and measures the FFT spectral centroid. Deterministic and
 * offline.
 */

/** Deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SR = 48000;
const F0 = 220; // A3 — same fundamental as the fusion suite
const N = 6; // same partial count as fusion.test.ts (apples-to-apples vs 539 Hz)
const N_SAMPLES = 4096;
const ZERO_PAD = 4; // 4096 * 4 = 16384 (power of two)
const DT = 0.05; // matches the drift-loop step (20 Hz)
const FREQ_SPREAD = 0.5; // the orchestrator's DEFAULT_FREQ_SPREAD
const SETTLE_STEPS = 400; // 20 s of simulated time → steady state
const COUPLING = 0.9; // well above Kc, so the strongly-coupled band locks
const AMOUNT = 1.0; // full fusion — maximal redistribution
const SEEDS = 16; // average over independent incoherent draws for stability

/** Partial frequencies: a harmonic bank f0·{1..N}; index ↔ frequency. */
const FREQS = Array.from({ length: N }, (_, i) => F0 * (i + 1));
/** Meditation-default 1/(i+1) rolloff voicing. */
const BASE_GAINS = Array.from({ length: N }, (_, i) => 1 / (i + 1));

/** Sum of sines with per-partial gains and phases (same as fusion.test.ts). */
function renderAdditive(gains: number[], phases: number[]): Float32Array {
  const out = new Float32Array(N_SAMPLES);
  for (let s = 0; s < N_SAMPLES; s++) {
    const t = s / SR;
    let v = 0;
    for (let i = 0; i < N; i++) {
      v +=
        (gains[i] ?? 0) *
        Math.sin(2 * Math.PI * (FREQS[i] ?? 0) * t + (phases[i] ?? 0));
    }
    out[s] = v;
  }
  return out;
}

function centroidOf(samples: Float32Array): number {
  const windowed = applyHannWindow(samples);
  const { real, imag } = computeFFTSpectrum(windowed, ZERO_PAD);
  const mags = getMagnitudeSpectrum(real, imag);
  return spectralCentroid(mags, SR, N_SAMPLES * ZERO_PAD);
}

/** Advance the real Kuramoto dynamics to steady state with a coupling profile. */
function steadyState(
  cluster: number,
  seed: number,
): { phases: number[]; psi: number } {
  const rng = mulberry32(seed);
  let state = initKuramoto(N, FREQ_SPREAD, rng);
  const couplingProfile =
    cluster === 0 ? undefined : clusterCouplingProfile(N, cluster);
  let last: { phases: number[]; r: number; psi: number } = {
    phases: [...state.phases],
    r: 0,
    psi: 0,
  };
  for (let s = 0; s < SETTLE_STEPS; s++) {
    last = kuramotoStep(
      state,
      { coupling: COUPLING, freqSpread: FREQ_SPREAD, couplingProfile },
      DT,
      rng,
    );
    state = { phases: last.phases, naturalFreqs: state.naturalFreqs };
  }
  return { phases: last.phases, psi: last.psi };
}

/**
 * Mean spectral centroid (Hz) of the fusion-reshaped bank under a clustering
 * bias, averaged over `SEEDS` independent incoherent draws. `amount = 0`
 * bypasses fusion and yields the pre-fusion baseline centroid.
 */
function meanCentroid(cluster: number, amount = AMOUNT): number {
  let sum = 0;
  for (let s = 0; s < SEEDS; s++) {
    const { phases, psi } = steadyState(cluster, 2000 + s);
    const gains = applyFusion(BASE_GAINS, phases, psi, amount);
    sum += centroidOf(renderAdditive([...gains], [...phases]));
  }
  return sum / SEEDS;
}

describe('Structured-Sync Spectral Redistribution', () => {
  // Baseline (no fusion) and homogeneous-coupling references, reused below.
  const baseline = meanCentroid(0, 0); // amount = 0 ⇒ pre-fusion spectrum
  const homogeneous = meanCentroid(0); // uniform sync, full fusion

  it('clustered sync SHIFTS the centroid up when the high band locks (sign matches CP0 prediction)', () => {
    const highLocks = meanCentroid(+1);
    const delta = highLocks - homogeneous;
    // eslint-disable-next-line no-console
    console.log(
      `[REDISTRIBUTION] high band locks: centroid ${homogeneous.toFixed(1)} → ` +
        `${highLocks.toFixed(1)} Hz (Δ = +${delta.toFixed(1)} Hz). ` +
        `Predicted (CP0): rises ~+40 Hz.`,
    );
    // Sign: high partials reinforced ⇒ centroid rises. Measured ≈ +38 Hz.
    expect(delta).toBeGreaterThan(20);
  });

  it('is reversible: locking the low band shifts the centroid the other way', () => {
    const lowLocks = meanCentroid(-1);
    const highLocks = meanCentroid(+1);
    const deltaLow = lowLocks - homogeneous;
    // eslint-disable-next-line no-console
    console.log(
      `[REDISTRIBUTION] low band locks: centroid ${homogeneous.toFixed(1)} → ` +
        `${lowLocks.toFixed(1)} Hz (Δ = ${deltaLow.toFixed(1)} Hz). ` +
        `Reversible span (high−low) = ${(highLocks - lowLocks).toFixed(1)} Hz.`,
    );
    // Low band reinforced ⇒ centroid falls. Measured ≈ −21 Hz.
    expect(deltaLow).toBeLessThan(-8);
    // And the two directions genuinely straddle the unclustered centroid:
    expect(highLocks).toBeGreaterThan(lowLocks + 30);
  });

  it('is specifically from structure: the clustered shift dwarfs the ~0 uniform-sync shift', () => {
    const highLocks = meanCentroid(+1);
    const uniformShift = Math.abs(homogeneous - baseline); // ≈ 0 (prior result)
    const structuredShift = Math.abs(highLocks - baseline);
    // eslint-disable-next-line no-console
    console.log(
      `[REDISTRIBUTION] uniform-sync shift = ${uniformShift.toFixed(1)} Hz; ` +
        `structured-sync shift = ${structuredShift.toFixed(1)} Hz ` +
        `(×${(structuredShift / Math.max(uniformShift, 1e-3)).toFixed(1)} larger).`,
    );
    // Uniform fusion is the established √N reinforcement: centroid ~unchanged.
    expect(uniformShift).toBeLessThan(baseline * 0.02);
    // Structured fusion is categorically larger — the redistribution is real.
    expect(structuredShift).toBeGreaterThan(uniformShift * 5);
    expect(structuredShift).toBeGreaterThan(20);
  });

  it('backward-compat: homogeneous coupling keeps the centroid flat (the honest prior result)', () => {
    // eslint-disable-next-line no-console
    console.log(
      `[REDISTRIBUTION] baseline (no fusion) = ${baseline.toFixed(1)} Hz; ` +
        `homogeneous fusion = ${homogeneous.toFixed(1)} Hz (Δ = ${(homogeneous - baseline).toFixed(1)} Hz).`,
    );
    // With a scalar coupling the centroid is unchanged within 2% — confirming the
    // change is fully opt-in and the prior flat-centroid finding still holds.
    expect(Math.abs(homogeneous - baseline)).toBeLessThan(baseline * 0.02);
  });

  it('is monotone and smooth in the control (bypassable instrument knob, not a binary mode)', () => {
    const sweep = [-1, -0.5, 0, 0.5, 1].map((c) => meanCentroid(c));
    // eslint-disable-next-line no-console
    console.log(
      `[REDISTRIBUTION] cluster sweep [-1..1] → ` +
        sweep.map((c) => `${c.toFixed(1)}`).join(', ') +
        ' Hz.',
    );
    // Non-decreasing across the control range (allowing tiny numerical wobble).
    for (let i = 1; i < sweep.length; i++) {
      expect(sweep[i]!).toBeGreaterThan(sweep[i - 1]! - 2);
    }
  });

  it('is deterministic: identical seeds reproduce identical centroids exactly', () => {
    const { phases: p1, psi: s1 } = steadyState(1, 4242);
    const { phases: p2, psi: s2 } = steadyState(1, 4242);
    expect(p2).toEqual(p1);
    expect(s2).toBe(s1);
    const c1 = centroidOf(
      renderAdditive([...applyFusion(BASE_GAINS, p1, s1, AMOUNT)], [...p1]),
    );
    const c2 = centroidOf(
      renderAdditive([...applyFusion(BASE_GAINS, p2, s2, AMOUNT)], [...p2]),
    );
    expect(c2).toBe(c1);
  });
});
