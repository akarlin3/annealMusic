import { describe, expect, it } from 'vitest';
import { CURVES, easeInOut, exponential, linear } from '@/session/curves';

describe('curves', () => {
  it('all curves pin the endpoints', () => {
    for (const curve of Object.values(CURVES)) {
      expect(curve(0)).toBeCloseTo(0, 6);
      expect(curve(1)).toBeCloseTo(1, 6);
    }
  });

  it('all curves clamp out-of-range input to [0,1]', () => {
    for (const curve of Object.values(CURVES)) {
      expect(curve(-1)).toBeCloseTo(0, 6);
      expect(curve(2)).toBeCloseTo(1, 6);
    }
  });

  it('linear is the identity on [0,1]', () => {
    expect(linear(0.25)).toBeCloseTo(0.25, 6);
    expect(linear(0.75)).toBeCloseTo(0.75, 6);
  });

  it('easeInOut is symmetric about its midpoint', () => {
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 6);
    expect(easeInOut(0.25) + easeInOut(0.75)).toBeCloseTo(1, 6);
  });

  it('exponential is symmetric and slow at the tails', () => {
    expect(exponential(0.5)).toBeCloseTo(0.5, 6);
    expect(exponential(0.1)).toBeLessThan(linear(0.1)); // flatter near 0
  });
});
