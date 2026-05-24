/**
 * Per-partial baseline + LFO amplitude shape, shared by every engine so the
 * heuristic lives in exactly one place (no copy-paste across engines). Mirrors
 * the original sine-bank values: a `1/(i+1)` rolloff for both the steady
 * baseline and the slow tremolo, with a randomized sub-audio LFO rate.
 */
export interface PartialShape {
  /** Steady-state gain offset for the partial. */
  readonly baselineOffset: number;
  /** Depth of the slow amplitude LFO. */
  readonly lfoGain: number;
  /** LFO rate in Hz (sub-audio). */
  readonly lfoFreq: number;
}

export function partialShape(
  i: number,
  rng: () => number = Math.random,
): PartialShape {
  return {
    baselineOffset: 0.32 / (i + 1),
    lfoGain: 0.14 / (i + 1),
    lfoFreq: 0.025 + rng() * 0.12,
  };
}
