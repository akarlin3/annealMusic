import type { TransformDef } from '../types';

export function applyLinear(val: number, def: TransformDef): number {
  const { rawMin, rawMax, outMin, outMax } = def;
  const rawRange = rawMax - rawMin;
  const norm =
    rawRange === 0 ? 0.5 : Math.max(0, Math.min(1, (val - rawMin) / rawRange));
  return outMin + norm * (outMax - outMin);
}
