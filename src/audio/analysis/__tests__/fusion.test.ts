import { describe, expect, it } from 'vitest';
import { applyFusion, fusionMultipliers, FUSION_DEPTH } from '@/audio/fusion';
import { seeded } from '@/audio/engines/physical-dsp/test-util';
import {
  applyHannWindow,
  computeFFTSpectrum,
  getMagnitudeSpectrum,
  spectralCentroid,
} from '@/audio/analysis/spectrum';

/**
 * Spectral proof for synchronization-driven spectral fusion (see
 * `src/audio/fusion.ts` and `docs/DSP_THEORY.md` §1.6).
 *
 * These tests render a *pure additive partial bank* — exactly what the
 * SineEngine sums in WebAudio — with fusion-modulated gains, then use the FFT
 * harness to confirm the predicted spectral signature: as the Kuramoto order
 * parameter `r` rises, the fused harmonic energy grows monotonically; at
 * `amount = 0` the spectrum is bit-for-bit the pre-fusion baseline. Everything
 * is deterministic under a seeded RNG and runs offline.
 */

const SR = 48000;
const F0 = 220; // A3 — wide absolute mode spacing in Hz
const N_SAMPLES = 4096;
const ZERO_PAD = 4; // 4096 * 4 = 16384 (power of two)

/** Sum of sines at the given frequencies with per-partial gains and phases. */
function renderAdditive(
  freqs: readonly number[],
  gains: readonly number[],
  phases: readonly number[],
  n = N_SAMPLES,
  sr = SR,
): Float32Array {
  const out = new Float32Array(n);
  for (let s = 0; s < n; s++) {
    const t = s / sr;
    let v = 0;
    for (let i = 0; i < freqs.length; i++) {
      v +=
        (gains[i] ?? 0) *
        Math.sin(2 * Math.PI * (freqs[i] ?? 0) * t + (phases[i] ?? 0));
    }
    out[s] = v;
  }
  return out;
}

/** Total spectral energy: Σ |X(f)|² over the magnitude spectrum. */
function totalSpectralEnergy(samples: Float32Array): number {
  const windowed = applyHannWindow(samples);
  const { real, imag } = computeFFTSpectrum(windowed, ZERO_PAD);
  const mags = getMagnitudeSpectrum(real, imag);
  let e = 0;
  for (let i = 0; i < mags.length; i++) {
    const m = mags[i] ?? 0;
    e += m * m;
  }
  return e;
}

function centroidOf(samples: Float32Array): number {
  const windowed = applyHannWindow(samples);
  const { real, imag } = computeFFTSpectrum(windowed, ZERO_PAD);
  const mags = getMagnitudeSpectrum(real, imag);
  return spectralCentroid(mags, SR, N_SAMPLES * ZERO_PAD);
}

/** Complex order parameter of a phase set: r·e^{iψ} = (1/N)·Σ e^{iθ}. */
function orderParameter(phases: readonly number[]): { r: number; psi: number } {
  let c = 0;
  let s = 0;
  for (const p of phases) {
    c += Math.cos(p);
    s += Math.sin(p);
  }
  c /= phases.length;
  s /= phases.length;
  return { r: Math.hypot(c, s), psi: Math.atan2(s, c) };
}

const RATIOS = [1, 2, 3, 4, 5, 6];
const FREQS = RATIOS.map((r) => F0 * r);
const BASE_GAINS = RATIOS.map((_, i) => 1 / (i + 1));

