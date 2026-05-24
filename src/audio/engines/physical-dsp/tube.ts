/**
 * Cylindrical waveguide with a simple memoryless reed/lip excitation — a
 * clarinet-like blown tube, adapted for continuous (sustained) ambient tone.
 *
 * Two delay rails (forward + backward pressure waves) of length
 * `sampleRate / (2·f0)`. The bore loss is a one-pole low-pass (`damping`,
 * `brightness`). The mouth end uses a Smith-style memoryless reed reflection: a
 * breath pressure (the continuous excitation) drives the pressure difference
 * across the reed, gated by a soft reed nonlinearity whose slope is the reed
 * stiffness `k`. The far end is a closed (inverting) reflection.
 *
 * Ref: Julius O. Smith, *Physical Audio Signal Processing* (CCRMA) — "Digital
 * Waveguide Models / Singing Reed / Clarinet". Pure DSP (no worklet globals).
 */
import { NoiseExciter } from '@/audio/engines/physical-dsp/noise';

export class Waveguide {
  private readonly sampleRate: number;
  private fwd: Float32Array;
  private bwd: Float32Array;
  private idx = 0;
  private len: number;
  private bore = 0;
  private loopCoef: number;
  private fb: number;
  private reedK: number;
  private readonly breath: NoiseExciter;
  private baseFreq: number;
  private detuneCents = 0;
  private readonly cap: number;

  constructor(
    sampleRate: number,
    f0 = 110,
    damping = 0.5,
    brightness = 0.5,
    excitation = 0.5,
    reed = 0.5,
    rng: () => number = Math.random,
  ) {
    this.sampleRate = sampleRate;
    this.baseFreq = f0;
    this.cap = Math.ceil(sampleRate / (2 * 20)) + 4;
    this.fwd = new Float32Array(this.cap);
    this.bwd = new Float32Array(this.cap);
    this.len = this.computeLen();
    this.fb = dampingToBore(damping);
    this.loopCoef = brightnessToBore(brightness);
    this.reedK = reedStiffness(reed);
    // The breath provides a steady DC-ish pressure plus noise turbulence.
    this.breath = new NoiseExciter(sampleRate, excitation, brightness, rng);
  }

  private computeLen(): number {
    const freq = this.baseFreq * Math.pow(2, this.detuneCents / 1200);
    const l = this.sampleRate / (2 * Math.max(20, freq));
    return Math.max(2, Math.min(this.cap - 1, Math.floor(l)));
  }

  setFrequency(f0: number): void {
    this.baseFreq = f0;
    this.len = this.computeLen();
  }

  setDetuneCents(cents: number): void {
    this.detuneCents = cents;
    this.len = this.computeLen();
  }

  setDamping(damping: number): void {
    this.fb = dampingToBore(damping);
  }

  setBrightness(brightness: number): void {
    this.loopCoef = brightnessToBore(brightness);
    this.breath.setBrightness(brightness);
  }

  setExcitation(level: number): void {
    this.breath.setLevel(level);
  }

  setReed(reed: number): void {
    this.reedK = reedStiffness(reed);
  }

  next(): number {
    const readFwd = (this.idx - this.len + this.cap) % this.cap;
    const readBwd = this.idx % this.cap;
    const aFwd = this.fwd[readFwd] ?? 0;
    const aBwd = this.bwd[readBwd] ?? 0;

    // Mouth: breath pressure vs. returning backward wave, through the reed.
    const breath = 0.3 + this.breath.next();
    const dp = breath - aBwd;
    // Soft reed: opening reduces with pressure difference (memoryless, clamped).
    const reedFlow = Math.max(0, Math.min(1, 1 - this.reedK * dp));
    const intoBore = aBwd + dp * reedFlow;

    // Closed far end: inverting reflection with bore loss low-pass.
    this.bore += this.loopCoef * (aFwd - this.bore);
    const reflected = -this.bore * this.fb;

    this.fwd[this.idx % this.cap] = intoBore;
    this.bwd[readFwd] = reflected;
    this.idx = (this.idx + 1) % this.cap;

    // Output taps the bore pressure (sum of the two rails at the bell).
    return (aFwd + aBwd) * 0.5;
  }

  render(out: Float32Array): void {
    for (let i = 0; i < out.length; i++) out[i] = this.next();
  }
}

export function dampingToBore(damping: number): number {
  const d = Math.max(0, Math.min(1, damping));
  return 0.995 - d * 0.08;
}

export function brightnessToBore(brightness: number): number {
  const b = Math.max(0, Math.min(1, brightness));
  return 0.15 + b * 0.8;
}

/** Reed 0..1 → stiffness slope. Stiffer reed ⇒ harder gating. */
export function reedStiffness(reed: number): number {
  const r = Math.max(0, Math.min(1, reed));
  return 0.5 + r * 2.5;
}
