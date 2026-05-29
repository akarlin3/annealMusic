/**
 * Bowed string: a Karplus-Strong delay line driven by a continuous **bow
 * friction** (stick-slip) junction rather than additive noise. A steady bow
 * (pressure + velocity) self-sustains the oscillation — sustain is native, which
 * is exactly what the ambient aesthetic wants; it complements the plucked/aeolian
 * `string` sub-model. The delay-line loss filter reuses the shared `string`
 * coefficient mappings (no copy of those heuristics).
 *
 * The friction characteristic is the Coulomb form: force is highest when the bow
 * and string move together (stick) and falls off as the slip speed grows. Its
 * negative slope (force decreasing with slip speed) is the negative resistance
 * that excites self-oscillation around the delay-line resonance. A soft clip
 * keeps the loop bounded.
 *
 * Two sculpting params (the shared generic slots):
 *  - `bowPressure` (`ph.reed`): friction "knee" — glassy/light ↔ sticky/scratchy.
 *  - `bowVelocity` (`ph.inharm`): bow speed `vb` — brightness + slip character.
 *
 * Ref: Smith, *Physical Audio Signal Processing* (CCRMA) — "Bowed Strings /
 * friction-driven oscillation"; McIntyre, Schumacher & Woodhouse (1983).
 */
import {
  brightnessToLoopCoef,
  dampingToFeedback,
} from '@/audio/engines/physical-dsp/string';

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export class BowedString {
  private readonly sampleRate: number;
  private readonly buf: Float32Array;
  private idx = 0;
  private delay: number;
  private lp = 0;
  private fb: number;
  private loopCoef: number;
  private baseFreq: number;
  private detuneCents = 0;
  private level: number;
  private knee: number;
  private vb: number;

  constructor(
    sampleRate: number,
    f0 = 110,
    damping = 0.5,
    brightness = 0.5,
    excitation = 0.5,
    pressure = 0.5,
    velocity = 0.5,
  ) {
    this.sampleRate = sampleRate;
    this.baseFreq = f0;
    this.buf = new Float32Array(Math.ceil(sampleRate / 20) + 4);
    this.delay = this.computeDelay();
    this.fb = dampingToFeedback(damping);
    this.loopCoef = brightnessToLoopCoef(brightness);
    this.level = Math.max(0, excitation);
    this.knee = bowKnee(pressure);
    this.vb = bowVel(velocity);
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
  }

  setExcitation(level: number): void {
    this.level = Math.max(0, level);
  }

  setBowPressure(pressure: number): void {
    this.knee = bowKnee(pressure);
  }

  setBowVelocity(velocity: number): void {
    this.vb = bowVel(velocity);
  }

  next(): number {
    const len = this.buf.length;
    const readPos = (this.idx - this.delay + len) % len;
    const i0 = Math.floor(readPos);
    const frac = readPos - i0;
    const a = this.buf[i0] ?? 0;
    const b = this.buf[(i0 + 1) % len] ?? 0;
    const vs = a + frac * (b - a); // delayed string velocity at the bow point

    // Bow-string differential velocity → Coulomb friction (force falls off as the
    // slip speed grows; the negative slope is the self-oscillation drive).
    const dv = this.vb - vs;
    const mu = (dv >= 0 ? 1 : -1) * (this.knee / (this.knee + Math.abs(dv)));
    const drive = this.level * mu * 0.5;

    // Loop low-pass (brightness) + feedback (damping), soft-clipped for safety.
    this.lp += this.loopCoef * (vs + drive - this.lp);
    this.buf[this.idx] = Math.tanh(this.lp * this.fb);
    this.idx = (this.idx + 1) % len;
    return vs;
  }

  render(out: Float32Array): void {
    for (let i = 0; i < out.length; i++) out[i] = this.next();
  }
}

/** Bow pressure 0..1 → Coulomb friction knee (light/glassy .. sticky/scratchy). */
export function bowKnee(pressure: number): number {
  return 0.1 + clamp01(pressure) * 0.6;
}

/** Bow velocity 0..1 → bow speed `vb`. */
export function bowVel(velocity: number): number {
  return 0.05 + clamp01(velocity) * 0.35;
}
