import { describe, expect, it } from 'vitest';
// @ts-expect-error — labeling.mjs is plain ESM JS (no .d.ts); typed via JSDoc.
import { labelSeries, DEFAULTS } from './labeling.mjs';

/**
 * CP1 unit tests — two-timescale labeling on synthetic R_incoh(t).
 *
 * Covers the five required shapes (graze-then-recover, graze-then-absorb,
 * immediate-absorb, churn-then-absorb, never-collapse) plus a shallow-dip edge
 * case (a sub-θ dip that never reaches the recovery band must NOT count as
 * recovery), censoring, and the (T_v, recThresh) sensitivity knobs.
 */
const DT = 0.1;
const HI = 0.95; // above θ=0.85
const SHALLOW = 0.82; // below θ but above recThresh=0.80 (not a recovery)
const LO = 0.3; // below recThresh ⇒ recovery when sustained

/** Concatenate constant-value segments specified in seconds. */
function build(segments: [number, number][]): number[] {
  const out: number[] = [];
  for (const [val, secs] of segments) {
    const n = Math.round(secs / DT);
    for (let i = 0; i < n; i++) out.push(val);
  }
  return out;
}

const near = (a: number, b: number, tol = DT + 1e-9) => Math.abs(a - b) <= tol;

describe('two-timescale labeling on synthetic R_incoh(t)', () => {
  it('never-collapse: both labels censored', () => {
    const r = labelSeries(build([[LO, 300]]), DT, {}, 300);
    expect(r.graze_censored).toBe(true);
    expect(r.abs_censored).toBe(true);
    expect(r.n_grazes_before_abs).toBe(0);
  });

  it('immediate-absorb: t_graze≈0, t_abs≈0, no grazes', () => {
    const r = labelSeries(build([[HI, 300]]), DT, {}, 300);
    expect(r.graze_censored).toBe(false);
    expect(r.abs_censored).toBe(false);
    expect(near(r.t_graze, 0)).toBe(true);
    expect(near(r.t_abs, 0)).toBe(true);
    expect(r.n_grazes_before_abs).toBe(0);
  });

  it('graze-then-recover (stays low): t_graze set, t_abs censored, 1 graze', () => {
    const r = labelSeries(
      build([
        [LO, 20],
        [HI, 10], // graze
        [LO, 300], // recovers and never absorbs
      ]),
      DT,
      {},
      330,
    );
    expect(r.graze_censored).toBe(false);
    expect(near(r.t_graze, 20)).toBe(true);
    expect(r.abs_censored).toBe(true);
    expect(r.n_grazes_before_abs).toBe(1);
  });

  it('graze-then-absorb: t_graze at graze, t_abs at second crossing, 1 graze', () => {
    const r = labelSeries(
      build([
        [LO, 20],
        [HI, 10], // graze 1
        [LO, 10], // recovery
        [HI, 200], // absorbs
      ]),
      DT,
      {},
      240,
    );
    expect(near(r.t_graze, 20)).toBe(true);
    expect(r.abs_censored).toBe(false);
    expect(near(r.t_abs, 40)).toBe(true);
    expect(r.n_grazes_before_abs).toBe(1);
  });

  it('churn-then-absorb: 3 grazes then permanent merge', () => {
    const r = labelSeries(
      build([
        [LO, 10],
        [HI, 8], // cross 1  (t=10)
        [LO, 10], // recovery
        [HI, 8], // cross 2  (t=28)
        [LO, 10], // recovery
        [HI, 8], // cross 3  (t=46)
        [LO, 10], // recovery
        [HI, 200], // absorbs (t=64)
      ]),
      DT,
      {},
      304,
    );
    expect(near(r.t_graze, 10)).toBe(true);
    expect(near(r.t_abs, 64)).toBe(true);
    expect(r.n_grazes_before_abs).toBe(3);
  });

  it('shallow sub-θ dip is not recovery: absorbs at first crossing', () => {
    const r = labelSeries(
      build([
        [LO, 20],
        [HI, 30], // crossing
        [SHALLOW, 40], // dips below θ but never below recThresh ⇒ NOT recovery
        [HI, 120], // back up; whole post-crossing window has no recovery
      ]),
      DT,
      {},
      210,
    );
    expect(near(r.t_graze, 20)).toBe(true);
    expect(r.abs_censored).toBe(false);
    expect(near(r.t_abs, 20)).toBe(true);
    expect(r.n_grazes_before_abs).toBe(0);
  });

  it('censoring: crossing too late for the full T_v window ⇒ t_abs censored', () => {
    // Crossing confirmed at ~25s; only ~60s of no-recovery data before t_max=100
    // (< T_v=120) ⇒ cannot certify absorption.
    const r = labelSeries(
      build([
        [LO, 20],
        [HI, 80], // never recovers, but window < T_v
      ]),
      DT,
      { T_v: 120 },
      100,
    );
    expect(near(r.t_graze, 20)).toBe(true);
    expect(r.abs_censored).toBe(true);
  });

  it('T_v sensitivity: a shorter horizon certifies the same crossing as absorbed', () => {
    const r = labelSeries(
      build([
        [LO, 20],
        [HI, 80],
      ]),
      DT,
      { T_v: 60 },
      100,
    );
    expect(r.abs_censored).toBe(false);
    expect(near(r.t_abs, 20)).toBe(true);
  });

  it('recThresh sensitivity: looser 0.75 ignores a shallow 0.78 dip', () => {
    const trace = build([
      [LO, 20],
      [HI, 10], // crossing
      [0.78, 10], // dip: below 0.80 but NOT below 0.75
      [HI, 200], // stays merged
    ]);
    const strict = labelSeries(trace, DT, { recThresh: 0.8 }, 240); // 0.78<0.80 ⇒ graze
    const loose = labelSeries(trace, DT, { recThresh: 0.75 }, 240); // 0.78>0.75 ⇒ no recovery
    expect(strict.n_grazes_before_abs).toBe(1);
    expect(near(strict.t_abs, 40)).toBe(true);
    expect(loose.n_grazes_before_abs).toBe(0);
    expect(near(loose.t_abs, 20)).toBe(true);
  });

  it('defaults are the documented absorption-grade constants', () => {
    expect(DEFAULTS.theta).toBe(0.85);
    expect(DEFAULTS.W).toBe(5.0);
    expect(DEFAULTS.T_v).toBe(120.0);
    expect(DEFAULTS.recThresh).toBe(0.8);
    expect(DEFAULTS.recWin).toBe(5.0);
  });
});
