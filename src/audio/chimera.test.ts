import { describe, expect, it } from 'vitest';
import {
  chimeraStep,
  chimeraSplit,
  intensityToA,
  isChimeraAlive,
  lockedPopulation,
  orderParam,
  seedChimera,
  DEFAULT_BETA,
  SYNC_HI,
  INCOH_LO,
} from '@/audio/chimera';

/**
 * Unit proof for the pure two-population chimera core (`src/audio/chimera.ts`).
 *
 * The reference numbers are extracted from the verified Build-B probe
 * (`examples/probes/chimera_probe.mjs`) for the canonical regime
 * Np=64, A=0.5, β=0.02, seed=9000 — i.e. this asserts the production port
 * reproduces the probe's r/split bit-for-bit (it uses the same mulberry32 seed,
 * the same RK4 mean-field step, and the same order-parameter math). The probe
 * stays the offline reference; this is the in-tree regression lock.
 */

/** Verbatim mulberry32 — the probe's PRNG, so seeds map to identical draws. */
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

const Np = 64;
const A = 0.5;
const BETA = 0.02;
const DT = 0.05; // 20 Hz control rate, matches the probe and the drift loop

const params = { Np, A, beta: BETA };

/** Run `steps` RK4 steps from `phases`, returning the final state. */
function advance(phases: number[], steps: number): number[] {
  let p = phases;
  for (let s = 0; s < steps; s++) p = chimeraStep(p, params, DT).phases;
  return p;
}

describe('chimera: canonical seed', () => {
  it('seeds pop1 as a tight synchronized cluster and pop2 incoherent', () => {
    const p = seedChimera(Np, mulberry32(9000));
    expect(p.length).toBe(2 * Np);
    const pop1 = orderParam(p, 0, Np);
    const pop2 = orderParam(p, Np, Np);
    // Verified probe reference (seed=9000): pop1 ~1, pop2 incoherent.
    expect(pop1.R).toBeCloseTo(0.9976840838, 8);
    expect(pop2.R).toBeCloseTo(0.1076867434, 8);
    expect(pop1.R).toBeGreaterThan(SYNC_HI);
    expect(pop2.R).toBeLessThan(INCOH_LO);
  });

  it('is deterministic under the injected rng (same seed → identical phases)', () => {
    const a = seedChimera(Np, mulberry32(42));
    const b = seedChimera(Np, mulberry32(42));
    expect(a).toEqual(b);
  });
});

describe('chimera: step reproduces the probe', () => {
  it('matches the probe order parameters after the 12 s transient', () => {
    const seeded = seedChimera(Np, mulberry32(9000));
    const p = advance(seeded, 240); // 12 s @ dt=0.05
    const pop1 = orderParam(p, 0, Np);
    const pop2 = orderParam(p, Np, Np);
    // Verified probe reference numbers (extracted from chimera_probe math).
    expect(pop1.R).toBeCloseTo(0.9946941106, 8);
    expect(pop1.Phi).toBeCloseTo(2.5266518582, 6);
    expect(pop2.R).toBeCloseTo(0.643887316, 8);
    expect(pop2.Phi).toBeCloseTo(2.7565730098, 6);
  });

  it('chimeraStep is pure (does not mutate its input)', () => {
    const p = seedChimera(Np, mulberry32(1));
    const before = [...p];
    chimeraStep(p, params, DT);
    expect(p).toEqual(before);
  });

  it('the step also returns the two populations order parameters directly', () => {
    const p = seedChimera(Np, mulberry32(9000));
    const step = chimeraStep(p, params, DT);
    expect(step.pop1.R).toBeCloseTo(orderParam(step.phases, 0, Np).R, 12);
    expect(step.pop2.R).toBeCloseTo(orderParam(step.phases, Np, Np).R, 12);
  });
});

describe('chimera: persistence (the seeded chimera holds)', () => {
  it('stays a live chimera for the whole analyze window', () => {
    let p = advance(seedChimera(Np, mulberry32(9000)), 240); // transient
    let live = 0;
    let r1mn = Infinity;
    let r1mx = -Infinity;
    let r2mn = Infinity;
    let r2mx = -Infinity;
    const N = 560; // 28 s
    for (let s = 0; s < N; s++) {
      const step = chimeraStep(p, params, DT);
      p = step.phases;
      if (isChimeraAlive(step.pop1, step.pop2)) live++;
      r1mn = Math.min(r1mn, step.pop1.R);
      r1mx = Math.max(r1mx, step.pop1.R);
      r2mn = Math.min(r2mn, step.pop2.R);
      r2mx = Math.max(r2mx, step.pop2.R);
    }
    // Probe reference: a robust, persistent chimera (fracLive = 1.0).
    expect(live / N).toBe(1);
    // pop1 stays locked; pop2 stays genuinely incoherent (it breathes, never locks).
    expect(r1mn).toBeGreaterThan(0.9);
    expect(r2mx).toBeLessThan(0.85);
    // The breathing morph: pop2's order parameter has a real excursion.
    expect(r2mx - r2mn).toBeGreaterThan(0.1);
  });
});

describe('chimera: pure collapse-detector helpers', () => {
  it('isChimeraAlive is true only when one pop locks and the other is incoherent', () => {
    expect(isChimeraAlive({ R: 0.99, Phi: 0 }, { R: 0.3, Phi: 0 })).toBe(true);
    // global sync — both locked, not a chimera
    expect(isChimeraAlive({ R: 0.99, Phi: 0 }, { R: 0.98, Phi: 0 })).toBe(
      false,
    );
    // mutual incoherence — neither locked
    expect(isChimeraAlive({ R: 0.4, Phi: 0 }, { R: 0.3, Phi: 0 })).toBe(false);
  });

  it('chimeraSplit measures the gap and collapses to 0 when populations merge', () => {
    expect(chimeraSplit({ R: 1, Phi: 0 }, { R: 0.1, Phi: 0 })).toBeCloseTo(
      0.9,
      12,
    );
    expect(chimeraSplit({ R: 0.95, Phi: 0 }, { R: 0.95, Phi: 0 })).toBe(0);
  });

  it('lockedPopulation reports which population is synchronized', () => {
    expect(lockedPopulation({ R: 0.99, Phi: 0 }, { R: 0.2, Phi: 0 })).toBe(1);
    expect(lockedPopulation({ R: 0.2, Phi: 0 }, { R: 0.99, Phi: 0 })).toBe(2);
  });
});

describe('chimera: intensity → A mapping (basin↔morph trade-off)', () => {
  it('maps low intensity to a wide basin (A≈0.5) and high to a big morph (A≈0.2)', () => {
    expect(intensityToA(0)).toBeCloseTo(0.5, 12);
    expect(intensityToA(1)).toBeCloseTo(0.2, 12);
    expect(intensityToA(0.2)).toBeCloseTo(0.44, 12);
  });

  it('is monotone decreasing and clamps to the stable band', () => {
    expect(intensityToA(0.3)).toBeLessThan(intensityToA(0.1));
    expect(intensityToA(-5)).toBeCloseTo(0.5, 12); // clamp low
    expect(intensityToA(5)).toBeCloseTo(0.2, 12); // clamp high
  });
});

describe('chimera: defaults', () => {
  it('uses the probe-verified default phase lag', () => {
    expect(DEFAULT_BETA).toBe(0.02);
  });
});
