/**
 * Modal plate: a bank of ~20 biquad bandpass resonators tuned to a (slightly
 * inharmonic) plate eigenfrequency series, excited continuously by filtered
 * noise so it rings like a struck metal plate held in sustain.
 *
 * Eigenfrequencies follow `f0 · sqrt(1 + B·n²)` (B = inharmonicity), the
 * stiff-plate-style stretching that gives metallic, bell-like partials. Each
 * mode is a constant-peak-gain bandpass biquad; `damping` sets the mode Q
 * (decay), `brightness` sets the per-mode gain rolloff. Pure DSP (no worklet
 * globals); the single source of truth for the plate worklet.
 *
 * Ref: modal synthesis; plate eigenfrequency stretching after Chaigne &
 * Lambourg (distribution only — this is a perceptual model, not a PDE solve).
 */
import { NoiseExciter } from '@/audio/engines/physical-dsp/noise';

/** Mode count per partial. The CPU ceiling: 20 × 8 partials = 160 biquads. */
export const PLATE_MODES = 20;

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

export class ModalBank {
  private readonly sampleRate: number;
  private readonly modes: Biquad[];
  private readonly exciter: NoiseExciter;
  private baseFreq: number;
  private detuneCents = 0;
  private damping: number;
  private inharm: number;
  private readonly count: number;

  constructor(
    sampleRate: number,
    f0 = 110,
    damping = 0.5,
    brightness = 0.5,
    excitation = 0.5,
    inharm = 0.5,
    rng: () => number = Math.random,
    modeCount: number = PLATE_MODES,
  ) {
    this.sampleRate = sampleRate;
    this.baseFreq = f0;
    this.damping = damping;
    this.inharm = inharm;
    this.count = Math.max(1, modeCount);
    this.exciter = new NoiseExciter(sampleRate, excitation, brightness, rng);
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
    this.setBrightness(brightness);
  }

  private eigenFreq(n: number): number {
    const f0 = this.baseFreq * Math.pow(2, this.detuneCents / 1200);
    const B = this.inharm * 0.12;
    return f0 * Math.sqrt(1 + B * n * n);
  }

  private retune(): void {
    // Q rises sharply as damping falls → long, ringing modes.
    const Q = 8 + (1 - Math.max(0, Math.min(1, this.damping))) * 240;
    for (let n = 0; n < this.count; n++) {
      const freq = this.eigenFreq(n);
      const mode = this.modes[n];
      if (!mode) continue;
      designBandpass(mode, freq, Q, this.sampleRate);
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

  setInharmonicity(inharm: number): void {
    this.inharm = inharm;
    this.retune();
  }

  setBrightness(brightness: number): void {
    const b = Math.max(0, Math.min(1, brightness));
    this.exciter.setBrightness(brightness);
    // Higher modes are attenuated more when dark; brighter ⇒ flatter rolloff.
    for (let n = 0; n < this.count; n++) {
      const mode = this.modes[n];
      if (mode) mode.gain = Math.pow(1 - 0.9 * (1 - b), n);
    }
  }

  setExcitation(level: number): void {
    this.exciter.setLevel(level);
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
function designBandpass(
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
