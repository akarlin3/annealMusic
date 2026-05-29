/**
 * Generalized modal resonator bank: a bank of biquad bandpass resonators tuned
 * to an arbitrary eigenfrequency series, excited continuously so it rings in
 * sustain. This is the **single** modal-bank implementation — plate, membrane,
 * mallet, and bell are four *configurations* of it (different eigenfrequency
 * providers, and optionally a custom per-mode gain shape or a custom exciter),
 * never copies. (Heuristic-drift rule: one bank, many tunings.)
 *
 * `damping` sets mode Q (decay), `brightness` sets the exciter cutoff and the
 * per-mode gain rolloff. The two generic `shape` params feed the injected
 * `eigen`/`gainFn` so each sub-model can sculpt its own timbre without forking
 * the class. Pure DSP (no worklet globals): the single source of truth, bundled
 * into each modal worklet and unit-tested directly.
 *
 * Ref: modal synthesis — Cook, *Real Sound Synthesis for Interactive
 * Applications* (modal banks); per-model eigenfrequency references live with
 * each model's `eigen` function.
 */
import { NoiseExciter } from '@/audio/engines/physical-dsp/noise';

/** Anything that can feed the bank a continuous excitation sample stream. */
export interface Exciter {
  next(): number;
  setLevel(level: number): void;
  setBrightness(brightness: number): void;
}

/**
 * Eigenfrequency provider: mode index `n` (0-based) → frequency **ratio**
 * relative to the fundamental. Mode 0 is typically ~1 (the bell hum is the
 * exception at ~0.5). `shape1`/`shape2` are the sub-model's two sculpting params.
 */
export type EigenFn = (n: number, shape1: number, shape2: number) => number;

/**
 * Per-mode base gain provider. Defaults to a brightness-driven high-mode
 * rolloff; bell overrides it to tilt toward the low partials (hum-forward).
 */
export type GainFn = (
  n: number,
  shape1: number,
  shape2: number,
  brightness: number,
) => number;

export interface ModalConfig {
  sampleRate: number;
  eigen: EigenFn;
  f0?: number;
  damping?: number;
  brightness?: number;
  excitation?: number;
  shape1?: number;
  shape2?: number;
  rng?: () => number;
  modeCount: number;
  /** Inject a custom exciter (e.g. mallet's tremolo); defaults to filtered noise. */
  exciter?: Exciter;
  /** Custom per-mode gain shape; defaults to the brightness rolloff. */
  gainFn?: GainFn;
}

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
  z1: number;
  z2: number;
  gain: number;
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Default high-mode rolloff: brighter ⇒ flatter (higher modes survive). */
export const defaultGain: GainFn = (n, _s1, _s2, brightness) =>
  Math.pow(1 - 0.9 * (1 - clamp01(brightness)), n);

export class ModalBank {
  private readonly sampleRate: number;
  private readonly modes: Biquad[];
  private readonly exciter: Exciter;
  private readonly eigen: EigenFn;
  private readonly gainFn: GainFn;
  private readonly count: number;
  private baseFreq: number;
  private detuneCents = 0;
  private damping: number;
  private brightness: number;
  private shape1: number;
  private shape2: number;

  constructor(config: ModalConfig) {
    const {
      sampleRate,
      eigen,
      f0 = 110,
      damping = 0.5,
      brightness = 0.5,
      excitation = 0.5,
      shape1 = 0.5,
      shape2 = 0.5,
      rng = Math.random,
      modeCount,
      exciter,
      gainFn = defaultGain,
    } = config;

    this.sampleRate = sampleRate;
    this.eigen = eigen;
    this.gainFn = gainFn;
    this.baseFreq = f0;
    this.damping = damping;
    this.brightness = brightness;
    this.shape1 = shape1;
    this.shape2 = shape2;
    this.count = Math.max(1, modeCount);
    this.exciter =
      exciter ?? new NoiseExciter(sampleRate, excitation, brightness, rng);
    this.modes = Array.from({ length: this.count }, () => ({
      b0: 0,
      b1: 0,
      b2: 0,
      a1: 0,
      a2: 0,
      z1: 0,
      z2: 0,
      gain: 1,
    }));
    this.retune();
    this.recomputeGains();
  }

  private eigenFreq(n: number): number {
    const f0 = this.baseFreq * Math.pow(2, this.detuneCents / 1200);
    return f0 * this.eigen(n, this.shape1, this.shape2);
  }

  private retune(): void {
    // Q rises sharply as damping falls → long, ringing modes.
    const Q = 8 + (1 - clamp01(this.damping)) * 240;
    for (let n = 0; n < this.count; n++) {
      const mode = this.modes[n];
      if (!mode) continue;
      designBandpass(mode, this.eigenFreq(n), Q, this.sampleRate);
    }
  }

  private recomputeGains(): void {
    for (let n = 0; n < this.count; n++) {
      const mode = this.modes[n];
      if (mode)
        mode.gain = this.gainFn(n, this.shape1, this.shape2, this.brightness);
    }
  }

  setFrequency(f0: number): void {
    this.baseFreq = f0;
    this.retune();
  }

  setDetuneCents(cents: number): void {
    this.detuneCents = cents;
    this.retune();
  }

  setDamping(damping: number): void {
    this.damping = damping;
    this.retune();
  }

  setBrightness(brightness: number): void {
    this.brightness = brightness;
    this.exciter.setBrightness(brightness);
    this.recomputeGains();
  }

  setExcitation(level: number): void {
    this.exciter.setLevel(level);
  }

  /** First sub-model sculpting param (affects eigen + gain). */
  setShape1(value: number): void {
    this.shape1 = value;
    this.retune();
    this.recomputeGains();
  }

  /** Second sub-model sculpting param (affects eigen + gain). */
  setShape2(value: number): void {
    this.shape2 = value;
    this.retune();
    this.recomputeGains();
  }

  next(): number {
    const x = this.exciter.next();
    let sum = 0;
    for (let n = 0; n < this.count; n++) {
      const m = this.modes[n];
      if (!m) continue;
      const y = m.b0 * x + m.z1;
      m.z1 = m.b1 * x - m.a1 * y + m.z2;
      m.z2 = m.b2 * x - m.a2 * y;
      sum += y * m.gain;
    }
    // Normalize by mode count so excitation scaling is independent of bank size.
    return sum / Math.sqrt(this.count);
  }

  render(out: Float32Array): void {
    for (let i = 0; i < out.length; i++) out[i] = this.next();
  }
}

/** Design a constant-skirt-gain bandpass biquad (RBJ cookbook) in place. */
export function designBandpass(
  q: Biquad,
  freq: number,
  Q: number,
  sampleRate: number,
): void {
  const f = Math.max(20, Math.min(sampleRate * 0.45, freq));
  const w0 = (2 * Math.PI * f) / sampleRate;
  const alpha = Math.sin(w0) / (2 * Q);
  const cos = Math.cos(w0);
  const a0 = 1 + alpha;
  q.b0 = alpha / a0;
  q.b1 = 0;
  q.b2 = -alpha / a0;
  q.a1 = (-2 * cos) / a0;
  q.a2 = (1 - alpha) / a0;
}
