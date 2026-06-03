import { describe, expect, it } from 'vitest';
import { fft } from '@/audio/analysis/fft';

describe('Cooley-Tukey Radix-2 FFT', () => {
  it('correctly transforms a DC signal (all constants)', () => {
    const N = 64;
    const real = new Float32Array(N).fill(1.5);
    const imag = new Float32Array(N).fill(0);

    fft(real, imag);

    // DC signal should land entirely in bin 0 with amplitude N * DC
    expect(real[0]).toBeCloseTo(1.5 * N, 4);
    expect(imag[0]).toBeCloseTo(0, 4);

    // All other bins should be zero
    for (let k = 1; k < N; k++) {
      expect(real[k]).toBeCloseTo(0, 4);
      expect(imag[k]).toBeCloseTo(0, 4);
    }
  });

  it('identifies the exact bin of a single sinusoid', () => {
    const N = 128;
    const bin = 5; // Target frequency bin
    const real = new Float32Array(N);
    const imag = new Float32Array(N).fill(0);

    // Generate sinusoidal wave: x[n] = cos(2 * pi * bin * n / N)
    for (let n = 0; n < N; n++) {
      real[n] = Math.cos((2 * Math.PI * bin * n) / N);
    }

    fft(real, imag);

    // Energy should concentrate at bin 5 and bin N - 5 (conjugate symmetric)
    const mag5 = Math.sqrt((real[bin] ?? 0) ** 2 + (imag[bin] ?? 0) ** 2);
    const magSym = Math.sqrt(
      (real[N - bin] ?? 0) ** 2 + (imag[N - bin] ?? 0) ** 2,
    );

    expect(mag5).toBeCloseTo(N / 2, 4);
    expect(magSym).toBeCloseTo(N / 2, 4);

    // Other bins (except bin 5 and symmetric companion) should be very small
    for (let k = 0; k < N; k++) {
      if (k !== bin && k !== N - bin) {
        const mag = Math.sqrt((real[k] ?? 0) ** 2 + (imag[k] ?? 0) ** 2);
        expect(mag).toBeLessThan(1e-3);
      }
    }
  });

  it('respects linearity: FFT(A + B) = FFT(A) + FFT(B)', () => {
    const N = 64;
    const realA = new Float32Array(N);
    const imagA = new Float32Array(N);
    const realB = new Float32Array(N);
    const imagB = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      realA[i] = Math.sin((2 * Math.PI * 3 * i) / N);
      realB[i] = Math.cos((2 * Math.PI * 7 * i) / N);
    }

    // Individual FFTs
    const outRealA = new Float32Array(realA);
    const outImagA = new Float32Array(imagA);
    fft(outRealA, outImagA);

    const outRealB = new Float32Array(realB);
    const outImagB = new Float32Array(imagB);
    fft(outRealB, outImagB);

    // Linear sum in time domain
    const sumReal = new Float32Array(N);
    const sumImag = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      sumReal[i] = (realA[i] ?? 0) + (realB[i] ?? 0);
      sumImag[i] = (imagA[i] ?? 0) + (imagB[i] ?? 0);
    }

    // FFT of sum
    fft(sumReal, sumImag);

    // Assert additive property
    for (let k = 0; k < N; k++) {
      expect(sumReal[k]).toBeCloseTo(
        (outRealA[k] ?? 0) + (outRealB[k] ?? 0),
        4,
      );
      expect(sumImag[k]).toBeCloseTo(
        (outImagA[k] ?? 0) + (outImagB[k] ?? 0),
        4,
      );
    }
  });

  it("conserves energy in compliance with Parseval's theorem", () => {
    const N = 256;
    const real = new Float32Array(N);
    const imag = new Float32Array(N);

    // Random seeded-ish signal in time domain
    for (let n = 0; n < N; n++) {
      real[n] = Math.sin(0.123 * n) + 0.5 * Math.cos(0.987 * n);
      imag[n] = 0.2 * Math.sin(0.456 * n);
    }

    // Energy in time domain
    let energyTime = 0;
    for (let n = 0; n < N; n++) {
      energyTime += (real[n] ?? 0) ** 2 + (imag[n] ?? 0) ** 2;
    }

    fft(real, imag);

    // Energy in frequency domain
    let energyFreq = 0;
    for (let k = 0; k < N; k++) {
      energyFreq += (real[k] ?? 0) ** 2 + (imag[k] ?? 0) ** 2;
    }

    // Parseval: sum(time^2) = 1/N * sum(freq^2)
    expect(energyTime).toBeCloseTo(energyFreq / N, 4);
  });
});
