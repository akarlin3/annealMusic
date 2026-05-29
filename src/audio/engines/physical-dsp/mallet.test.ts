import { describe, expect, it } from 'vitest';
import {
  createMalletBank,
  malletEigen,
  malletRate,
  MALLET_MODES,
  TremoloExciter,
} from '@/audio/engines/physical-dsp/mallet';
import {
  SR,
  seeded,
  rms,
  allFinite,
  peak,
  renderN,
} from '@/audio/engines/physical-dsp/test-util';

describe('mallet (tremolo modal bank)', () => {
  it('rings with non-silent, stable output', () => {
    const { bank } = createMalletBank(SR);
    const out = renderN(bank, SR);
    expect(allFinite(out)).toBe(true);
    expect(rms(out)).toBeGreaterThan(0);
    expect(peak(out)).toBeLessThan(8);
  });

  it('maps the reed slot to a 1..8 Hz roll rate', () => {
    expect(malletRate(0)).toBeCloseTo(1, 5);
    expect(malletRate(1)).toBeCloseTo(8, 5);
  });

  it('the tremolo exciter gate is non-silent and bounded', () => {
    const ex = new TremoloExciter(SR, 0.6, 0.6, seeded(31));
    ex.setRate(4);
    const out = new Float32Array(SR);
    for (let i = 0; i < out.length; i++) out[i] = ex.next();
    expect(allFinite(out)).toBe(true);
    expect(rms(out)).toBeGreaterThan(0);
    expect(peak(out)).toBeLessThanOrEqual(1);
  });

  it('hardness (shape1) stretches the bar ratios around the table', () => {
    expect(malletEigen(1, 0.5, 0)).toBeCloseTo(3.984, 2); // neutral hardness
    expect(malletEigen(1, 0.9, 0)).toBeGreaterThan(malletEigen(1, 0.1, 0));
  });

  it('defaults to 6 bar modes', () => {
    expect(MALLET_MODES).toBe(6);
  });
});
