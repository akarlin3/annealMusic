/**
 * Digital waveguide string, extended for *continuous* excitation.
 *
 * A delay line w/ 3rd-order Lagrange fractional-delay loop and exact loop low-pass
 * phase-delay compensation. The classic algorithm seeds the line with a burst of noise
 * once (a pluck); the ambient extension instead injects filtered noise every sample,
 * so the string sustains like a bowed/aeolian tone. `damping` sets the feedback
 * gain (string Q / decay); `brightness` sets the loop low-pass cutoff.
 *
 * Pure DSP (no worklet globals): the single source of truth, bundled into the
 * worklet and unit-tested directly.
 */
import { NoiseExciter } from '@/audio/engines/physical-dsp/noise';

export class KarplusStrong {
  private readonly sampleRate: number;
  private buf: Float32Array;
  private idx = 0;
  private delay: number;
  /** Feedback low-pass state. */
  private lp = 0;
  /** Feedback gain (just below 1; damping pulls it down). */
  private fb: number;
  /** Loop low-pass coefficient (brightness). */
  private loopCoef: number;
  private readonly exciter: NoiseExciter;
  private detuneCents = 0;
  private baseFreq: number;

  constructor(
    sampleRate: number,
    f0 = 110,
    damping = 0.5,
    brightness = 0.5,
    excitation = 0.5,
    rng: () => number = Math.random,
  ) {
    this.sampleRate = sampleRate;
    this.baseFreq = f0;
    // Max delay sized for the lowest supported fundamental (~20 Hz).
    this.buf = new Float32Array(Math.ceil(sampleRate / 20) + 4);
    this.fb = dampingToFeedback(damping);
    this.loopCoef = brightnessToLoopCoef(brightness);
    this.delay = this.computeDelay();
    this.exciter = new NoiseExciter(sampleRate, excitation, brightness, rng);
  }

  private computeDelay(): number {
    const freq = this.baseFreq * Math.pow(2, this.detuneCents / 1200);
    const dTarget = this.sampleRate / Math.max(20, freq);
    // Exact phase delay of one-pole low-pass: theta / w
    const w = (2.0 * Math.PI * freq) / this.sampleRate;
    const c = this.loopCoef;
    const theta = Math.atan2(
      (1.0 - c) * Math.sin(w),
      1.0 - (1.0 - c) * Math.cos(w),
    );
    const dLp = w > 0.0 ? theta / w : (1.0 - c) / c;
    const dCompensated = dTarget - dLp;
    // Clamp to ensure stable and safe Lagrange buffer reads (min 2.0, max buf.length - 3)
    return Math.max(2.0, Math.min(this.buf.length - 3.0, dCompensated));
  }

  setFrequency(f0: number): void {
    this.baseFreq = f0;
    this.delay = this.computeDelay();
  }

  setDetuneCents(cents: number): void {
    this.detuneCents = cents;
    this.delay = this.computeDelay();
  }

  setDamping(damping: number): void {
    this.fb = dampingToFeedback(damping);
  }

  setBrightness(brightness: number): void {
    this.loopCoef = brightnessToLoopCoef(brightness);
    this.exciter.setBrightness(brightness);
    this.delay = this.computeDelay();
  }

  setExcitation(level: number): void {
    this.exciter.setLevel(level);
  }

  next(): number {
    const len = this.buf.length;
    const readPos = (this.idx - this.delay + len) % len;
    const i0 = Math.floor(readPos);
    const d = readPos - i0; // fractional part [0, 1)

    // Branch bounds checks instead of 4 expensive modulo operations
    let im1 = i0 - 1;
    if (im1 < 0) im1 += len;

    let ip1 = i0 + 1;
    if (ip1 >= len) ip1 -= len;

    let ip2 = i0 + 2;
    if (ip2 >= len) ip2 -= len;

    const y_neg1 = this.buf[im1] ?? 0;
    const y_0 = this.buf[i0] ?? 0;
    const y_1 = this.buf[ip1] ?? 0;
    const y_2 = this.buf[ip2] ?? 0;

    // Lagrange polynomial coefficients
    const c_neg1 = (-d * (d - 1) * (d - 2)) / 6;
    const c_0 = ((d + 1) * (d - 1) * (d - 2)) / 2;
    const c_1 = (-(d + 1) * d * (d - 2)) / 2;
    const c_2 = ((d + 1) * d * (d - 1)) / 6;

    const sample = c_neg1 * y_neg1 + c_0 * y_0 + c_1 * y_1 + c_2 * y_2;

    // One-pole low-pass in the feedback path (string losses → brightness).
    this.lp += this.loopCoef * (sample - this.lp);
    const fed = this.lp * this.fb;

    // Continuous excitation: inject filtered noise so the string sustains.
    this.buf[this.idx] = fed + this.exciter.next();

    this.idx++;
    if (this.idx >= len) this.idx = 0;

    return sample;
  }

  render(out: Float32Array): void {
    for (let i = 0; i < out.length; i++) out[i] = this.next();
  }
}

/** Damping 0..1 → feedback gain. Low damping ⇒ long sustain (≈0.999). */
export function dampingToFeedback(damping: number): number {
  const d = Math.max(0, Math.min(1, damping));
  return 0.999 - d * 0.06;
}

/** Brightness 0..1 → loop low-pass coefficient (higher = brighter string). */
export function brightnessToLoopCoef(brightness: number): number {
  const b = Math.max(0, Math.min(1, brightness));
  return 0.2 + b * 0.79;
}
