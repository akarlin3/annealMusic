import type { TransformDef } from '../types';

export function applyDiscrete(val: number, def: TransformDef): number {
  const { rawMin, rawMax, outMin, outMax, steps = 5 } = def;
  const rawRange = rawMax - rawMin;
  const norm =
    rawRange === 0 ? 0.5 : Math.max(0, Math.min(1, (val - rawMin) / rawRange));

  const numSteps = Math.max(2, steps);
  const discretized = Math.round(norm * (numSteps - 1)) / (numSteps - 1);
  return outMin + discretized * (outMax - outMin);
}
