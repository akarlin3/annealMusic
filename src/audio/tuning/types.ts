export type TuningSystemId =
  | 'equal'
  | 'just-5'
  | 'just-7'
  | 'pythagorean'
  | 'solfeggio'
  | 'werckmeister3'
  | 'kirnberger3'
  | 'meantone-quarter'
  | 'valotti'
  | 'young'
  | 'custom';

export interface TuningRef {
  system: TuningSystemId;
  sclId?: string; // UUID for custom Scala scale
  referenceA4Hz?: number; // Defaults to 440
}

export interface TuningSystem {
  id: TuningSystemId;
  name: string;
  description: string;
  hasOctaveEquivalence: boolean;
  scaleRatios: number[]; // 12-tone chromatic ratios relative to unison (C) = 1.0
  getLatticeRatio: (
    index: number,
    customScaleRatios?: number[],
    customEqRatio?: number,
  ) => number;
}
