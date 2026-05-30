import { describe, expect, it } from 'vitest';
import { initKuramoto, kuramotoStep } from './kuramoto';

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
