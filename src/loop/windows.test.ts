import { describe, expect, it } from 'vitest';
import {
  equalPowerFadeIn,
  equalPowerFadeOut,
  hannWindow,
} from '@/loop/windows';

describe('hannWindow', () => {
  it('starts and ends at zero, peaks at one', () => {
    const w = hannWindow(64);
    expect(w[0]).toBeCloseTo(0, 5);
    expect(w[w.length - 1]).toBeCloseTo(0, 5);
    expect(Math.max(...w)).toBeCloseTo(1, 2);
  });

  it('is symmetric', () => {
    const w = hannWindow(33);
    for (let i = 0; i < w.length; i++) {
      expect(w[i]).toBeCloseTo(w[w.length - 1 - i] ?? 0, 6);
    }
  });

  it('clamps tiny lengths to at least two samples', () => {
    expect(hannWindow(1).length).toBe(2);
  });
});

describe('equal-power crossfade', () => {
  it('sums to constant power across the fade (no seam dip)', () => {
    const n = 128;
    const fin = equalPowerFadeIn(n);
    const fout = equalPowerFadeOut(n);
    for (let i = 0; i < n; i++) {
      const power = (fin[i] ?? 0) ** 2 + (fout[i] ?? 0) ** 2;
      expect(power).toBeCloseTo(1, 5);
    }
  });

  it('fade-in rises 0→1, fade-out falls 1→0', () => {
    const fin = equalPowerFadeIn(16);
    const fout = equalPowerFadeOut(16);
    expect(fin[0]).toBeCloseTo(0, 5);
    expect(fin[fin.length - 1]).toBeCloseTo(1, 5);
    expect(fout[0]).toBeCloseTo(1, 5);
    expect(fout[fout.length - 1]).toBeCloseTo(0, 5);
  });
});
