/**
 * Shared continuous-excitation generator for the physical-modeling sub-models.
 *
 * The design pivot that makes physical modeling work for *ambient* (sustained)
 * rather than *percussive* (impulsive) sound: instead of a single pluck/strike,
 * every model is fed a continuous stream of filtered noise. This is the one
 * excitation source — string, tube, and plate all use it, so the heuristic lives
 * in exactly one place (no copies across the three worklets).
 *
 * White noise → one-pole low-pass (brightness controls cutoff) → scaled by the
 * excitation level. Pure: no Web Audio / worklet globals, so it is unit-tested
 * directly and bundled into each worklet.
 */
export class NoiseExciter {
  private readonly sampleRate: number;
  private lp = 0;
  private level: number;
  /** One-pole low-pass coefficient in [0,1); higher = brighter. */
  private coef: number;
  private readonly rng: () => number;

  constructor(
    sampleRate: number,
    level = 0.5,
    brightness = 0.5,
    rng: () => number = Math.random,
  ) {
    this.sampleRate = sampleRate;
    this.level = level;
    this.coef = brightnessToCoef(brightness, sampleRate);
    this.rng = rng;
  }

  setLevel(level: number): void {
    this.level = Math.max(0, level);
  }

  setBrightness(brightness: number): void {
    this.coef = brightnessToCoef(brightness, this.sampleRate);
  }

  /** Next excitation sample (filtered noise scaled by level). */
  next(): number {
    const white = this.rng() * 2 - 1;
    this.lp += this.coef * (white - this.lp);
    return this.lp * this.level;
  }
}

/**
 * Map a 0..1 brightness to a one-pole low-pass coefficient. Brightness 0 ⇒ a
 * dark ~80 Hz cutoff; brightness 1 ⇒ near-open. Frequency-warped through the
 * sample rate so the timbre is consistent at 44.1k and 48k.
 */
export function brightnessToCoef(
  brightness: number,
  sampleRate: number,
): number {
  const b = Math.max(0, Math.min(1, brightness));
  const cutoff = 80 * Math.pow(160, b); // ~80 Hz .. ~12.8 kHz
  const x = (2 * Math.PI * cutoff) / sampleRate;
  return Math.max(0.0005, Math.min(0.999, x / (x + 1)));
}
