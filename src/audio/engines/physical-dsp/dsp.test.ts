import { describe, expect, it } from 'vitest';
import {
  NoiseExciter,
  brightnessToCoef,
} from '@/audio/engines/physical-dsp/noise';
import { KarplusStrong } from '@/audio/engines/physical-dsp/string';
import { Waveguide } from '@/audio/engines/physical-dsp/tube';
import { ModalBank, PLATE_MODES } from '@/audio/engines/physical-dsp/plate';

const SR = 48000;

/** Deterministic pseudo-noise so tests are reproducible. */
function seeded(seed = 1): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function rms(buf: Float32Array): number {
  let sum = 0;
  for (const v of buf) sum += v * v;
  return Math.sqrt(sum / buf.length);
}

function allFinite(buf: Float32Array): boolean {
  for (const v of buf) if (!Number.isFinite(v)) return false;
  return true;
}

function peak(buf: Float32Array): number {
  let p = 0;
  for (const v of buf) p = Math.max(p, Math.abs(v));
  return p;
}

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
  it('rings with non-silent, stable output across 20 modes', () => {
    const p = new ModalBank(SR, 110, 0.3, 0.6, 0.6, 0.5, seeded(5));
    const out = new Float32Array(SR);
    p.render(out);
    expect(allFinite(out)).toBe(true);
    expect(rms(out)).toBeGreaterThan(0);
    expect(peak(out)).toBeLessThan(8);
  });

  it('honors a reduced mode count (CPU fallback)', () => {
    const p = new ModalBank(SR, 110, 0.3, 0.6, 0.6, 0.5, seeded(6), 4);
    const out = new Float32Array(8192);
    p.render(out);
    expect(allFinite(out)).toBe(true);
    expect(rms(out)).toBeGreaterThan(0);
  });

  it('defaults to 20 modes', () => {
    expect(PLATE_MODES).toBe(20);
  });
});
