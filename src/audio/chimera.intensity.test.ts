import { describe, expect, it } from 'vitest';
import {
  ChimeraVoice,
  DEFAULT_CHIMERA_INTENSITY,
  MAX_GAIN_SLEW,
} from '@/audio/chimeraVoice';
import { intensityToA } from '@/audio/chimera';

/**
 * Intensity control proof — the basin↔morph trade-off exposed as one user param.
 *
 * Higher intensity ⇒ smaller coupling disparity A ⇒ a larger, faster timbre
 * morph (at the cost of basin reliability the supervisor then has to cover). We
 * assert the measured spectral-centroid morph grows with intensity, that it
 * stays musically bounded across the whole range, and that the morph stays
 * smooth (no gain step beyond the slew cap) at every intensity. Averaged over a
 * seed set so the trend is robust, not a single-seed fluke.
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

const SEEDS = [9000, 9001, 9002, 9003, 9004, 7, 13, 21];
const STEPS = 3000; // 2.5 min
const TRANSIENT = 240;
const F0 = 220;

function centroid(gains: readonly number[]): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < gains.length; i++) {
    const g = (1 / (i + 1)) * gains[i]!;
    num += g * F0 * (i + 1);
    den += g;
  }
  return num / den;
}

interface IntensityStats {
  /** Mean (over seeds) peak-to-peak centroid excursion, Hz. */
  morph: number;
  /** Worst per-tick gain step across all seeds. */
  maxSlew: number;
  /** Worst morph as a fraction of mean centroid across seeds. */
  maxFraction: number;
}

function measure(intensity: number): IntensityStats {
  let morphSum = 0;
  let maxSlew = 0;
  let maxFraction = 0;
  for (const seed of SEEDS) {
    const v = new ChimeraVoice({
      partialCount: 6,
      rng: mulberry32(seed),
      intensity,
    });
    for (let i = 0; i < TRANSIENT; i++) v.tick(0.05);
    let mn = Infinity;
    let mx = -Infinity;
    let sum = 0;
    let last: number[] | null = null;
    for (let i = 0; i < STEPS; i++) {
      const t = v.tick(0.05);
      const c = centroid(t.gains);
      mn = Math.min(mn, c);
      mx = Math.max(mx, c);
      sum += c;
      if (last) {
        for (let k = 0; k < t.gains.length; k++) {
          maxSlew = Math.max(maxSlew, Math.abs(t.gains[k]! - last[k]!));
        }
      }
      last = t.gains;
    }
    const morph = mx - mn;
    morphSum += morph;
    maxFraction = Math.max(maxFraction, morph / (sum / STEPS));
  }
  return { morph: morphSum / SEEDS.length, maxSlew, maxFraction };
}

describe('chimera intensity: basin↔morph monotonicity', () => {
  const low = measure(0.1);
  const mid = measure(0.4);
  const high = measure(0.7);

  it('higher intensity produces a larger measured centroid morph', () => {
    expect(mid.morph).toBeGreaterThan(low.morph);
    expect(high.morph).toBeGreaterThan(mid.morph);
    // A clear, not marginal, increase end to end.
    expect(high.morph).toBeGreaterThan(low.morph * 1.5);
  });

  it('the morph stays musically bounded across the range', () => {
    // The probe characterized the morph at ~10–32% of the mean centroid; with
    // the small partial bank it stays comfortably inside that, never runaway.
    for (const s of [low, mid, high]) {
      expect(s.maxFraction).toBeGreaterThan(0.05); // it audibly moves
      expect(s.maxFraction).toBeLessThan(0.5); // …but never dominates the tone
    }
  });

  it('the morph stays smooth (no gain step beyond the slew cap) at every intensity', () => {
    for (const s of [low, mid, high]) {
      expect(s.maxSlew).toBeLessThanOrEqual(MAX_GAIN_SLEW + 1e-9);
    }
  });
});

describe('chimera intensity: gentle, meditation-appropriate default', () => {
  it('the default intensity sits in the low, wide-basin end of the range', () => {
    // 0.2 → A ≈ 0.44, near the most reliable basin; a gentle breath, not a wobble.
    expect(DEFAULT_CHIMERA_INTENSITY).toBeLessThanOrEqual(0.25);
    expect(intensityToA(DEFAULT_CHIMERA_INTENSITY)).toBeGreaterThan(0.4);
  });

  it('the default morph is gentler than a high-intensity morph', () => {
    const def = measure(DEFAULT_CHIMERA_INTENSITY);
    const hi = measure(0.8);
    expect(def.morph).toBeLessThan(hi.morph);
  });
});
