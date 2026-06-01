import { describe, expect, it } from 'vitest';
import {
  ChimeraVoice,
  CHIMERA_AMOUNT,
  DEFAULT_CHIMERA_INTENSITY,
} from '@/audio/chimeraVoice';
import { chimeraFusionGains, intensityToA } from '@/audio/chimera';
import { fusionMultiplier } from '@/audio/fusion';

/**
 * Tests for the control-rate chimera driver and the chimera→fusion-gain bridge.
 * Deterministic under an injected mulberry32, mirroring the core suite.
 */

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

const F0 = 220; // A3, matches the fusion/probe suites
const ROLLOFF = (i: number) => 1 / (i + 1);

/** Magnitude-weighted spectral centroid of a harmonic bank under `gains`. */
function centroid(gains: readonly number[]): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < gains.length; i++) {
    const g = ROLLOFF(i) * gains[i]!;
    num += g * F0 * (i + 1);
    den += g;
  }
  return num / den;
}

describe('chimeraFusionGains: reuses the production fusion law', () => {
  it('an incoherent population (R→0) keeps its band at unity', () => {
    const pop1 = { R: 1, Phi: 0.3 };
    const pop2 = { R: 0, Phi: 1.7 }; // incoherent → no reshaping
    const gains = chimeraFusionGains(pop1, pop2, 0.3, 6, 1.0);
    // High band (partials 3..5) belongs to pop2 → all ~1.
    expect(gains[3]).toBeCloseTo(1, 12);
    expect(gains[4]).toBeCloseTo(1, 12);
    expect(gains[5]).toBeCloseTo(1, 12);
  });

  it('a locked population aligned with the global field is reinforced', () => {
    const pop1 = { R: 1, Phi: 0.5 };
    const pop2 = { R: 0.2, Phi: 2.0 };
    const globalPhi = 0.5; // aligned with the locked pop
    const gains = chimeraFusionGains(pop1, pop2, globalPhi, 6, 1.0);
    // Low band (pop1) is boosted above 1; matches calling fusionMultiplier directly.
    expect(gains[0]).toBeCloseTo(fusionMultiplier(0.5, 0.5, 1.0 * 1.0), 12);
    expect(gains[0]).toBeGreaterThan(1.4);
  });

  it('splits the bank low→pop1, high→pop2 (pop1 takes the odd extra)', () => {
    const pop1 = { R: 1, Phi: 0 };
    const pop2 = { R: 1, Phi: Math.PI }; // opposed → distinguishable gains
    const gains = chimeraFusionGains(pop1, pop2, 0, 5, 1.0);
    // split = ceil(5/2) = 3 → indices 0,1,2 = pop1; 3,4 = pop2.
    expect(gains[0]).toBe(gains[1]);
    expect(gains[1]).toBe(gains[2]);
    expect(gains[3]).toBe(gains[4]);
    expect(gains[2]).not.toBeCloseTo(gains[3]!, 6);
  });
});

describe('ChimeraVoice: control-rate driver', () => {
  it('is deterministic under a seeded rng', () => {
    const mk = () =>
      new ChimeraVoice({ partialCount: 6, rng: mulberry32(7), intensity: 0.2 });
    const a = mk();
    const b = mk();
    for (let i = 0; i < 50; i++) {
      expect(a.tick(0.05).gains).toEqual(b.tick(0.05).gains);
    }
  });

  it('seeds a live chimera and produces partialCount gains', () => {
    const v = new ChimeraVoice({
      partialCount: 6,
      rng: mulberry32(9000),
      intensity: 0.2,
    });
    expect(v.isAlive()).toBe(true);
    const tick = v.tick(0.05);
    expect(tick.gains).toHaveLength(6);
    for (const g of tick.gains) expect(g).toBeGreaterThanOrEqual(0);
  });

  it('maps intensity to A via the basin↔morph mapping', () => {
    const v = new ChimeraVoice({ partialCount: 6, rng: mulberry32(1) });
    expect(v.couplingDisparity).toBeCloseTo(
      intensityToA(DEFAULT_CHIMERA_INTENSITY),
      12,
    );
    v.setIntensity(1);
    expect(v.couplingDisparity).toBeCloseTo(0.2, 12);
    v.setIntensity(0);
    expect(v.couplingDisparity).toBeCloseTo(0.5, 12);
  });

  it('produces a real spectral-centroid morph over a window (the voice "breathes")', () => {
    const v = new ChimeraVoice({
      partialCount: 6,
      rng: mulberry32(9000),
      intensity: 0.2,
    });
    // Transient, then measure the centroid excursion.
    for (let i = 0; i < 240; i++) v.tick(0.05);
    let mn = Infinity;
    let mx = -Infinity;
    let sum = 0;
    const N = 800;
    for (let i = 0; i < N; i++) {
      const c = centroid(v.tick(0.05).gains);
      mn = Math.min(mn, c);
      mx = Math.max(mx, c);
      sum += c;
    }
    const meanC = sum / N;
    const morph = mx - mn;
    // The centroid actually moves — not a static spectral offset.
    expect(morph).toBeGreaterThan(1); // Hz
    // …and the morph is a meaningful fraction of the mean centroid (it breathes).
    expect(morph / meanC).toBeGreaterThan(0.005);
  });
});

describe('ChimeraVoice: constants', () => {
  it('uses full reshaping depth (the user control is intensity, not amount)', () => {
    expect(CHIMERA_AMOUNT).toBe(1.0);
  });
});
