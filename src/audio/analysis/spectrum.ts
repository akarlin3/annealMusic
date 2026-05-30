import { fft } from '@/audio/analysis/fft';

export interface PeakFrequencyOptions {
  maxPeaks?: number;
  minDb?: number;
}

export interface Peak {
  bin: number;
  interpolatedBin: number;
  frequency: number;
  magnitude: number;
  db: number;
}

/**
 * Renders N samples of mono output from a pure DSP engine.
 */
export function renderDSP(
  dsp: { render: (out: Float32Array) => void } | { next: () => number },
  n: number,
): Float32Array {
  const out = new Float32Array(n);
  if ('render' in dsp && typeof dsp.render === 'function') {
    dsp.render(out);
  } else if ('next' in dsp && typeof dsp.next === 'function') {
    for (let i = 0; i < n; i++) {
      out[i] = dsp.next();
    }
  }
  return out;
}

/**
 * Applies a Hann window to reduce spectral leakage.
 * w[n] = 0.5 * (1 - cos(2 * pi * n / (N - 1)))
 */
export function applyHannWindow(samples: Float32Array): Float32Array {
  const n = samples.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    const s = samples[i];
    if (s !== undefined) {
      out[i] = s * w;
    }
  }
  return out;
}

/**
 * Computes FFT of real windowed samples with optional zero-padding.
 * Returns the full complex spectrum of size windowedSamples.length * zeroPadFactor.
 */
export function computeFFTSpectrum(
  windowedSamples: Float32Array,
  zeroPadFactor = 1,
): { real: Float32Array; imag: Float32Array } {
  const N = windowedSamples.length;
  const fftSize = N * zeroPadFactor;
  if ((fftSize & (fftSize - 1)) !== 0) {
    throw new Error('FFT size (N * zeroPadFactor) must be a power of 2');
  }

  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);
  real.set(windowedSamples);

  fft(real, imag);
  return { real, imag };
}

/**
 * Computes the magnitude spectrum of the first half (0 to N/2) of the FFT.
 */
export function getMagnitudeSpectrum(
  real: Float32Array,
  imag: Float32Array,
): Float32Array {
  const halfSize = real.length >> 1;
  const out = new Float32Array(halfSize);
  for (let i = 0; i < halfSize; i++) {
    const r = real[i];
    const im = imag[i];
    if (r !== undefined && im !== undefined) {
      out[i] = Math.sqrt(r * r + im * im);
    }
  }
  return out;
}

/**
 * Finds prominent peak frequencies using parabolic interpolation for sub-bin accuracy.
 */
export function peakFrequencies(
  magnitudeSpectrum: Float32Array,
  sampleRate: number,
  fftSize: number,
  options: PeakFrequencyOptions = {},
): Peak[] {
  const { maxPeaks = 10, minDb = -50 } = options;
  const peaks: Peak[] = [];

  const dbSpectrum = new Float32Array(magnitudeSpectrum.length);
  // Find local maxima and compute decibel levels
  for (let i = 0; i < magnitudeSpectrum.length; i++) {
    const val = magnitudeSpectrum[i] ?? 0;
    // Standard linear amplitude to decibel conversion, clamped for silence safety
    dbSpectrum[i] = 20 * Math.log10(val + 1e-9);
  }

  // Iterate over internal bins, looking for local maxima
  for (let i = 1; i < magnitudeSpectrum.length - 1; i++) {
    const prev = magnitudeSpectrum[i - 1] ?? 0;
    const curr = magnitudeSpectrum[i] ?? 0;
    const next = magnitudeSpectrum[i + 1] ?? 0;
    const db = dbSpectrum[i] ?? -100;

    if (curr > prev && curr > next && db >= minDb) {
      // Parabolic peak interpolation on log magnitudes (dB) to avoid skew
      const dbPrev = dbSpectrum[i - 1] ?? -100;
      const dbCurr = dbSpectrum[i] ?? -100;
      const dbNext = dbSpectrum[i + 1] ?? -100;

      // Fit parabola: offset d = 0.5 * (alpha - gamma) / (alpha - 2*beta + gamma)
      const alpha = dbPrev;
      const beta = dbCurr;
      const gamma = dbNext;

      const denom = alpha - 2 * beta + gamma;
      let interpolatedBin = i;
      if (Math.abs(denom) > 1e-5) {
        const offset = (0.5 * (alpha - gamma)) / denom;
        interpolatedBin = i + offset;
      }

      const frequency = (interpolatedBin * sampleRate) / fftSize;

      peaks.push({
        bin: i,
        interpolatedBin,
        frequency,
        magnitude: curr,
        db,
      });
    }
  }

  // Sort by descending magnitude / dB
  peaks.sort((a, b) => b.magnitude - a.magnitude);

  return peaks.slice(0, maxPeaks);
}

/**
 * Calculates the spectral centroid: the center of mass of the spectrum.
 * It is a reliable indicator of brightness.
 */
export function spectralCentroid(
  magnitudeSpectrum: Float32Array,
  sampleRate: number,
  fftSize: number,
): number {
  let num = 0;
  let den = 0;

  for (let i = 0; i < magnitudeSpectrum.length; i++) {
    const mag = magnitudeSpectrum[i] ?? 0;
    const freq = (i * sampleRate) / fftSize;
    num += freq * mag;
    den += mag;
  }

  return den > 1e-7 ? num / den : 0;
}
