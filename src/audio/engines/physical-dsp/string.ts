/**
 * Karplus-Strong plucked string, extended for *continuous* excitation.
 *
 * A delay line of length `sampleRate / f0` with a one-pole low-pass in the
 * feedback path. The classic algorithm seeds the line with a burst of noise once
 * (a pluck); the ambient extension instead injects filtered noise every sample,
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
    this.delay = this.computeDelay();
    this.fb = dampingToFeedback(damping);
    this.loopCoef = brightnessToLoopCoef(brightness);
    this.exciter = new NoiseExciter(sampleRate, excitation, brightness, rng);
  }

  private computeDelay(): number {
    const freq = this.baseFreq * Math.pow(2, this.detuneCents / 1200);
    const d = this.sampleRate / Math.max(20, freq);
    return Math.max(2, Math.min(this.buf.length - 1, d));
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
  }

  setExcitation(level: number): void {
    this.exciter.setLevel(level);
  }

  /** Next output sample. */
  next(): number {
    const len = this.buf.length;
    const readPos = (this.idx - this.delay + len) % len;
    const i0 = Math.floor(readPos);
    const frac = readPos - i0;
    const a = this.buf[i0] ?? 0;
    const b = this.buf[(i0 + 1) % len] ?? 0;
    const sample = a + frac * (b - a);

    // One-pole low-pass in the feedback path (string losses → brightness).
    this.lp += this.loopCoef * (sample - this.lp);
    const fed = this.lp * this.fb;

    // Continuous excitation: inject filtered noise so the string sustains.
    this.buf[this.idx] = fed + this.exciter.next();
    this.idx = (this.idx + 1) % len;
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
