import { describe, expect, it } from 'vitest';
import { ModalBank } from '@/audio/engines/physical-dsp/modal-bank';
import { KarplusStrong } from '@/audio/engines/physical-dsp/string';
import { bellEigen } from '@/audio/engines/physical-dsp/bell';
import { plateEigen } from '@/audio/engines/physical-dsp/plate';
import { membraneEigen } from '@/audio/engines/physical-dsp/membrane';
import { malletEigen } from '@/audio/engines/physical-dsp/mallet';
import { seeded } from '@/audio/engines/physical-dsp/test-util';
import {
  renderDSP,
  applyHannWindow,
  computeFFTSpectrum,
  getMagnitudeSpectrum,
  peakFrequencies,
  spectralCentroid,
} from '@/audio/analysis/spectrum';

const SR = 48000;
const F0 = 220; // Use A3 (220 Hz) to increase absolute mode spacing (Hz)

describe('Spectral DSP Physics Correctness Test Suite', () => {
  describe('Modal Bank Eigenfrequencies', () => {
    const runModalEigenTest = (
      name: string,
      eigen: (n: number, s1: number, s2: number) => number,
      modeCount: number,
      shape1: number,
      shape2: number,
      centsTolerance = 45,
    ) => {
      it(`verifies ${name} eigenfrequency ratios against the theoretical series`, () => {
        const bank = new ModalBank({
          sampleRate: SR,
          eigen,
          f0: F0,
          damping: 0.02, // extremely low damping = very high Q = sharp, smooth peaks
          brightness: 0.85,
          excitation: 0.0, // Start silent
          shape1,
          shape2,
          modeCount,
          rng: seeded(42),
        });

        // 1. Pluck excitation: inject a brief burst of noise
        bank.setExcitation(1.0);
        for (let i = 0; i < 200; i++) bank.next();

        // 2. Turn off excitation to allow pure, noiseless ringing
        bank.setExcitation(0.0);

        // 3. Render steady state ringing samples (4096 is plenty of energy for sharp peaks)
        const samples = renderDSP(bank, 4096);
        const windowed = applyHannWindow(samples);

        // 4. FFT with 8x zero padding to get 32768 size for fine bins
        const { real, imag } = computeFFTSpectrum(windowed, 8);
        const fftSize = 32768;
        const mags = getMagnitudeSpectrum(real, imag);

        // Extract peaks (noise floor is 0, so even quiet modes stand out perfectly)
        const peaks = peakFrequencies(mags, SR, fftSize, {
          maxPeaks: modeCount + 8,
          minDb: -80, // Noise floor is extremely low, so we can pick deep peaks
        });

        // Check the first few modes specifically
        const checkModes = Math.min(3, modeCount);
        for (let n = 0; n < checkModes; n++) {
          const expectedRatio = eigen(n, shape1, shape2);
          const expectedFreq = F0 * expectedRatio;

          // Find the nearest measured peak to the expected frequency
          let minCentsDiff = Infinity;
          let bestPeakFreq = -1;

          for (const peak of peaks) {
            const ratio = peak.frequency / expectedFreq;
            const centsDiff = Math.abs(1200 * Math.log2(ratio));
            if (centsDiff < minCentsDiff) {
              minCentsDiff = centsDiff;
              bestPeakFreq = peak.frequency;
            }
          }

          // Assert the closest measured peak matches the theoretical mode within tolerance
          expect(
            minCentsDiff,
            `Expected ${name} mode ${n} at ${expectedFreq.toFixed(1)} Hz (ratio ${expectedRatio.toFixed(3)}), nearest peak at ${bestPeakFreq.toFixed(1)} Hz`,
          ).toBeLessThan(centsTolerance);
        }
      });
    };

    runModalEigenTest('Bell', bellEigen, 9, 0.2, 0.5, 45);
    // Use shape1 = 1.0 (max inharmonicity) for Plate to stretch mode spacing and prevent FFT peak merging
    runModalEigenTest('Plate', plateEigen, 12, 1.0, 0.0, 45);
    runModalEigenTest('Membrane', membraneEigen, 12, 0.3, 0.1, 45);
    runModalEigenTest('Mallet', malletEigen, 6, 0.6, 0.0, 45);
  });

  describe('Karplus-Strong String Harmonicity & Tuning Limitations', () => {
    it('proves harmonicity at low f0 (A2, 110 Hz)', () => {
      const f0 = 110;
      // Settle with low decay so harmonics stay stable
      const string = new KarplusStrong(SR, f0, 0.01, 0.95, 0.0, seeded(100));

      // 1. Pluck excitation: inject a brief burst of noise
      string.setExcitation(1.0);
      for (let i = 0; i < 200; i++) string.next();

      // 2. Decay phase: turn off excitation to let the string ring out cleanly
      string.setExcitation(0.0);

      // 3. Render ringing immediately (4096 samples is plenty of energy)
      const samples = renderDSP(string, 4096);
      const windowed = applyHannWindow(samples);
      const { real, imag } = computeFFTSpectrum(windowed, 8); // pad to 32768
      const fftSize = 32768;
      const mags = getMagnitudeSpectrum(real, imag);

      // Find peak partials (extract many to ensure we catch higher harmonics)
      const peaks = peakFrequencies(mags, SR, fftSize, {
        maxPeaks: 15,
        minDb: -60,
      });

      // Assert that a fundamental peak near 110 Hz is present
      const fundamentalPeak = peaks.find(
        (p) => Math.abs(p.frequency - f0) < 10,
      );
      expect(
        fundamentalPeak,
        'Fundamental peak near 110 Hz should be found',
      ).toBeDefined();

      // Assert that ALL picked peaks are integer multiples (harmonics) of the fundamental frequency
      for (const peak of peaks) {
        if (peak.frequency < f0 - 5) continue; // Skip sub-fundamental noise
        const ratio = peak.frequency / f0;
        const harmonicIndex = Math.round(ratio);
        const expectedFreq = harmonicIndex * f0;

        const centsDiff = Math.abs(
          1200 * Math.log2(peak.frequency / expectedFreq),
        );
        expect(
          centsDiff,
          `Peak at ${peak.frequency.toFixed(1)} Hz should correspond to harmonic ${harmonicIndex} (expected ${expectedFreq} Hz)`,
        ).toBeLessThan(35);
      }
    });

    it('documents and measures the high-f0 integer delay tuning deviation (flatness)', () => {
      // Expose the integer-delay tuning error at high f0.
      // Use a shorter analysis window (2048 samples) to capture the peak before loop loss decay,
      // and moderately dark loop filter to maximize phase delay flatness.
      const highF0 = 1600;
      const string = new KarplusStrong(SR, highF0, 0.01, 0.3, 0.0, seeded(200));

      // Pluck excitation
      string.setExcitation(1.0);
      for (let i = 0; i < 150; i++) string.next();
      string.setExcitation(0.0);

      const samples = renderDSP(string, 2048); // Capture 2048 samples immediately
      const windowed = applyHannWindow(samples);
      const { real, imag } = computeFFTSpectrum(windowed, 16); // Zero-pad by 16x to get 32768 size for fine bins
      const fftSize = 32768;
      const mags = getMagnitudeSpectrum(real, imag);

      const peaks = peakFrequencies(mags, SR, fftSize, {
        maxPeaks: 5,
        minDb: -60,
      });

      // Find the fundamental peak near 1600 Hz
      const fundamentalPeak = peaks.find(
        (p) => Math.abs(p.frequency - highF0) < 300,
      );
      expect(fundamentalPeak, 'Fundamental peak should be found').toBeDefined();

      if (fundamentalPeak) {
        const centsDeviation =
          1200 * Math.log2(fundamentalPeak.frequency / highF0);

        console.log(
          `[LIMITATION DOCUMENTATION] Karplus-Strong at high f0 = ${highF0} Hz, ` +
            `measured pitch is ${fundamentalPeak.frequency.toFixed(1)} Hz, ` +
            `deviation is ${centsDeviation.toFixed(2)} cents (flat).`,
        );

        // Assert that it runs flat (measurable flat deviation, typically 0.2 - 80 cents flat)
        expect(centsDeviation).toBeLessThan(-0.2);
        expect(centsDeviation).toBeGreaterThan(-80);
      }
    });
  });

  describe('Damping ⇒ Q / Bandwidth Verification', () => {
    const getBandwidthForDamping = (damping: number): number => {
      // Use higher fundamental (1000 Hz) to broaden absolute filter bandwidth in Hz,
      // and pluck excitation to make it noise-free.
      const bank = new ModalBank({
        sampleRate: SR,
        eigen: () => 1.0,
        f0: 1000,
        damping,
        brightness: 0.9,
        excitation: 0.0,
        modeCount: 1,
        rng: seeded(500),
      });

      // Pluck excitation
      bank.setExcitation(1.0);
      for (let i = 0; i < 150; i++) bank.next();
      bank.setExcitation(0.0);

      const samples = renderDSP(bank, 16384);
      const windowed = applyHannWindow(samples);
      const { real, imag } = computeFFTSpectrum(windowed, 2);
      const fftSize = 32768;
      const mags = getMagnitudeSpectrum(real, imag);

      // Find peak
      let maxMag = 0;
      let peakIdx = -1;
      for (let i = 0; i < mags.length; i++) {
        const m = mags[i] ?? 0;
        if (m > maxMag) {
          maxMag = m;
          peakIdx = i;
        }
      }

      const targetMag = maxMag / Math.sqrt(2); // -3 dB amplitude

      let f1 = 0;
      for (let i = peakIdx; i >= 0; i--) {
        if ((mags[i] ?? 0) <= targetMag) {
          f1 = (i * SR) / fftSize;
          break;
        }
      }

      let f2 = SR / 2;
      for (let i = peakIdx; i < mags.length; i++) {
        if ((mags[i] ?? 0) <= targetMag) {
          f2 = (i * SR) / fftSize;
          break;
        }
      }

      return f2 - f1;
    };

    it('verifies that lowering damping increases Q (narrows the -3 dB bandwidth)', () => {
      // damping = 0.95 => Q = 20 (wider bandwidth)
      // damping = 0.50 => Q = 128 (narrower bandwidth)
      const bwDamped = getBandwidthForDamping(0.95);
      const bwRinging = getBandwidthForDamping(0.5);

      expect(bwRinging).toBeLessThan(bwDamped);
      expect(bwDamped / bwRinging).toBeGreaterThan(1.5);
    });
  });

  describe('Brightness ⇒ Spectral Centroid Verification', () => {
    it('proves that raising brightness shifts the spectral centroid higher', () => {
      const getStringCentroid = (brightness: number): number => {
        const string = new KarplusStrong(
          SR,
          220,
          0.3,
          brightness,
          1.0,
          seeded(700),
        );
        renderDSP(string, 8192);
        const samples = renderDSP(string, 16384);
        const windowed = applyHannWindow(samples);
        const { real, imag } = computeFFTSpectrum(windowed, 1);
        const mags = getMagnitudeSpectrum(real, imag);

        return spectralCentroid(mags, SR, 16384);
      };

      const centroidDark = getStringCentroid(0.2);
      const centroidBright = getStringCentroid(0.85);

      expect(centroidBright).toBeGreaterThan(centroidDark);
    });
  });
});
