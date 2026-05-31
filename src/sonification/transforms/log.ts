import type { TransformDef } from '../types';

export function applyLog(val: number, def: TransformDef): number {
  const { rawMin, rawMax, outMin, outMax } = def;
  const eps = 1e-5;
  const safeMin = Math.max(eps, rawMin);
  const safeMax = Math.max(eps, rawMax);
  const safeVal = Math.max(eps, val);

  const logMin = Math.log(safeMin);
  const logMax = Math.log(safeMax);
  const logRange = logMax - logMin;

  const norm =
    logRange === 0
      ? 0.5
      : Math.max(0, Math.min(1, (Math.log(safeVal) - logMin) / logRange));
  return outMin + norm * (outMax - outMin);
}
