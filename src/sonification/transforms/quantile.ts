import type { TransformDef } from '../types';

export function applyQuantile(val: number, def: TransformDef): number {
  const { quantiles, outMin, outMax, rawMin, rawMax } = def;
  if (!quantiles || quantiles.length === 0) {
    // Fallback to linear if no quantiles are provided
    const rawRange = rawMax - rawMin;
    const norm =
      rawRange === 0
        ? 0.5
        : Math.max(0, Math.min(1, (val - rawMin) / rawRange));
    return outMin + norm * (outMax - outMin);
  }

  // Find the index where the value fits
  let binIdx = 0;
  while (binIdx < quantiles.length && val > (quantiles[binIdx] ?? Infinity)) {
    binIdx++;
  }

  const norm = binIdx / quantiles.length;
  return outMin + norm * (outMax - outMin);
}
