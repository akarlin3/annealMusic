import type { TransformDef } from '../types';

export function applyExp(val: number, def: TransformDef): number {
  const { rawMin, rawMax, outMin, outMax } = def;
  const rawRange = rawMax - rawMin;
  const norm =
    rawRange === 0 ? 0.5 : Math.max(0, Math.min(1, (val - rawMin) / rawRange));

  // Natural exponential curve from 0 to 1
  const expNorm = (Math.exp(norm) - 1) / (Math.exp(1) - 1);
  return outMin + expNorm * (outMax - outMin);
}
