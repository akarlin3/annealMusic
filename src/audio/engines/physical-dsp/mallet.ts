/**
 * Mallet (vibraphone / marimba): a configuration of the shared `ModalBank` tuned
 * to struck-bar eigenmodes, driven by a **tremolo exciter** — a continuous
 * filtered-noise stream gated by a slow LFO — so the bars shimmer as a sustained
 * mallet *roll* rather than discrete strikes (the continuous-excitation rule).
 *
 * Two sculpting params (the shared generic slots):
 *  - `malletRate` (`ph.reed`): the tremolo/roll rate (1..8 Hz), set on the
 *    `TremoloExciter` directly.
 *  - `shape1` = **materialHardness** (`ph.inharm`): wood marimba ↔ metal vibe;
 *    stretches the bar ratios and (in the processor) brightens the exciter.
 *
 * Ref: Cook, *Real Sound Synthesis* (struck bars, tuned percussion); Fletcher &
 * Rossing, *The Physics of Musical Instruments* (bar modes).
 */
import { NoiseExciter } from '@/audio/engines/physical-dsp/noise';
import {
  ModalBank,
  type EigenFn,
  type Exciter,
} from '@/audio/engines/physical-dsp/modal-bank';

export const MALLET_MODES = 6;

/** Vibraphone-style bar mode ratios (undercut to a near-octave/double-octave). */
const BAR_RATIOS = [1.0, 3.984, 9.41, 15.6, 22.0, 29.0] as const;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Material hardness rides `shape1`; stretches the bar ratios (wood ↔ metal). */
export const malletEigen: EigenFn = (n, hardness) => {
  const ratio = BAR_RATIOS[n] ?? n + 1;
  const stretch = 0.85 + clamp01(hardness) * 0.3; // 0.85×..1.15× around the table
  return Math.pow(ratio, stretch);
};

/** Map the `reed` slot (0..1) to a roll rate in Hz (1..8). */
export function malletRate(reed: number): number {
  return 1 + clamp01(reed) * 7;
}

/**
 * Continuous noise gated by a slow LFO: a sustained mallet roll. The gate never
 * fully closes (a `floor`), so the bars keep singing between roll peaks.
 */
export class TremoloExciter implements Exciter {
  private readonly noise: NoiseExciter;
  private readonly sampleRate: number;
  private phase = 0;
  private rate = 4;
  private readonly floor = 0.25;

  constructor(
    sampleRate: number,
    level = 0.5,
    brightness = 0.5,
    rng: () => number = Math.random,
  ) {
    this.sampleRate = sampleRate;
    this.noise = new NoiseExciter(sampleRate, level, brightness, rng);
  }

  setRate(hz: number): void {
    this.rate = Math.max(0.1, hz);
  }

  setLevel(level: number): void {
    this.noise.setLevel(level);
  }

  setBrightness(brightness: number): void {
    this.noise.setBrightness(brightness);
  }

  next(): number {
    this.phase += (2 * Math.PI * this.rate) / this.sampleRate;
    if (this.phase > 2 * Math.PI) this.phase -= 2 * Math.PI;
    const gate =
      this.floor + (1 - this.floor) * (0.5 + 0.5 * Math.sin(this.phase));
    return this.noise.next() * gate;
  }
}

/** Build a mallet-tuned modal bank with a tremolo exciter. */
export function createMalletBank(
  sampleRate: number,
  modeCount: number = MALLET_MODES,
): { bank: ModalBank; exciter: TremoloExciter } {
  const exciter = new TremoloExciter(sampleRate);
  const bank = new ModalBank({
    sampleRate,
    eigen: malletEigen,
    exciter,
    modeCount,
  });
  return { bank, exciter };
}
