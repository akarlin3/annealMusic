/** Frequency ratios of the harmonic lattice. `density` selects the first N. */
export const HARMONICS = [1, 1.5, 2, 2.5, 3, 4, 5, 6] as const;

/** Live Web Audio nodes for a single partial voice. */
export interface PartialVoice {
  readonly osc: OscillatorNode;
  readonly g: GainNode;
  readonly lfo: OscillatorNode;
  readonly lfoGain: GainNode;
  readonly baseline: ConstantSourceNode;
  readonly ratio: number;
  /** Current detune in cents, evolved by the drift loop. */
  detune: number;
}

/** Plain view of a partial used by the pure drift math (no AudioNodes). */
export interface DriftPartial {
  readonly ratio: number;
  detune: number;
}

/** The full set of master nodes in the audio graph. */
export interface GraphNodes {
  readonly master: GainNode;
  readonly masterVol: GainNode;
  readonly filter: BiquadFilterNode;
  readonly analyser: AnalyserNode;
  readonly convolver: ConvolverNode;
  readonly wetGain: GainNode;
  readonly dryGain: GainNode;
}
