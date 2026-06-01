import { describe, expect, it } from 'vitest';
import { clusterCouplingProfile, initKuramoto, kuramotoStep } from './kuramoto';

/** Deterministic PRNG (mulberry32) for reproducible noise under test. */
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

const DT = 0.05;

describe('Kuramoto Model core step', () => {
  it('is completely deterministic with a seeded PRNG', () => {
    const rng1 = mulberry32(123);
    const rng2 = mulberry32(123);

    const s1 = initKuramoto(8, 0.5, rng1);
    const s2 = initKuramoto(8, 0.5, rng2);

    expect(s1.phases).toEqual(s2.phases);
    expect(s1.naturalFreqs).toEqual(s2.naturalFreqs);

    const p = { coupling: 0.8, freqSpread: 0.5 };
    const step1 = kuramotoStep(s1, p, DT, rng1);
    const step2 = kuramotoStep(s2, p, DT, rng2);

    expect(step1.phases).toEqual(step2.phases);
    expect(step1.r).toBeCloseTo(step2.r, 8);
    expect(step1.psi).toBeCloseTo(step2.psi, 8);
  });

  it('preserves the purity of input state (no mutation)', () => {
    const rng = mulberry32(42);
    const state = initKuramoto(6, 0.5, rng);
    const originalPhases = [...state.phases];

    kuramotoStep(state, { coupling: 0.5, freqSpread: 0.5 }, DT, rng);

    expect(state.phases).toEqual(originalPhases);
  });

  it('exhibits low order parameter r (incoherence) below the critical coupling', () => {
    const rng = mulberry32(999);
    // 10 oscillators, low coupling (below Kc)
    let state = initKuramoto(10, 0.5, rng);
    const params = { coupling: 0.05, freqSpread: 0.5 };

    let rSum = 0;
    const steps = 200;
    const recordStart = 100;

    for (let i = 0; i < steps; i++) {
      const res = kuramotoStep(state, params, DT, rng);
      state = { phases: res.phases, naturalFreqs: state.naturalFreqs };
      if (i >= recordStart) {
        rSum += res.r;
      }
    }

    const avgR = rSum / (steps - recordStart);
    // Below Kc, phase synchronization should remain incoherent (average r is low)
    expect(avgR).toBeLessThan(0.35);
  });

  it('exhibits high order parameter r (synchronization) above the critical coupling', () => {
    const rng = mulberry32(999);
    // 10 oscillators, high coupling (above Kc)
    let state = initKuramoto(10, 0.5, rng);
    const params = { coupling: 0.9, freqSpread: 0.5 };

    let rSum = 0;
    const steps = 200;
    const recordStart = 100;

    for (let i = 0; i < steps; i++) {
      const res = kuramotoStep(state, params, DT, rng);
      state = { phases: res.phases, naturalFreqs: state.naturalFreqs };
      if (i >= recordStart) {
        rSum += res.r;
      }
    }

    const avgR = rSum / (steps - recordStart);
    // Above Kc, phase synchronization should lock tightly (average r is high)
    expect(avgR).toBeGreaterThan(0.75);
  });

  it('exhibits a monotonic-ish transition between low and high coupling', () => {
    const getAvgR = (coupling: number): number => {
      const rng = mulberry32(111);
      let state = initKuramoto(8, 0.5, rng);
      const params = { coupling, freqSpread: 0.5 };

      let rSum = 0;
      const steps = 150;
      const recordStart = 75;

      for (let i = 0; i < steps; i++) {
        const res = kuramotoStep(state, params, DT, rng);
        state = { phases: res.phases, naturalFreqs: state.naturalFreqs };
        if (i >= recordStart) {
          rSum += res.r;
        }
      }
      return rSum / (steps - recordStart);
    };

    const rLow = getAvgR(0.05);
    const rHigh = getAvgR(0.9);

    expect(rHigh).toBeGreaterThan(rLow);
  });
});

describe('Heterogeneous (structured) coupling', () => {
  it('is exactly backward-compatible: an all-ones couplingProfile is bit-identical to the scalar model', () => {
    const rng1 = mulberry32(2024);
    const rng2 = mulberry32(2024);
    let scalar = initKuramoto(8, 0.5, rng1);
    let profiled = initKuramoto(8, 0.5, rng2);
    expect(scalar.phases).toEqual(profiled.phases);

    const ones = new Array(8).fill(1);
    // Drive both with identical noise streams; only the param shape differs.
    for (let step = 0; step < 50; step++) {
      const a = kuramotoStep(
        scalar,
        { coupling: 0.7, freqSpread: 0.5 },
        DT,
        rng1,
      );
      const b = kuramotoStep(
        profiled,
        { coupling: 0.7, freqSpread: 0.5, couplingProfile: ones },
        DT,
        rng2,
      );
      // Bit-identical, not merely close: p_i = 1 multiplies K by exactly 1.0.
      expect(b.phases).toEqual(a.phases);
      expect(b.r).toBe(a.r);
      expect(b.psi).toBe(a.psi);
      scalar = { phases: a.phases, naturalFreqs: scalar.naturalFreqs };
      profiled = { phases: b.phases, naturalFreqs: profiled.naturalFreqs };
    }
  });

  it('clusterCouplingProfile: bias 0 is all ones, bias>0 favors the high band, clamped to [-1,1]', () => {
    const n = 6;
    expect(clusterCouplingProfile(n, 0)).toEqual(new Array(n).fill(1));

    const hi = clusterCouplingProfile(n, 1);
    // Highest partial keeps full coupling; lowest drops to 1 - bias = 0.
    expect(hi[n - 1]).toBeCloseTo(1, 12);
    expect(hi[0]).toBeCloseTo(0, 12);
    // Monotonically non-decreasing in index (a smooth ramp).
    for (let i = 1; i < n; i++)
      expect(hi[i]!).toBeGreaterThan(hi[i - 1]! - 1e-12);

    const lo = clusterCouplingProfile(n, -1);
    // Mirror image: lowest keeps full coupling, highest drops to 0.
    expect(lo[0]).toBeCloseTo(1, 12);
    expect(lo[n - 1]).toBeCloseTo(0, 12);

    // Clamping: |bias| > 1 saturates rather than producing negative coupling.
    expect(clusterCouplingProfile(n, 5)).toEqual(clusterCouplingProfile(n, 1));
    for (const p of clusterCouplingProfile(n, 0.9)) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it('a graded coupling profile makes one band lock while the other stays incoherent', () => {
    // High band strongly coupled, low band decoupled → per-band coherence splits.
    const n = 8;
    const rng = mulberry32(7);
    let state = initKuramoto(n, 0.6, rng);
    const profile = clusterCouplingProfile(n, 1); // favor high band

    // Settle to steady state.
    for (let step = 0; step < 300; step++) {
      const res = kuramotoStep(
        state,
        { coupling: 0.9, freqSpread: 0.6, couplingProfile: profile },
        DT,
        rng,
      );
      state = { phases: res.phases, naturalFreqs: state.naturalFreqs };
    }

    // Coherence of each partial with the global mean phase ψ.
    const { psi } = kuramotoStep(
      state,
      { coupling: 0.9, freqSpread: 0.6, couplingProfile: profile },
      DT,
      rng,
    );
    const coh = state.phases.map((t) => 0.5 * (1 + Math.cos(t - psi)));
    const mid = n / 2;
    const lowMean = coh.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const highMean = coh.slice(mid).reduce((a, b) => a + b, 0) / mid;

    // The strongly-coupled high band is more coherent than the decoupled low band.
    expect(highMean).toBeGreaterThan(lowMean);
  });
});
