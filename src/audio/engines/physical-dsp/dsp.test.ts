import { describe, expect, it } from 'vitest';
import {
  NoiseExciter,
  brightnessToCoef,
} from '@/audio/engines/physical-dsp/noise';
import { KarplusStrong } from '@/audio/engines/physical-dsp/string';
import { Waveguide } from '@/audio/engines/physical-dsp/tube';
import { ModalBank } from '@/audio/engines/physical-dsp/modal-bank';
import {
  PLATE_MODES,
  plateEigen,
  createPlateBank,
} from '@/audio/engines/physical-dsp/plate';
import { BowedString } from '@/audio/engines/physical-dsp/bowed';
import { resolveMidiNote } from '@/audio/tuning/resolver';
import type { TuningRef } from '@/audio/tuning/types';
import {
  SR,
  seeded,
  rms,
  allFinite,
  peak,
} from '@/audio/engines/physical-dsp/test-util';

/** Cooley-Tukey Radix-2 Fast Fourier Transform */
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  if ((n & (n - 1)) !== 0) throw new Error('FFT length must be a power of 2');

  for (let i = 0, j = 0; i < n; i++) {
    if (i < j) {
      const temp = re[i]!;
      re[i] = re[j]!;
      re[j] = temp;
      const tempIm = im[i]!;
      im[i] = im[j]!;
      im[j] = tempIm;
    }
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2.0 * Math.PI) / len;
    const wlen_re = Math.cos(angle);
    const wlen_im = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let w_re = 1.0;
      let w_im = 0.0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const u_re = re[i + j]!;
        const u_im = im[i + j]!;
        const k = i + j + half;
        const t_re = re[k]! * w_re - im[k]! * w_im;
        const t_im = re[k]! * w_im + im[k]! * w_re;
        re[i + j] = u_re + t_re;
        im[i + j] = u_im + t_im;
        re[k] = u_re - t_re;
        im[k] = u_im - t_im;

        const next_w_re = w_re * wlen_re - w_im * wlen_im;
        w_im = w_re * wlen_im + w_im * wlen_re;
        w_re = next_w_re;
      }
    }
  }
}

/** Analyzes a rendered DSP output and tracks its precise fundamental pitch using noiseless ringdown peak interpolation */
function detectPitch(s: KarplusStrong, fTarget: number): number {
  const N = 16384;

  // 1. Excite the string
  s.setExcitation(0.5);
  for (let i = 0; i < 16384; i++) s.next();

  // 2. Turn off the noise excitation to measure pure loop resonance
  s.setExcitation(0.0);
  for (let i = 0; i < 4096; i++) s.next(); // let transients clear

  // 3. Record N samples for the FFT
  const buf = new Float32Array(N);
  for (let i = 0; i < N; i++) buf[i] = s.next();

  const re = new Float32Array(N);
  const im = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    // Apply Hanning window
    const w = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / (N - 1)));
    re[i] = buf[i]! * w;
  }

  fft(re, im);

  const mag = new Float32Array(N / 2);
  for (let i = 0; i < N / 2; i++) {
    mag[i] = Math.sqrt(re[i]! * re[i]! + im[i]! * im[i]!);
  }

  const binHz = SR / N;
  const targetBin = fTarget / binHz;
  const minBin = Math.max(2, Math.floor(targetBin * 0.7));
  const maxBin = Math.min(N / 2 - 2, Math.ceil(targetBin * 1.3));

  let k_peak = minBin;
  let max_mag = 0;
  for (let k = minBin; k <= maxBin; k++) {
    const val = mag[k]!;
    if (val > max_mag) {
      max_mag = val;
      k_peak = k;
    }
  }

  if (k_peak > 0 && k_peak < N / 2 - 1) {
    const y_alpha = Math.log(mag[k_peak - 1]! + 1e-10);
    const y_beta = Math.log(mag[k_peak]! + 1e-10);
    const y_gamma = Math.log(mag[k_peak + 1]! + 1e-10);
    const denom = y_alpha - 2.0 * y_beta + y_gamma;
    if (Math.abs(denom) > 1e-6) {
      const p = (0.5 * (y_alpha - y_gamma)) / denom;
      return (k_peak + p) * binHz;
    }
  }

  return k_peak * binHz;
}

