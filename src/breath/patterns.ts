/**
 * Breath-pacing pattern model (v4.4).
 *
 * A breath pattern is a 4-tuple of durations in seconds, in cycle order:
 * `[inhale, hold_full, exhale, hold_empty]`. A hold of `0` means "no hold" and
 * is skipped cleanly by the controller. Patterns are visual-only — they never
 * produce audio (see docs/v4.4-PLAN.md §Audio implications).
 */

/** Four phase durations in seconds: inhale, hold-full, exhale, hold-empty. */
export type BreathTuple = [
  inhale_s: number,
  hold_full_s: number,
  exhale_s: number,
  hold_empty_s: number,
];

export type BreathPatternId =
  | 'box'
  | '4-7-8'
  | 'coherent'
  | 'resonance'
  | 'custom';

/** A breath pattern attached to a session/drone/timer. */
export interface BreathPattern {
  pattern: BreathPatternId;
  /** Present (and used) only when `pattern === 'custom'`. */
  custom_pattern?: BreathTuple;
}

export interface BuiltInPattern {
  id: Exclude<BreathPatternId, 'custom'>;
  label: string;
  tuple: BreathTuple;
  /** Honest framing copy: origin + evidence state (docs/FRAMING.md). */
  description: string;
}

/**
 * Built-in patterns. Durations are declared exactly once here so the cycle math
 * (BreathController), the picker UI, and the docs can never drift apart.
 */
export const BUILT_IN_PATTERNS: readonly BuiltInPattern[] = [
  {
    id: 'box',
    label: 'Box Breathing (4-4-4-4)',
    tuple: [4, 4, 4, 4],
    description:
      'A simple, symmetric pattern — equal inhale, hold, exhale, and hold. ' +
      'Widely used for focus and steadying; calming for many. No specific ' +
      'clinical outcome is claimed.',
  },
  {
    id: '4-7-8',
    label: '4-7-8 Breathing',
    tuple: [4, 7, 8, 0],
    description:
      'Popularized by Andrew Weil. Calming for many practitioners. Specific ' +
      'physiological mechanism claims (e.g. immediate vagal activation) are ' +
      'not well-established.',
  },
  {
    id: 'coherent',
    label: 'Coherent Breathing (5.5/min)',
    tuple: [5.5, 0, 5.5, 0],
    description:
      'Slow, even breathing at about 5.5 breaths per minute. May improve heart ' +
      'rate variability in controlled studies; long-term clinical claims are ' +
      'less settled.',
  },
  {
    id: 'resonance',
    label: 'Resonance Breathing (4.5/min)',
    tuple: [6, 0, 6.5, 0],
    description:
      'A slightly slower paced breath (~4.5/min) used in HeartMath-style ' +
      'approaches. Associated with HRV biofeedback work; evidence for durable ' +
      'clinical benefit is mixed.',
  },
] as const;

/** UI note shown for custom patterns, which carry no evidence framing. */
export const CUSTOM_PATTERN_NOTE =
  'Any breath pattern that feels comfortable is good.';

const BUILT_IN_BY_ID = new Map(BUILT_IN_PATTERNS.map((p) => [p.id, p]));

/** Bounds for custom-pattern inputs. Single source of truth (UI + decode). */
export const CUSTOM_BOUNDS = {
  /** Inhale and exhale must each be at least this long. */
  minActive: 1,
  /** Holds may be zero. */
  minHold: 0,
  /** No single phase may exceed this. */
  maxPhase: 30,
  /** The whole cycle may not exceed this. */
  maxCycle: 60,
  /** Input step (supports 5.5 / 6.5 style values). */
  step: 0.5,
} as const;

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Clamp a raw custom tuple to sensible bounds: inhale/exhale ≥ 1s, holds ≥ 0,
 * each phase ≤ 30s, and the whole cycle ≤ 60s (scaled down proportionally if it
 * would otherwise exceed). Used by both the custom UI and URL decode so bounds
 * live in exactly one place.
 */
export function clampCustomPattern(raw: BreathTuple): BreathTuple {
  const out: BreathTuple = [
    clampNumber(raw[0], CUSTOM_BOUNDS.minActive, CUSTOM_BOUNDS.maxPhase),
    clampNumber(raw[1], CUSTOM_BOUNDS.minHold, CUSTOM_BOUNDS.maxPhase),
    clampNumber(raw[2], CUSTOM_BOUNDS.minActive, CUSTOM_BOUNDS.maxPhase),
    clampNumber(raw[3], CUSTOM_BOUNDS.minHold, CUSTOM_BOUNDS.maxPhase),
  ];
  const total = out[0] + out[1] + out[2] + out[3];
  if (total > CUSTOM_BOUNDS.maxCycle) {
    const scale = CUSTOM_BOUNDS.maxCycle / total;
    return [out[0] * scale, out[1] * scale, out[2] * scale, out[3] * scale];
  }
  return out;
}

/**
 * Resolve a `BreathPattern` to its concrete 4-tuple. Built-ins look up the
 * registry; custom clamps the user tuple. Returns `null` for an unknown id so
 * callers treat it as "no overlay".
 */
export function resolveTuple(
  pattern: BreathPattern | null | undefined,
): BreathTuple | null {
  if (!pattern) return null;
  if (pattern.pattern === 'custom') {
    const custom = pattern.custom_pattern;
    if (!custom) return null;
    return clampCustomPattern(custom);
  }
  const builtIn = BUILT_IN_BY_ID.get(pattern.pattern);
  return builtIn ? [...builtIn.tuple] : null;
}

/** Look up a built-in pattern's metadata (label + framing) by id. */
export function getBuiltIn(id: BreathPatternId): BuiltInPattern | undefined {
  return id === 'custom' ? undefined : BUILT_IN_BY_ID.get(id);
}

/**
 * Visual tuning constants for the breath overlay. Kept here (alongside the
 * pattern model) so all breath tuning lives in one obvious place, mirroring
 * how `VISUAL` collects the visualizer's constants.
 */
export const BREATH = {
  /** Circle radius as a fraction of min(w, h): trough → peak. */
  radiusMinFactor: 0.1,
  radiusMaxFactor: 0.3,
  /** Phase-indicator ring radius (multiple of the current circle radius). */
  ringRadiusMultiple: 1.18,
  ringLineWidth: 1.5,
  /** Brightness multiplier applied to the visualizer while breath is active. */
  visualizerDim: 0.82,
  /** Circle fill alpha range (used directly in reduced-motion fade mode). */
  fillAlphaMin: 0.12,
  fillAlphaMax: 0.4,
  /** Faint "hold" label alpha. */
  holdLabelAlpha: 0.35,
} as const;
