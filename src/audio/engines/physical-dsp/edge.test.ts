import { describe, expect, it } from 'vitest';
import { EdgeTone, jetDrive } from '@/audio/engines/physical-dsp/edge';
import {
  SR,
  seeded,
  rms,
  allFinite,
  peak,
  renderN,
} from '@/audio/engines/physical-dsp/test-util';

describe('EdgeTone (jet-blown air column)', () => {
  it('produces non-silent, stable output', () => {
    const e = new EdgeTone(SR, 110, 0.4, 0.6, 0.6, 0.5, 0.5, seeded(21));
    const out = renderN(e, SR);
    expect(allFinite(out)).toBe(true);
    expect(rms(out)).toBeGreaterThan(0);
    expect(peak(out)).toBeLessThan(8);
  });

  it('jet velocity (reed) changes the output (audible param)', () => {
    const a = new EdgeTone(SR, 110, 0.4, 0.6, 0.6, 0.2, 0.5, seeded(22));
    const b = new EdgeTone(SR, 110, 0.4, 0.6, 0.6, 0.9, 0.5, seeded(22));
    expect(rms(renderN(a, 8192))).not.toBeCloseTo(rms(renderN(b, 8192)), 5);
  });

  it('breathiness (inharm) changes the noise/tone balance (audible param)', () => {
    const tonal = new EdgeTone(SR, 110, 0.4, 0.6, 0.6, 0.5, 0.1, seeded(23));
    const airy = new EdgeTone(SR, 110, 0.4, 0.6, 0.6, 0.5, 0.9, seeded(23));
    expect(rms(renderN(tonal, 8192))).not.toBeCloseTo(
      rms(renderN(airy, 8192)),
      5,
    );
  });

  it('retunes without NaN', () => {
    const e = new EdgeTone(SR, 110, 0.4, 0.6, 0.6, 0.5, 0.5, seeded(24));
    renderN(e, 4096);
    e.setFrequency(220);
    e.setDetuneCents(15);
    expect(allFinite(renderN(e, 4096))).toBe(true);
  });

  it('maps jet velocity monotonically to drive gain', () => {
    expect(jetDrive(0)).toBeLessThan(jetDrive(1));
  });
});
