import { createSeededRng } from '@/piece/generators';
import { clampParam, type ParamKey } from '@/state/params';
import type { VariationPoint } from '@/piece/types';

/** Hash a string to a 32-bit unsigned integer for salting seeds. */
export function hashStringToInt(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) + h + str.charCodeAt(i);
  }
  return h >>> 0;
}

/**
 * Pure function to resolve a set of parameters applying a list of VariationPoints.
 *
 * @param baseParams The baseline parameters to modify.
 * @param variations The active list of VariationPoints.
 * @param seed The master seed for playback or rendering.
 * @returns A new object with resolved parameter values.
 */
export function resolveVariations(
  baseParams: Record<string, number>,
  variations: VariationPoint[] | undefined,
  seed: number,
): Record<string, number> {
  const resolved = { ...baseParams };
  if (!variations || variations.length === 0) {
    return resolved;
  }

  // 1. Partition independent and correlated variation points
  const independent = variations.filter(
    (v) => v.constraint.type !== 'correlated',
  );
  const correlated = variations.filter(
    (v) => v.constraint.type === 'correlated',
  );

  // 2. Resolve independent variation points first
  for (const vp of independent) {
    // Generate a parameter-specific salted seed from the master seed and path/id
    const salt = vp.id + '-' + vp.paramKey;
    const saltedSeed = (seed + hashStringToInt(salt)) >>> 0;
    const rng = createSeededRng(saltedSeed);
    const r = rng();

    const baseVal = baseParams[vp.paramKey] ?? 0;
    let newVal = baseVal;

    switch (vp.constraint.type) {
      case 'range': {
        const min = vp.constraint.min ?? baseVal;
        const max = vp.constraint.max ?? baseVal;
        newVal = min + r * (max - min);
        break;
      }
      case 'enum': {
        const choices = vp.constraint.choices ?? [baseVal];
        if (choices.length > 0) {
          const idx = Math.floor(r * choices.length);
          newVal = choices[idx] ?? baseVal;
        }
        break;
      }
      case 'relative': {
        const percent = vp.constraint.percent ?? 10;
        // Map r [0, 1] to [-1, 1] range offset
        const offset = (r * 2 - 1) * (percent / 100);
        newVal = baseVal * (1.0 + offset);
        break;
      }
      default:
        break;
    }

    const isStandardParamKey = (key: string): key is ParamKey => {
      return (
        key === 'rootFreq' ||
        key === 'spread' ||
        key === 'density' ||
        key === 'coupling' ||
        key === 'drift' ||
        key === 'brightness' ||
        key === 'space' ||
        key === 'volume'
      );
    };

    if (isStandardParamKey(vp.paramKey)) {
      resolved[vp.paramKey] = clampParam(vp.paramKey, newVal);
    } else {
      resolved[vp.paramKey] = newVal;
    }
  }

  // 3. Resolve correlated variation points next
  for (const vp of correlated) {
    const target = vp.constraint.targetParam;
    if (!target) continue;

    const coefficient = vp.constraint.coefficient ?? 1.0;
    const targetBase = baseParams[target] ?? 0;
    const targetResolved = resolved[target] ?? targetBase;

    // Linear delta difference: Y_new = Y_base + coeff * (X_resolved - X_base)
    const delta = targetResolved - targetBase;
    const baseVal = baseParams[vp.paramKey] ?? 0;
    const newVal = baseVal + coefficient * delta;

    const isStandardParamKey = (key: string): key is ParamKey => {
      return (
        key === 'rootFreq' ||
        key === 'spread' ||
        key === 'density' ||
        key === 'coupling' ||
        key === 'drift' ||
        key === 'brightness' ||
        key === 'space' ||
        key === 'volume'
      );
    };

    if (isStandardParamKey(vp.paramKey)) {
      resolved[vp.paramKey] = clampParam(vp.paramKey, newVal);
    } else {
      resolved[vp.paramKey] = newVal;
    }
  }

  return resolved;
}
