/**
 * Modal plate: a configuration of the shared `ModalBank` (see `modal-bank.ts`).
 * ~20 bandpass resonators tuned to a (slightly inharmonic) plate eigenfrequency
 * series, excited continuously by filtered noise so it rings like a struck metal
 * plate held in sustain.
 *
 * Eigenfrequencies follow `f0 · sqrt(1 + B·n²)` (B = inharmonicity), the
 * stiff-plate-style stretching that gives metallic, bell-like partials. The
 * inharmonicity rides the shared first shape param (`ph.inharm`).
 *
 * Ref: modal synthesis; plate eigenfrequency stretching after Chaigne &
 * Lambourg (distribution only — this is a perceptual model, not a PDE solve).
 */
import {
  ModalBank,
  type EigenFn,
} from '@/audio/engines/physical-dsp/modal-bank';

/** Mode count per partial. The CPU ceiling: 20 × 8 partials = 160 biquads. */
export const PLATE_MODES = 20;

/**
 * Plate eigenfrequency ratios: `sqrt(1 + B·n²)`, B = inharmonicity · 0.12.
 * `shape1` is the inharmonicity (0..1); `shape2` is unused.
 */
export const plateEigen: EigenFn = (n, shape1) =>
  Math.sqrt(1 + Math.max(0, Math.min(1, shape1)) * 0.12 * n * n);

/** Build a plate-tuned modal bank (single source of truth for the processor). */
export function createPlateBank(
  sampleRate: number,
  modeCount: number = PLATE_MODES,
): ModalBank {
  return new ModalBank({ sampleRate, eigen: plateEigen, modeCount });
}

// Re-export so existing importers (and the dsp tests) resolve the bank here too.
export { ModalBank } from '@/audio/engines/physical-dsp/modal-bank';
