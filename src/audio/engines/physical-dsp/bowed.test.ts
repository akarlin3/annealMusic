import { describe, expect, it } from 'vitest';
import {
  BowedString,
  bowKnee,
  bowVel,
} from '@/audio/engines/physical-dsp/bowed';
import {
  SR,
  rms,
  allFinite,
  peak,
  renderN,
} from '@/audio/engines/physical-dsp/test-util';

describe('BowedString', () => {
  it('self-oscillates from rest: non-silent, bounded output', () => {
    const b = new BowedString(SR, 110, 0.4, 0.6, 0.6, 0.5, 0.5);
    const out = renderN(b, SR);
    expect(allFinite(out)).toBe(true);
    expect(rms(out)).toBeGreaterThan(0);
    expect(peak(out)).toBeLessThanOrEqual(1.0001); // tanh-clipped loop
  });

  it('bow velocity (inharm) changes the output (audible param)', () => {
    const slow = new BowedString(SR, 110, 0.4, 0.6, 0.6, 0.5, 0.2);
    const fast = new BowedString(SR, 110, 0.4, 0.6, 0.6, 0.5, 0.8);
    expect(rms(renderN(slow, 8192))).not.toBeCloseTo(
      rms(renderN(fast, 8192)),
      5,
    );
  });

  it('bow pressure (reed) changes the output (audible param)', () => {
    const light = new BowedString(SR, 110, 0.4, 0.6, 0.6, 0.1, 0.5);
    const heavy = new BowedString(SR, 110, 0.4, 0.6, 0.6, 0.9, 0.5);
    expect(rms(renderN(light, 8192))).not.toBeCloseTo(
      rms(renderN(heavy, 8192)),
      5,
    );
  });

  it('retunes without NaN', () => {
    const b = new BowedString(SR, 110, 0.4, 0.6, 0.6, 0.5, 0.5);
    renderN(b, 4096);
    b.setFrequency(220);
    b.setDetuneCents(15);
    expect(allFinite(renderN(b, 4096))).toBe(true);
  });

  it('maps the param slots monotonically', () => {
    expect(bowKnee(0)).toBeLessThan(bowKnee(1));
    expect(bowVel(0)).toBeLessThan(bowVel(1));
  });
});
