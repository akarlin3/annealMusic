import { describe, expect, it } from 'vitest';
import {
  renderDSP,
  applyHannWindow,
  computeFFTSpectrum,
  getMagnitudeSpectrum,
  peakFrequencies,
  spectralCentroid,
} from '@/audio/analysis/spectrum';

describe('Spectral Analysis Harness Helpers', () => {
  it('renders mono samples from a pure DSP object using next()', () => {
    let count = 0;
    const stub = {
      next: () => {
        count++;
        return 0.1 * count;
      },
    };

    const buffer = renderDSP(stub, 5);
    expect(buffer).toBeInstanceOf(Float32Array);
    expect(buffer).toHaveLength(5);
    expect(buffer[0]).toBeCloseTo(0.1, 5);
    expect(buffer[4]).toBeCloseTo(0.5, 5);
    expect(count).toBe(5);
  });

  it('renders mono samples from a pure DSP object using render()', () => {
    const stub = {
      render: (out: Float32Array) => {
        for (let i = 0; i < out.length; i++) out[i] = 0.5;
      },
    };

    const buffer = renderDSP(stub, 10);
    expect(buffer).toHaveLength(10);
    for (let i = 0; i < 10; i++) {
      expect(buffer[i]).toBe(0.5);
    }
  });

  it('applies the Hann window correctly (zero at boundaries, full in the middle)', () => {
    const N = 64;
    const samples = new Float32Array(N).fill(1);
    const windowed = applyHannWindow(samples);

    // End points should be 0 (or extremely close)
    expect(windowed[0]).toBeCloseTo(0, 5);
    expect(windowed[N - 1]).toBeCloseTo(0, 5);

    // The center should be close to 1 (at N=64, center is at 31.5, index 32 is slightly off-center)
    expect(windowed[N / 2]).toBeCloseTo(1, 2);

    // Symmetric values
    expect(windowed[10]).toBeCloseTo(windowed[N - 1 - 10] ?? 0, 5);
  });

  it('measures frequency of a pure sinusoid within a few cents via parabolic interpolation', () => {
    const SR = 44100;
    const N = 2048;
    const targetFreq = 440; // A4

    const samples = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      samples[i] = Math.sin((2 * Math.PI * targetFreq * i) / SR);
    }

    const windowed = applyHannWindow(samples);
    const { real, imag } = computeFFTSpectrum(windowed, 2); // Pad to 4096 for finer resolution
    const mags = getMagnitudeSpectrum(real, imag);

    const peaks = peakFrequencies(mags, SR, 4096, { maxPeaks: 1, minDb: -30 });
    expect(peaks).toHaveLength(1);

    const peak = peaks[0]!;
    // Target 440 Hz. Bin spacing at 4096 is 44100 / 4096 = 10.76 Hz.
    // Without interpolation, bin is 41 (441.4 Hz).
    // With parabolic interpolation, we should be extremely close (within 1-2 Hz).
    expect(peak.frequency).toBeCloseTo(targetFreq, 0);

    // Confirm error in cents: 1200 * log2(measured / target)
    const centsError = 1200 * Math.log2(peak.frequency / targetFreq);
    expect(Math.abs(centsError)).toBeLessThan(5); // Well within 5 cents!
  });

  it('identifies spectral centroid shifts indicating brightness changes', () => {
    const SR = 44100;
    const N = 1024;

    const generateSine = (f: number) => {
      const s = new Float32Array(N);
      for (let i = 0; i < N; i++) s[i] = Math.sin((2 * Math.PI * f * i) / SR);
      const w = applyHannWindow(s);
      const { real, imag } = computeFFTSpectrum(w, 1);
      return getMagnitudeSpectrum(real, imag);
    };

    const magsLow = generateSine(200);
    const magsHigh = generateSine(2000);

    const centroidLow = spectralCentroid(magsLow, SR, N);
    const centroidHigh = spectralCentroid(magsHigh, SR, N);

    expect(centroidHigh).toBeGreaterThan(centroidLow);
    // Custom robust threshold checks to avoid strictness issues in toBeCloseTo
    expect(Math.abs(centroidLow - 200)).toBeLessThan(10);
    expect(Math.abs(centroidHigh - 2000)).toBeLessThan(50);
  });
});