function getMagnitudeSpectrum(dsp: { next: () => number }): Float32Array {
  const N = 16384;
  const discard = 16384;
  for (let i = 0; i < discard; i++) dsp.next();
  const buf = new Float32Array(N);
  for (let i = 0; i < N; i++) buf[i] = dsp.next();

  const re = new Float32Array(N);
  const im = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const w = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / (N - 1)));
    re[i] = buf[i]! * w;
  }
  fft(re, im);

  const mag = new Float32Array(N / 2);
  for (let i = 0; i < N / 2; i++) {
    mag[i] = Math.sqrt(re[i]! * re[i]! + im[i]! * im[i]!);
  }
  return mag;
}

function computeSpectralCentroid(mag: Float32Array): number {
  let num = 0;
  let den = 0;
  for (let k = 1; k < mag.length; k++) {
    const val = mag[k]!;
    num += k * val;
    den += val;
  }
  return den > 0 ? num / den : 0;
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

  it('tuning accuracy: measured fundamental frequency is within ±2 cents of target across sweep range', () => {
    // Sweep f0: 55, 110, 440, 880, 1760 Hz
    const targets = [55, 110, 440, 880, 1760];
    for (const fTarget of targets) {
      // High sustain (damping=0.1) and bright string (brightness=0.7) to give a sharp fundamental peak
      // We use excitation=0.2 to ensure the loop resonance builds up cleanly with minimal noise fluctuation.
      const s = new KarplusStrong(SR, fTarget, 0.1, 0.7, 0.2, seeded(fTarget));
      const fMeas = detectPitch(s, fTarget);
      const cents = 1200 * Math.log2(fMeas / fTarget);
      console.log(
        `Target: ${fTarget} Hz, Measured: ${fMeas.toFixed(3)} Hz, Cents: ${cents.toFixed(3)}`,
      );
      expect(Math.abs(cents)).toBeLessThan(2.0);
    }
  });

  it('harmonicity: partials remain a perfect harmonic series n * f0 within tolerance', () => {
    const fTarget = 220;
    const s = new KarplusStrong(SR, fTarget, 0.1, 0.7, 0.2, seeded(fTarget));

    // Pitch detection on the fundamental
    const fMeas1 = detectPitch(s, fTarget);
    expect(Math.abs(1200 * Math.log2(fMeas1 / fTarget))).toBeLessThan(2.0);

    // Now look for the 2nd harmonic peak (around 2 * fTarget = 440 Hz)
    const fMeas2 = detectPitch(s, fTarget * 2);
    expect(Math.abs(1200 * Math.log2(fMeas2 / (fTarget * 2)))).toBeLessThan(
      5.0,
    );
  });

  it('microtonal round-trip: resolves a non-12-TET just ratio from the tuning system and synthesizes within ±2 cents', () => {
    const tuning: TuningRef = { system: 'just-7', referenceA4Hz: 440 };
    // MIDI 64 (E4) under 7-limit just intonation should be non-12-TET
    const targetHz = resolveMidiNote(tuning, 64);

    const s = new KarplusStrong(SR, targetHz, 0.1, 0.7, 0.2, seeded(64));
    const fMeas = detectPitch(s, targetHz);
    const cents = 1200 * Math.log2(fMeas / targetHz);
    expect(Math.abs(cents)).toBeLessThan(2.0);
  });

  it('bow vs. pluck richness: bowed mode produces a richer harmonic spectrum (higher centroid) than plucked mode', () => {
    const fTarget = 220;

    // Plucked string (noise excitation)
    const plucked = new KarplusStrong(SR, fTarget, 0.4, 0.7, 0.6, seeded(100));
    const pluckedMag = getMagnitudeSpectrum(plucked);
    const pluckedCentroid = computeSpectralCentroid(pluckedMag);

    // Bowed string
    const bowed = new BowedString(SR, fTarget, 0.4, 0.7, 0.6, 0.5, 0.5);
    const bowedMag = getMagnitudeSpectrum(bowed);
    const bowedCentroid = computeSpectralCentroid(bowedMag);

    // Bowed string Helmholtz sustained tone has higher spectral centroid than a plucked noise decay/aeolian tone
    expect(bowedCentroid).toBeGreaterThan(pluckedCentroid);
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

  it('creates plate bank cleanly', () => {
    const bank = createPlateBank(SR, 10);
    expect(bank).toBeDefined();
    expect(bank.next).toBeDefined();
  });
});
