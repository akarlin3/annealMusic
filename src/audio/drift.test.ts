import { describe, expect, it } from 'vitest';
import { driftStep, type DriftParams } from '@/audio/drift';
import type { DriftPartial } from '@/types/audio';

/** Deterministic PRNG (mulberry32) for reproducible noise. */
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

function variance(values: number[]): number {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
}

const DT = 0.05;
const noNoise = () => 0.5; // makes the noise term exactly zero

describe('driftStep — mean reversion', () => {
  it('drives a perturbed partial back toward zero over many steps', () => {
    const params: DriftParams = { drift: 0, coupling: 0 };
    let partials: DriftPartial[] = [{ ratio: 1, detune: 50 }];

    const start = partials[0]!.detune;
    for (let i = 0; i < 2000; i++) {
      const { detunes, phases } = driftStep(partials, params, DT, noNoise);
      partials = partials.map((p, idx) => ({
        ...p,
        detune: detunes[idx]!,
        phase: phases[idx],
      }));
    }

    const end = partials[0]!.detune;
    expect(Math.abs(end)).toBeLessThan(Math.abs(start));
    expect(Math.abs(end)).toBeLessThan(0.01);
  });

  it('reverts symmetrically from a negative perturbation', () => {
    const params: DriftParams = { drift: 0, coupling: 0 };
    let partials: DriftPartial[] = [{ ratio: 1, detune: -40 }];
    for (let i = 0; i < 2000; i++) {
      const { detunes, phases } = driftStep(partials, params, DT, noNoise);
      partials = partials.map((p, idx) => ({
        ...p,
        detune: detunes[idx]!,
        phase: phases[idx],
      }));
    }
    expect(Math.abs(partials[0]!.detune)).toBeLessThan(0.01);
  });
});

describe('driftStep — coupling', () => {
  it('reduces variance across partials faster with coupling on', () => {
    const initial: DriftPartial[] = [
      { ratio: 1, detune: 50 },
      { ratio: 1.5, detune: 30 },
      { ratio: 2, detune: 10 },
      { ratio: 2.5, detune: -10 },
    ];

    const run = (coupling: number): number => {
      let partials = initial.map((p) => ({ ...p }));
      const params: DriftParams = { drift: 0, coupling };
      for (let i = 0; i < 50; i++) {
        const { detunes, phases } = driftStep(partials, params, DT, noNoise);
        partials = partials.map((p, idx) => ({
          ...p,
          detune: detunes[idx]!,
          phase: phases[idx],
        }));
      }
      return variance(partials.map((p) => p.detune));
    };

    const coupled = run(0.9);
    const uncoupled = run(0);
    expect(coupled).toBeLessThan(uncoupled);
  });
});

describe('driftStep — purity', () => {
  it('does not mutate its input partials', () => {
    const partials: DriftPartial[] = [{ ratio: 1, detune: 12 }];
    const rng = mulberry32(42);
    driftStep(partials, { drift: 0.5, coupling: 0.3 }, DT, rng);
    expect(partials[0]!.detune).toBe(12);
  });

  it('returns one detune per partial and respects the ±60 clamp', () => {
    const partials: DriftPartial[] = [
      { ratio: 1, detune: 59 },
      { ratio: 2, detune: -59 },
    ];
    // Large drift + extreme rng pushes past the clamp in a single step.
    const { detunes } = driftStep(
      partials,
      { drift: 1, coupling: 0 },
      DT,
      () => 1,
    );
    expect(detunes).toHaveLength(2);
    for (const d of detunes) {
      expect(d).toBeGreaterThanOrEqual(-60);
      expect(d).toBeLessThanOrEqual(60);
    }
  });
});

describe('driftStep — reduction / fallback', () => {
  it('reduces to the standard uncoupled drift at coupling = 0', () => {
    const partials: DriftPartial[] = [
      { ratio: 1, detune: 30 },
      { ratio: 2, detune: -10 },
    ];
    const rng = mulberry32(12345);

    // Compute detune walk with coupling = 0
    const { detunes } = driftStep(
      partials,
      { drift: 0.8, coupling: 0 },
      DT,
      rng,
    );

    // Direct manual computation of OU + Noise (since couple term is 0)
    const THETA = 0.25;
    const SIGMA_SCALE = 18;
    const rngManual = mulberry32(12345);
    // consume initial phase generation in fallback path + phase noise step so seeds match
    rngManual();
    rngManual(); // fallback init seeds 2 phases
    rngManual();
    rngManual(); // phase noise step seeds 2 updates

    const expected = partials.map((p) => {
      const ou = -THETA * p.detune * DT;
      const noise = 0.8 * SIGMA_SCALE * (rngManual() - 0.5) * Math.sqrt(DT);
      return p.detune + ou + noise;
    });

    expect(detunes[0]).toBeCloseTo(expected[0]!, 8);
    expect(detunes[1]).toBeCloseTo(expected[1]!, 8);
  });
});

describe('driftStep — stationary OU variance', () => {
  it('converges to the analytic stationary variance sigma^2 / (24 * theta)', () => {
    // For drift = 0.5 (sigma = 9), theta = 0.25, DT = 0.05
    // Analytic variance is sigma^2 / (24 * theta) = 81 / (24 * 0.25) = 81 / 6 = 13.5
    const params = { drift: 0.5, coupling: 0 };
    let partials = [{ ratio: 1.0, detune: 0.0 }];
    const rng = mulberry32(8888);

    const history: number[] = [];
    const warmUpSteps = 1000;
    const measurementSteps = 3000;

    for (let i = 0; i < warmUpSteps + measurementSteps; i++) {
      const { detunes } = driftStep(partials, params, DT, rng);
      const nextDetune = detunes[0] ?? 0;
      partials = [{ ratio: 1.0, detune: nextDetune }];
      if (i >= warmUpSteps) {
        history.push(nextDetune);
      }
    }

    // Calculate empirical variance
    const mean = history.reduce((s, v) => s + v, 0) / history.length;
    const empiricalVariance =
      history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length;

    console.log(
      `[OU PHYSICS ASSERTION] Empirical Variance: ${empiricalVariance.toFixed(4)} cents^2, Analytical Variance: 13.5 cents^2`,
    );

    // Empirical variance on a finite 3000 step seeded run should be very close to 13.5
    expect(empiricalVariance).toBeCloseTo(13.5, 0); // tolerance of 0.5 cents^2 is highly robust
  });
});
