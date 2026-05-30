import { describe, expect, it } from 'vitest';
import { BreathController } from '@/breath/BreathController';

describe('BreathController', () => {
  it('progresses through a full box-breath cycle in phase order', () => {
    const ctrl = new BreathController([4, 4, 4, 4]);
    ctrl.reset(0);
    // Sample the middle of each 4s phase.
    expect(ctrl.frameAt(2).phase).toBe('inhale');
    expect(ctrl.frameAt(6).phase).toBe('hold-full');
    expect(ctrl.frameAt(10).phase).toBe('exhale');
    expect(ctrl.frameAt(14).phase).toBe('hold-empty');
    // Wraps back to inhale on the next cycle.
    expect(ctrl.frameAt(16).phase).toBe('inhale');
    expect(ctrl.frameAt(18).phase).toBe('inhale');
  });

  it('eases amplitude up on inhale and down on exhale (peak at hold-full)', () => {
    const ctrl = new BreathController([4, 4, 4, 4]);
    ctrl.reset(0);
    expect(ctrl.frameAt(0).amplitude).toBeCloseTo(0, 5);
    expect(ctrl.frameAt(2).amplitude).toBeCloseTo(0.5, 5); // smoothstep(0.5)
    expect(ctrl.frameAt(6).amplitude).toBe(1); // hold-full
    expect(ctrl.frameAt(10).amplitude).toBeCloseTo(0.5, 5); // mid exhale
    expect(ctrl.frameAt(14).amplitude).toBe(0); // hold-empty
  });

  it('skips zero-duration holds (coherent: inhale↔exhale only)', () => {
    const ctrl = new BreathController([5.5, 0, 5.5, 0]);
    ctrl.reset(0);
    expect(ctrl.getCycleLength()).toBe(11);
    expect(ctrl.frameAt(2).phase).toBe('inhale');
    expect(ctrl.frameAt(8).phase).toBe('exhale');
    // No hold phases are ever reported.
    const phases = new Set<string>();
    for (let t = 0; t < 11; t += 0.25) phases.add(ctrl.frameAt(t).phase);
    expect(phases.has('hold-full')).toBe(false);
    expect(phases.has('hold-empty')).toBe(false);
  });

  it('respects a custom pattern via setTuple', () => {
    const ctrl = new BreathController([4, 7, 8, 0]); // 4-7-8
    ctrl.reset(0);
    expect(ctrl.getCycleLength()).toBe(19);
    expect(ctrl.frameAt(2).phase).toBe('inhale');
    expect(ctrl.frameAt(8).phase).toBe('hold-full');
    expect(ctrl.frameAt(15).phase).toBe('exhale');
    ctrl.setTuple([4, 4, 4, 4]);
    expect(ctrl.getCycleLength()).toBe(16);
  });

  it('cycleProgress advances 0→1 across the cycle', () => {
    const ctrl = new BreathController([4, 4, 4, 4]);
    ctrl.reset(0);
    expect(ctrl.frameAt(0).cycleProgress).toBeCloseTo(0, 5);
    expect(ctrl.frameAt(8).cycleProgress).toBeCloseTo(0.5, 5);
    expect(ctrl.frameAt(12).cycleProgress).toBeCloseTo(0.75, 5);
  });

  it('flags a transition only on the frame a phase boundary is crossed', () => {
    const ctrl = new BreathController([4, 4, 4, 4]);
    ctrl.reset(0);
    expect(ctrl.frameAt(1).transition).toBe(false); // first sample, no prior
    expect(ctrl.frameAt(2).transition).toBe(false); // still inhale
    expect(ctrl.frameAt(5).transition).toBe(true); // inhale → hold-full
    expect(ctrl.frameAt(6).transition).toBe(false); // still hold-full
    expect(ctrl.frameAt(9).transition).toBe(true); // hold-full → exhale
  });

  it('resumes at the correct phase after a backgrounded gap (audio clock)', () => {
    // Simulates a tab that was hidden: RAF paused, but AudioContext.currentTime
    // kept advancing. Phase is mod(time), so the next sample lands correctly.
    const ctrl = new BreathController([4, 4, 4, 4]);
    ctrl.reset(100); // session started at audio time 100s
    expect(ctrl.frameAt(102).phase).toBe('inhale');
    // Tab hidden for ~63s; resumes at audio time 165. (165-100)=65, 65 mod 16=1.
    expect(ctrl.frameAt(165).phase).toBe('inhale');
    // (170-100)=70, 70 mod 16=6 → hold-full.
    expect(ctrl.frameAt(170).phase).toBe('hold-full');
  });

  it('does not drift over a long (30+ min) session', () => {
    const ctrl = new BreathController([4, 4, 4, 4]);
    ctrl.reset(0);
    // 30 minutes = 1800s = exactly 112.5 cycles → t mod 16 = 8 → mid hold-full?
    // 1800 mod 16 = 8 → start of exhale boundary; sample slightly inside.
    expect(ctrl.frameAt(1800 + 2).phase).toBe('exhale');
    // Equivalent small-time sample gives identical phase — no accumulation.
    expect(ctrl.frameAt(10).phase).toBe('exhale');
  });

  it('holds steady for a degenerate (all-zero) tuple', () => {
    const ctrl = new BreathController([0, 0, 0, 0]);
    const f = ctrl.frameAt(5);
    expect(f.amplitude).toBe(0);
    expect(f.transition).toBe(false);
  });
});
