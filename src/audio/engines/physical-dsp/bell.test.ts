import { describe, expect, it } from 'vitest';
import { ModalBank } from '@/audio/engines/physical-dsp/modal-bank';
import {
  bellEigen,
  bellGain,
  BELL_MODES,
} from '@/audio/engines/physical-dsp/bell';
import {
  SR,
  seeded,
  rms,
  allFinite,
  peak,
  renderN,
} from '@/audio/engines/physical-dsp/test-util';

const bell = (rng: () => number, inharm = 0.5, warmth = 0.5) =>
  new ModalBank({
    sampleRate: SR,
    eigen: bellEigen,
    gainFn: bellGain,
    f0: 220,
    damping: 0.2,
    brightness: 0.6,
    excitation: 0.6,
    shape1: inharm,
    shape2: warmth,
    rng,
    modeCount: BELL_MODES,
  });

describe('bell (bell-ratio modal bank)', () => {
  it('rings with non-silent, stable output', () => {
    const out = renderN(bell(seeded(13)), SR);
    expect(allFinite(out)).toBe(true);
    expect(rms(out)).toBeGreaterThan(0);
    expect(peak(out)).toBeLessThan(8);
  });

  it('warmth (shape2) tilts the output level (audible param)', () => {
    const cold = renderN(bell(seeded(14), 0.5, 0.1), 8192);
    const warm = renderN(bell(seeded(14), 0.5, 0.9), 8192);
    expect(rms(cold)).not.toBeCloseTo(rms(warm), 5);
  });

  it('inharmonicity (shape1) stretches the ratios around the prime', () => {
    expect(bellEigen(2, 0, 0)).toBeCloseTo(1.2, 5); // tierce, no stretch
    expect(bellEigen(4, 0.9, 0)).toBeGreaterThan(2.0); // nominal stretched up
  });

  it('places the hum a sub-octave below the prime', () => {
    expect(bellEigen(0, 0, 0)).toBeCloseTo(0.5, 5);
    expect(bellEigen(1, 0, 0)).toBeCloseTo(1.0, 5);
  });

  it('defaults to 9 partials', () => {
    expect(BELL_MODES).toBe(9);
  });
});
