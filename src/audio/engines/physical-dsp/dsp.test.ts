import { describe, expect, it } from 'vitest';
import {
  NoiseExciter,
  brightnessToCoef,
} from '@/audio/engines/physical-dsp/noise';
import { KarplusStrong } from '@/audio/engines/physical-dsp/string';
import { Waveguide } from '@/audio/engines/physical-dsp/tube';
import { ModalBank } from '@/audio/engines/physical-dsp/modal-bank';
import { PLATE_MODES, plateEigen } from '@/audio/engines/physical-dsp/plate';
import {
  SR,
  seeded,
  rms,
  allFinite,
  peak,
} from '@/audio/engines/physical-dsp/test-util';

describe('NoiseExciter', () => {
  it('produces non-silent, bounded output and scales with level', () => {
    const loud = new NoiseExciter(SR, 1, 0.5, seeded(1));
    const quiet = new NoiseExciter(SR, 0.1, 0.5, seeded(1));
    const a = new Float32Array(2048);
    const b = new Float32Array(2048);
    for (let i = 0; i < a.length; i++) a[i] = loud.next();
    for (let i = 0; i < b.length; i++) b[i] = quiet.next();
    expect(rms(a)).toBeGreaterThan(0);
    expect(rms(a)).toBeGreaterThan(rms(b));
    expect(allFinite(a)).toBe(true);
  });

  it('maps brightness monotonically to a higher low-pass coefficient', () => {
    expect(brightnessToCoef(0.2, SR)).toBeLessThan(brightnessToCoef(0.9, SR));
  });
});

describe('KarplusStrong (string)', () => {
  it('produces non-silent, stable output under continuous excitation', () => {
    const s = new KarplusStrong(SR, 110, 0.4, 0.6, 0.5, seeded(2));
    const out = new Float32Array(SR); // 1s
    s.render(out);
    expect(allFinite(out)).toBe(true);
    expect(rms(out)).toBeGreaterThan(0);
    // Stable: no runaway feedback.
    expect(peak(out)).toBeLessThan(8);
  });

  it('retunes when the fundamental changes (no NaN)', () => {
    const s = new KarplusStrong(SR, 110, 0.4, 0.6, 0.5, seeded(3));
    const out = new Float32Array(4096);
    s.render(out);
    s.setFrequency(220);
    s.setDetuneCents(15);
    s.render(out);
    expect(allFinite(out)).toBe(true);
  });
});

describe('Waveguide (tube)', () => {
  it('produces non-silent, stable output', () => {
    const w = new Waveguide(SR, 110, 0.4, 0.6, 0.6, 0.5, seeded(4));
    const out = new Float32Array(SR);
    w.render(out);
    expect(allFinite(out)).toBe(true);
    expect(rms(out)).toBeGreaterThan(0);
    expect(peak(out)).toBeLessThan(8);
  });
});

describe('ModalBank (plate)', () => {
  const plate = (rng: () => number, modeCount = PLATE_MODES) =>
    new ModalBank({
      sampleRate: SR,
      eigen: plateEigen,
      f0: 110,
      damping: 0.3,
      brightness: 0.6,
      excitation: 0.6,
      shape1: 0.5,
      rng,
      modeCount,
    });

  it('rings with non-silent, stable output across 20 modes', () => {
    const out = new Float32Array(SR);
    plate(seeded(5)).render(out);
    expect(allFinite(out)).toBe(true);
    expect(rms(out)).toBeGreaterThan(0);
    expect(peak(out)).toBeLessThan(8);
  });

  it('honors a reduced mode count (CPU fallback)', () => {
    const out = new Float32Array(8192);
    plate(seeded(6), 4).render(out);
    expect(allFinite(out)).toBe(true);
    expect(rms(out)).toBeGreaterThan(0);
  });

  it('defaults to 20 modes', () => {
    expect(PLATE_MODES).toBe(20);
  });
});
