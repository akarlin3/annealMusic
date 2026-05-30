import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_PATTERNS,
  CUSTOM_BOUNDS,
  clampCustomPattern,
  getBuiltIn,
  resolveTuple,
} from '@/breath/patterns';

describe('breath patterns', () => {
  it('ships the four documented built-ins with correct tuples', () => {
    const byId = Object.fromEntries(
      BUILT_IN_PATTERNS.map((p) => [p.id, p.tuple]),
    );
    expect(byId.box).toEqual([4, 4, 4, 4]);
    expect(byId['4-7-8']).toEqual([4, 7, 8, 0]);
    expect(byId.coherent).toEqual([5.5, 0, 5.5, 0]);
    expect(byId.resonance).toEqual([6, 0, 6.5, 0]);
  });

  it('every built-in carries honest framing copy', () => {
    for (const p of BUILT_IN_PATTERNS) {
      expect(p.description.length).toBeGreaterThan(20);
    }
  });

  it('resolves a built-in pattern to its tuple', () => {
    expect(resolveTuple({ pattern: 'box' })).toEqual([4, 4, 4, 4]);
  });

  it('resolves a custom pattern (clamped) to its tuple', () => {
    expect(
      resolveTuple({ pattern: 'custom', custom_pattern: [5, 2, 5, 0] }),
    ).toEqual([5, 2, 5, 0]);
  });

  it('returns null for unknown / missing patterns', () => {
    expect(resolveTuple(null)).toBeNull();
    expect(resolveTuple(undefined)).toBeNull();
    expect(resolveTuple({ pattern: 'custom' })).toBeNull(); // no custom_pattern
    // @ts-expect-error — exercising the tolerant unknown-id path.
    expect(resolveTuple({ pattern: 'bogus' })).toBeNull();
  });

  it('clamps inhale/exhale up to the minimum active duration', () => {
    const clamped = clampCustomPattern([0, 0, 0, 0]);
    expect(clamped[0]).toBe(CUSTOM_BOUNDS.minActive);
    expect(clamped[2]).toBe(CUSTOM_BOUNDS.minActive);
    expect(clamped[1]).toBe(0);
    expect(clamped[3]).toBe(0);
  });

  it('caps each phase and scales an over-long cycle to the max', () => {
    const clamped = clampCustomPattern([40, 40, 40, 40]); // each capped to 30 → 120
    const total = clamped[0] + clamped[1] + clamped[2] + clamped[3];
    expect(total).toBeCloseTo(CUSTOM_BOUNDS.maxCycle, 5);
  });

  it('getBuiltIn returns metadata for built-ins and undefined for custom', () => {
    expect(getBuiltIn('box')?.label).toContain('Box');
    expect(getBuiltIn('custom')).toBeUndefined();
  });
});
