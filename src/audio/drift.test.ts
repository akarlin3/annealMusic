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
      const next = driftStep(partials, params, DT, noNoise);
      partials = partials.map((p, idx) => ({ ...p, detune: next[idx]! }));
    }

    const end = partials[0]!.detune;
    expect(Math.abs(end)).toBeLessThan(Math.abs(start));
    expect(Math.abs(end)).toBeLessThan(0.01);
  });

  it('reverts symmetrically from a negative perturbation', () => {
    const params: DriftParams = { drift: 0, coupling: 0 };
    let partials: DriftPartial[] = [{ ratio: 1, detune: -40 }];
    for (let i = 0; i < 2000; i++) {
      const next = driftStep(partials, params, DT, noNoise);
      partials = partials.map((p, idx) => ({ ...p, detune: next[idx]! }));
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
        const next = driftStep(partials, params, DT, noNoise);
        partials = partials.map((p, idx) => ({ ...p, detune: next[idx]! }));
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
    const next = driftStep(partials, { drift: 1, coupling: 0 }, DT, () => 1);
    expect(next).toHaveLength(2);
    for (const d of next) {
      expect(d).toBeGreaterThanOrEqual(-60);
      expect(d).toBeLessThanOrEqual(60);
    }
  });
});
