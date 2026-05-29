/**
 * Circular membrane: a configuration of the shared `ModalBank`. The mode ratios
 * are the zeros of the Bessel functions `J_m` (the eigenfrequencies of an ideal
 * vibrating circular membrane), normalized to the fundamental `j_{0,1}`. Strongly
 * inharmonic → a drone-like, drum-skin texture nothing else in the bank covers.
 *
 * Two sculpting params (the shared generic slots):
 *  - `shape1` = **tension** (`ph.reed`): stretches the upper-mode spacing, as
 *    raising skin tension would (0..1 → spacing factor 0.5×..2×).
 *  - `shape2` = **modeStretch** (`ph.inharm`): blends the membrane ratios toward
 *    a harmonic series, for a tuned-drum feel.
 *
 * Ref: Cook, *Real Sound Synthesis for Interactive Applications* (modal
 * membranes); Bessel-zero table (Abramowitz & Stegun, Table 9.5).
 */
import {
  ModalBank,
  type EigenFn,
} from '@/audio/engines/physical-dsp/modal-bank';

export const MEMBRANE_MODES = 12;

/** First 12 circular-membrane mode ratios (Bessel zeros / j_{0,1}). */
const BESSEL_RATIOS = [
  1.0, 1.594, 2.136, 2.296, 2.653, 2.918, 3.156, 3.501, 3.6, 3.652, 4.06, 4.154,
] as const;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export const membraneEigen: EigenFn = (n, tension, stretch) => {
  const ratio = BESSEL_RATIOS[n] ?? n + 1;
  // Tension scales the *spacing above the fundamental* (mode 0 stays at 1).
  const spacing = 0.5 + clamp01(tension) * 1.5; // 0.5×..2×
  const tensioned = 1 + (ratio - 1) * spacing;
  const harmonic = n + 1;
  const s = clamp01(stretch);
  return tensioned * (1 - s) + harmonic * s;
};

/** Build a membrane-tuned modal bank. */
export function createMembraneBank(
  sampleRate: number,
  modeCount: number = MEMBRANE_MODES,
): ModalBank {
  return new ModalBank({ sampleRate, eigen: membraneEigen, modeCount });
}
