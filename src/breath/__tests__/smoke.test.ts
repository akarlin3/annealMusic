/**
 * CP3 smoke matrix (controller-level): every built-in displays correct motion,
 * custom runs, and a long session does not drift. UI-level checks (reduce-motion
 * fade, haptic sync) are covered in BreathOverlay/hapticBridge tests.
 */
import { describe, expect, it } from 'vitest';
import { BreathController } from '@/breath/BreathController';
import { BUILT_IN_PATTERNS, resolveTuple } from '@/breath/patterns';

describe('breath smoke matrix', () => {
  it('every built-in pattern produces a full inhale→exhale amplitude swing', () => {
    for (const p of BUILT_IN_PATTERNS) {
      const tuple = resolveTuple({ pattern: p.id })!;
      const ctrl = new BreathController(tuple);
      ctrl.reset(0);
      const len = ctrl.getCycleLength();
      let min = Infinity;
      let max = -Infinity;
      for (let t = 0; t < len; t += len / 200) {
        const a = ctrl.frameAt(t).amplitude;
        min = Math.min(min, a);
        max = Math.max(max, a);
      }
      expect(min, `${p.id} reaches trough`).toBeLessThan(0.05);
      expect(max, `${p.id} reaches peak`).toBeGreaterThan(0.95);
    }
  });

  it('accepts and runs a custom pattern', () => {
    const tuple = resolveTuple({
      pattern: 'custom',
      custom_pattern: [3, 1, 4, 2],
    })!;
    const ctrl = new BreathController(tuple);
    ctrl.reset(0);
    expect(ctrl.getCycleLength()).toBe(10);
    expect(ctrl.frameAt(1).phase).toBe('inhale');
    expect(ctrl.frameAt(9).phase).toBe('hold-empty');
  });

  it('shows no timing drift across a 30+ minute session', () => {
    const ctrl = new BreathController([4, 4, 4, 4]);
    ctrl.reset(0);
    // Sample the same cycle offset early and 40 minutes in — identical phase.
    const early = ctrl.frameAt(3);
    const late = ctrl.frameAt(2400 + 3); // 2400s = 40 min, exact multiple of 16
    expect(late.phase).toBe(early.phase);
    expect(late.amplitude).toBeCloseTo(early.amplitude, 10);
  });
});
