import { describe, expect, it } from 'vitest';
import { ChimeraVoice, MAX_GAIN_SLEW } from '@/audio/chimeraVoice';
import { chimeraStep, isChimeraAlive, seedChimera } from '@/audio/chimera';

/**
 * Supervisor proof — the part that makes the chimera voice shippable rather than
 * a demo. The honest bar (see the build plan): the supervisor must genuinely
 * keep the voice morphing over a long session, and re-perturbations must be
 * smooth, not clicks.
 *
 * Deterministic under a seeded mulberry32. The "would collapse without the
 * supervisor" baseline is computed by running the bare core (`chimeraStep`) from
 * the same seed — no supervisor — so the comparison is apples-to-apples.
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

const Np = 64;
const DT = 0.05;
const TRANSIENT = 240; // 12 s
const WINDOW = 12000; // 10 min @ 20 Hz
const F0 = 220;

/** Bare core, no supervisor: fraction of the window that stays a live chimera. */
function rawFracAlive(seed: number, A: number, steps: number): number {
  let p = seedChimera(Np, mulberry32(seed));
  const params = { Np, A, beta: 0.02 };
  for (let i = 0; i < TRANSIENT; i++) p = chimeraStep(p, params, DT).phases;
  let live = 0;
  for (let i = 0; i < steps; i++) {
    const s = chimeraStep(p, params, DT);
    p = s.phases;
    if (isChimeraAlive(s.pop1, s.pop2)) live++;
  }
  return live / steps;
}

/** Magnitude-weighted spectral centroid of the harmonic bank under `gains`. */
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

describe('chimera supervisor: keeps a collapse-prone seed morphing', () => {
  // seed 13 at max intensity (A=0.2) collapses out of the chimera for over half
  // the bare run — exactly the case the supervisor exists for.
  const SEED = 13;

  it('a seed that collapses without the supervisor stays morphing with it', () => {
    const raw = rawFracAlive(SEED, 0.2, WINDOW);
    // The bare core spends most of the window collapsed.
    expect(raw).toBeLessThan(0.6);

    const v = new ChimeraVoice({
      partialCount: 6,
      rng: mulberry32(SEED),
      intensity: 1.0, // A = 0.2, same regime as the raw baseline
    });
    for (let i = 0; i < TRANSIENT; i++) v.tick(DT);

    let live = 0;
    let mn = Infinity;
    let mx = -Infinity;
    let maxSlew = 0;
    let last: number[] | null = null;
    for (let i = 0; i < WINDOW; i++) {
      const t = v.tick(DT);
      if (t.alive) live++;
      const c = centroid(t.gains);
      mn = Math.min(mn, c);
      mx = Math.max(mx, c);
      if (last) {
        for (let k = 0; k < t.gains.length; k++) {
          maxSlew = Math.max(maxSlew, Math.abs(t.gains[k]! - last[k]!));
        }
      }
      last = t.gains;
    }
    const supFrac = live / WINDOW;

    // The supervisor markedly raises in-chimera time over the bare baseline…
    expect(supFrac).toBeGreaterThan(raw + 0.2);
    expect(supFrac).toBeGreaterThan(0.75);
    // …it actually intervened…
    expect(v.reperturbationCount).toBeGreaterThan(0);
    // …it keeps morphing the whole time (the centroid still breathes)…
    expect(mx - mn).toBeGreaterThan(10); // Hz
    // …and no re-perturbation produced a gain step above the slew threshold.
    expect(maxSlew).toBeLessThanOrEqual(MAX_GAIN_SLEW + 1e-9);
  });
});

describe('chimera supervisor: the gentle default holds over a long session', () => {
  it('stays in-chimera for ≥90% of a 10-minute render at the default intensity', () => {
    const v = new ChimeraVoice({
      partialCount: 6,
      rng: mulberry32(9000),
      intensity: 0.2, // gentle default (A ≈ 0.44)
    });
    for (let i = 0; i < TRANSIENT; i++) v.tick(DT);

    let live = 0;
    let mn = Infinity;
    let mx = -Infinity;
    let maxSlew = 0;
    let last: number[] | null = null;
    for (let i = 0; i < WINDOW; i++) {
      const t = v.tick(DT);
      if (t.alive) live++;
      const c = centroid(t.gains);
      mn = Math.min(mn, c);
      mx = Math.max(mx, c);
      if (last) {
        for (let k = 0; k < t.gains.length; k++) {
          maxSlew = Math.max(maxSlew, Math.abs(t.gains[k]! - last[k]!));
        }
      }
      last = t.gains;
    }

    expect(live / WINDOW).toBeGreaterThan(0.9);
    expect(mx - mn).toBeGreaterThan(10); // still morphing
    expect(maxSlew).toBeLessThanOrEqual(MAX_GAIN_SLEW + 1e-9);
  });
});

describe('chimera supervisor: smoothness mechanics', () => {
  it('the first tick snaps (no startup fade) then slew-limits', () => {
    const v = new ChimeraVoice({
      partialCount: 6,
      rng: mulberry32(1),
      intensity: 0.5,
    });
    const first = v.tick(DT).gains;
    // First emitted gains are not artificially pinned to unity — they reflect
    // the real seeded state immediately.
    expect(first.some((g) => Math.abs(g - 1) > 0.01)).toBe(true);
  });

  it('forcing a re-perturbation never steps a gain beyond the slew cap', () => {
    // Max intensity + a long run guarantees several re-perturbations.
    const v = new ChimeraVoice({
      partialCount: 8,
      rng: mulberry32(13),
      intensity: 1.0,
    });
    let last: number[] | null = null;
    let maxSlew = 0;
    let reperturbed = false;
    for (let i = 0; i < 6000; i++) {
      const t = v.tick(DT);
      if (t.reperturbed) reperturbed = true;
      if (last) {
        for (let k = 0; k < t.gains.length; k++) {
          maxSlew = Math.max(maxSlew, Math.abs(t.gains[k]! - last[k]!));
        }
      }
      last = t.gains;
    }
    expect(reperturbed).toBe(true);
    expect(maxSlew).toBeLessThanOrEqual(MAX_GAIN_SLEW + 1e-9);
  });
});
