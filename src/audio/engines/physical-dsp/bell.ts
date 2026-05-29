/**
 * Bell: a configuration of the shared `ModalBank` tuned to the partial ratios of
 * a church/handbell — a sub-octave **hum** (0.5), the **prime** (1.0), the
 * characteristic minor-third **tierce** (1.2), **quint** (1.5), **nominal**
 * (2.0), and upper partials. The hum + minor third is what makes a bell
 * unmistakable and most distinct from the plate. Struck-bell *drone* via
 * continuous noise excitation.
 *
 * Two sculpting params (the shared generic slots):
 *  - `shape1` = **inharmonicity** (`ph.inharm`): stretches/compresses the ratio
 *    set around the prime (warm bell ↔ clangorous).
 *  - `shape2` = **warmth** (`ph.reed`): tilts the mode gains toward the low
 *    partials (hum-forward) vs. the nominal.
 *
 * Ref: Fletcher & Rossing, *The Physics of Musical Instruments* (bell partial
 * structure); Cook, *Real Sound Synthesis* (modal banks).
 */
import {
  ModalBank,
  defaultGain,
  type EigenFn,
  type GainFn,
} from '@/audio/engines/physical-dsp/modal-bank';

export const BELL_MODES = 9;

/** Church-bell partial ratios (hum, prime, tierce, quint, nominal, upper). */
const BELL_RATIOS = [0.5, 1.0, 1.2, 1.5, 2.0, 2.5, 2.6, 3.0, 4.2] as const;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export const bellEigen: EigenFn = (n, inharm) => {
  const ratio = BELL_RATIOS[n] ?? n + 1;
  // Inharmonicity stretches the ratio set around 1.0 (the prime).
  const stretch = 1 + clamp01(inharm) * 0.3;
  return Math.pow(ratio, stretch);
};

/** Warmth tilts gain toward the low partials on top of the brightness rolloff. */
export const bellGain: GainFn = (n, shape1, warmth, brightness) =>
  defaultGain(n, shape1, warmth, brightness) *
  Math.pow(0.6, n * clamp01(warmth));

/** Build a bell-tuned modal bank. */
export function createBellBank(
  sampleRate: number,
  modeCount: number = BELL_MODES,
): ModalBank {
  return new ModalBank({
    sampleRate,
    eigen: bellEigen,
    gainFn: bellGain,
    modeCount,
  });
}