describe('Synchronization-Driven Spectral Fusion', () => {
  describe('Pure fusion core', () => {
    it('is behavior-preserving at amount = 0 (every multiplier is exactly 1)', () => {
      const rng = seeded(11);
      const phases = RATIOS.map(() => rng() * 2 * Math.PI);
      const { psi } = orderParameter(phases);

      const mults = fusionMultipliers(phases, psi, 0);
      for (const m of mults) expect(m).toBe(1);

      const fused = applyFusion(BASE_GAINS, phases, psi, 0);
      for (let i = 0; i < BASE_GAINS.length; i++) {
        expect(fused[i]).toBe(BASE_GAINS[i]);
      }
    });

    it('matches the mean-field identity: mean multiplier = 1 + ½·depth·amount·r', () => {
      const rng = seeded(23);
      for (const amount of [0.25, 0.5, 0.8, 1.0]) {
        // Average over several random phase configurations.
        for (let trial = 0; trial < 5; trial++) {
          const phases = RATIOS.map(() => rng() * 2 * Math.PI);
          const { r, psi } = orderParameter(phases);
          const mults = fusionMultipliers(phases, psi, amount);
          const mean = mults.reduce((a, b) => a + b, 0) / mults.length;
          const predicted = 1 + 0.5 * FUSION_DEPTH * amount * r;
          expect(mean).toBeCloseTo(predicted, 6);
        }
      }
    });
  });

  describe('Spectral signature (FFT harness)', () => {
    it('limit correctness: at amount = 0 the spectrum equals the pre-fusion baseline', () => {
      const rng = seeded(31);
      const phases = RATIOS.map(() => rng() * 2 * Math.PI);
      const { psi } = orderParameter(phases);

      const baseline = renderAdditive(FREQS, BASE_GAINS, phases);
      const fused = renderAdditive(
        FREQS,
        applyFusion(BASE_GAINS, phases, psi, 0),
        phases,
      );

      expect(totalSpectralEnergy(fused)).toBeCloseTo(
        totalSpectralEnergy(baseline),
        9,
      );
    });

    it('monotone fusion: rising order parameter r monotonically increases fused harmonic energy (flat spectrum)', () => {
      const amount = 1.0;
      // Evenly spaced phases (r = 0, fully incoherent), contracted toward the
      // mean as `lock` rises so r sweeps the full range up to fully locked
      // (r → 1). Equal base gains isolate the fusion mechanism: with a flat
      // base spectrum the rendered harmonic energy is ∝ Σ mᵢ², which the model
      // predicts rises monotonically with r.
      const flatGains = RATIOS.map(() => 1);
      const spread = RATIOS.map((_, i) => (2 * Math.PI * i) / RATIOS.length);

      const rows: { lock: number; r: number; energy: number }[] = [];
      for (let lock = 0; lock <= 1.0001; lock += 0.125) {
        const phases = spread.map((p) => p * (1 - lock));
        const { r, psi } = orderParameter(phases);
        const gains = applyFusion(flatGains, phases, psi, amount);
        rows.push({
          lock,
          r,
          energy: totalSpectralEnergy(renderAdditive(FREQS, gains, phases)),
        });
      }

      // r rises monotonically as the bank contracts toward unison.
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i]!.r).toBeGreaterThan(rows[i - 1]!.r - 1e-9);
      }

      // Fused harmonic energy rises monotonically with r.
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i]!.energy).toBeGreaterThan(rows[i - 1]!.energy);
      }

      const first = rows[0]!;
      const last = rows[rows.length - 1]!;
      const gainDb = 10 * Math.log10(last.energy / first.energy);
      // eslint-disable-next-line no-console
      console.log(
        `[FUSION] amount=1 (flat spectrum): r ${first.r.toFixed(3)}→${last.r.toFixed(3)} ` +
          `raised fused energy by ${gainDb.toFixed(2)} dB ` +
          `(×${(last.energy / first.energy).toFixed(3)}); predicted ×2.000 (+3.01 dB).`,
      );

      // r = 0 → 1 at amount = 1 doubles the energy (Σmᵢ²: N → N·2.25 for the
      // uniform part; ×2.0 overall here), i.e. +3.0 dB of coherent reinforcement.
      expect(last.energy / first.energy).toBeGreaterThan(1.9);
      expect(last.energy / first.energy).toBeLessThan(2.1);
    });

    it('measurably concentrates energy under the realistic 1/(i+1) voicing', () => {
      // With the meditation-default rolloff voicing, fusion redistributes
      // per-partial energy (it is not strictly monotone step-to-step — the
      // fundamental, already aligned at ψ, is boosted first), but the locked
      // spectrum still carries measurably more harmonic energy than the
      // incoherent one. This is the honest, realistic-voicing result.
      const amount = 1.0;
      const spread = RATIOS.map((_, i) => (2 * Math.PI * i) / RATIOS.length);

      const incoherent = spread; // r = 0
      const locked = spread.map(() => 0); // r = 1

      const cInc = orderParameter(incoherent);
      const cLock = orderParameter(locked);

      const eInc = totalSpectralEnergy(
        renderAdditive(
          FREQS,
          applyFusion(BASE_GAINS, incoherent, cInc.psi, amount),
          incoherent,
        ),
      );
      const eLock = totalSpectralEnergy(
        renderAdditive(
          FREQS,
          applyFusion(BASE_GAINS, locked, cLock.psi, amount),
          locked,
        ),
      );
      const gainDb = 10 * Math.log10(eLock / eInc);
      // eslint-disable-next-line no-console
      console.log(
        `[FUSION] amount=1 (1/(i+1) voicing): locking r 0→1 raised fused energy ` +
          `by ${gainDb.toFixed(2)} dB (×${(eLock / eInc).toFixed(3)}).`,
      );

      expect(eLock).toBeGreaterThan(eInc * 1.5);
    });

    it('reports the spectral-centroid effect honestly (uniform reinforcement ⇒ ~flat centroid)', () => {
      const amount = 1.0;
      const rng = seeded(57);
      const spread = RATIOS.map(() => (rng() * 2 - 1) * Math.PI);

      const incoherent = spread; // r low
      const locked = spread.map((p) => p * 0); // r = 1

      const cInc = orderParameter(incoherent);
      const cLock = orderParameter(locked);

      const centroidInc = centroidOf(
        renderAdditive(
          FREQS,
          applyFusion(BASE_GAINS, incoherent, cInc.psi, amount),
          incoherent,
        ),
      );
      const centroidLock = centroidOf(
        renderAdditive(
          FREQS,
          applyFusion(BASE_GAINS, locked, cLock.psi, amount),
          locked,
        ),
      );
      const baselineCentroid = centroidOf(
        renderAdditive(FREQS, BASE_GAINS, locked),
      );

      // eslint-disable-next-line no-console
      console.log(
        `[FUSION] centroid: baseline=${baselineCentroid.toFixed(1)} Hz, ` +
          `incoherent=${centroidInc.toFixed(1)} Hz, locked=${centroidLock.toFixed(1)} Hz.`,
      );

      // Honest finding: fusion here is a coherent-energy (loudness-of-fused-tone)
      // effect, not a brightness tilt — at full lock every partial is boosted by
      // the same factor, so the centroid is essentially unchanged from baseline.
      expect(Math.abs(centroidLock - baselineCentroid)).toBeLessThan(
        baselineCentroid * 0.02,
      );
    });
  });

  describe('Coherent vs incoherent summation (the physical premise)', () => {
    it('locked partials sum ~linearly (∝N) while incoherent partials sum ~√N', () => {
      const N = 16;
      const freq = 440;
      const freqs = new Array(N).fill(freq);
      const gains = new Array(N).fill(1);

      // Phase-locked: all aligned.
      const aligned = new Array(N).fill(0);
      // Incoherent: deterministic random phases.
      const rng = seeded(99);
      const random = Array.from({ length: N }, () => rng() * 2 * Math.PI);

      const peakMag = (samples: Float32Array): number => {
        const windowed = applyHannWindow(samples);
        const { real, imag } = computeFFTSpectrum(windowed, ZERO_PAD);
        const mags = getMagnitudeSpectrum(real, imag);
        let max = 0;
        for (let i = 0; i < mags.length; i++) max = Math.max(max, mags[i] ?? 0);
        return max;
      };

      const lockedPeak = peakMag(renderAdditive(freqs, gains, aligned));
      const incoherentPeak = peakMag(renderAdditive(freqs, gains, random));

      const ratio = lockedPeak / incoherentPeak;
      // eslint-disable-next-line no-console
      console.log(
        `[FUSION] coherent/incoherent peak ratio = ${ratio.toFixed(2)} ` +
          `(predicted ≈ √N = ${Math.sqrt(N).toFixed(2)} for ${N} partials).`,
      );

      // Locked amplitude ≈ N; incoherent ≈ √N ⇒ ratio ≈ √N. Allow a generous
      // band for the specific random draw.
      expect(ratio).toBeGreaterThan(Math.sqrt(N) * 0.5);
      expect(ratio).toBeLessThan(Math.sqrt(N) * 2.0);
    });
  });
});
