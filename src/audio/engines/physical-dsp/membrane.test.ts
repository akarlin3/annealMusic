import { describe, expect, it } from 'vitest';
import { ModalBank } from '@/audio/engines/physical-dsp/modal-bank';
import {
  membraneEigen,
  MEMBRANE_MODES,
} from '@/audio/engines/physical-dsp/membrane';
import {
  SR,
  seeded,
  rms,
  allFinite,
  peak,
  renderN,
} from '@/audio/engines/physical-dsp/test-util';

const membrane = (rng: () => number, shape1 = 0.5, shape2 = 0.5) =>
  new ModalBank({
    sampleRate: SR,
    eigen: membraneEigen,
    f0: 110,
    damping: 0.3,
    brightness: 0.6,
    excitation: 0.6,
    shape1,
    shape2,
    rng,
    modeCount: MEMBRANE_MODES,
  });

describe('membrane (circular-membrane modal bank)', () => {
  it('rings with non-silent, stable output', () => {
    const out = renderN(membrane(seeded(11)), SR);
    expect(allFinite(out)).toBe(true);
    expect(rms(out)).toBeGreaterThan(0);
    expect(peak(out)).toBeLessThan(8);
  });

  it('tension (shape1) changes the spectrum (audible param)', () => {
    const low = renderN(membrane(seeded(12), 0.1), 8192);
    const high = renderN(membrane(seeded(12), 0.9), 8192);
    expect(rms(low)).not.toBeCloseTo(rms(high), 5);
  });

  it('is inharmonic: mode 1 is not an integer multiple of the fundamental', () => {
    expect(membraneEigen(0, 0.5, 0)).toBeCloseTo(1, 5);
    expect(membraneEigen(1, 0.5, 0)).toBeGreaterThan(1.3);
    expect(membraneEigen(1, 0.5, 0)).toBeLessThan(2);
  });

  it('defaults to 12 modes', () => {
    expect(MEMBRANE_MODES).toBe(12);
  });
});
