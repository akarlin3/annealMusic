/* eslint-disable */
import { SCHEMA_VERSION } from '@/share/schema.js';
import { decodeState, encodeState } from '@/share/encode.js';

export interface SweepVary {
  key: string;
  values?: any[];
  range?: {
    min: number;
    max: number;
    steps: number;
  };
}

export interface SweepFile {
  base: {
    schema_ver: number;
    payload: string;
  };
  varies: SweepVary[];
  duration: string; // e.g. "30s" or "60s"
  seeds: number[];
}

export interface SweepCombination {
  params: Record<string, any>;
  seed: number;
  filename: string;
  payload: string;
}

/**
 * Simplifies a parameter key for clean filename encoding.
 * e.g. "ph.model" -> "model", "rootFreq" -> "root".
 */
export function simplifyKey(key: string): string {
  if (key === 'ph.model') return 'model';
  if (key === 'rootFreq') return 'root';
  const lastDot = key.lastIndexOf('.');
  return lastDot !== -1 ? key.slice(lastDot + 1) : key;
}

/**
 * Parses a duration string (e.g. "30s", "120s") into seconds.
 */
export function parseDuration(durationStr: string): number {
  const match = durationStr.trim().match(/^(\d+)s$/);
  if (!match) {
    throw new Error(
      `Invalid duration format (expected "Xs", e.g. "30s"): ${durationStr}`,
    );
  }
  return parseInt(match[1]!, 10);
}

/**
 * Generates Cartesian product combinations for a sweep.
 */
export function generateSweepCombinations(
  sweep: SweepFile,
): SweepCombination[] {
  const varies = sweep.varies;
  const seeds = sweep.seeds;

  // 1. Expand all dimensions
  const dimensions: { key: string; values: any[] }[] = [];
  for (const vary of varies) {
    if (vary.values) {
      dimensions.push({ key: vary.key, values: vary.values });
    } else if (vary.range) {
      const { min, max, steps } = vary.range;
      const values: number[] = [];
      if (steps <= 1) {
        values.push(min);
      } else {
        const stepSize = (max - min) / (steps - 1);
        for (let i = 0; i < steps; i++) {
          // Format floats nicely to avoid floating point precision issues
          values.push(Number((min + stepSize * i).toFixed(4)));
        }
      }
      dimensions.push({ key: vary.key, values });
    }
  }

  // Add seed as a dimension
  dimensions.push({ key: 'seed', values: seeds });

  // 2. Cartesian product helper
  const cartesian = (
    current: Record<string, any>,
    index: number,
  ): Record<string, any>[] => {
    if (index === dimensions.length) {
      return [current];
    }

    const dim = dimensions[index]!;
    const results: Record<string, any>[] = [];
    for (const val of dim.values) {
      results.push(...cartesian({ ...current, [dim.key]: val }, index + 1));
    }
    return results;
  };

  const rawCombos = cartesian({}, 0);

  // 3. Transform to SweepCombination objects
  const baseVersion = sweep.base.schema_ver ?? SCHEMA_VERSION;
  const decodedBase = decodeState(baseVersion, sweep.base.payload);

  if (decodedBase.kind !== 'patch') {
    throw new Error('Sweep base must be a patch payload.');
  }

  return rawCombos.map((combo) => {
    const seed = combo.seed as number;
    const params = { ...combo };
    delete params.seed;

    // Apply overrides to deep copy of base patch state
    const overrideParams = { ...decodedBase.params };
    const overrideEngineParams = JSON.parse(
      JSON.stringify(decodedBase.engineParams),
    );

    for (const [key, value] of Object.entries(params)) {
      if (key.includes('.')) {
        const [ns, paramKey] = key.split('.');
        if (ns && paramKey) {
          if (!overrideEngineParams[ns]) {
            overrideEngineParams[ns] = {};
          }
          overrideEngineParams[ns][paramKey] = value;
        }
      } else {
        (overrideParams as any)[key] = value;
      }
    }

    // Build the overridden payload string
    const payload = encodeState(
      overrideParams as any,
      decodedBase.engineId,
      overrideEngineParams,
      {
        mode: decodedBase.mode,
        arcId: decodedBase.arcId ?? 'bell',
        durationSec: decodedBase.durationSec ?? 900,
      },
      decodedBase.loops,
      decodedBase.tuning,
    );

    // Build filename
    const filenameParts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      filenameParts.push(`${simplifyKey(key)}=${value}`);
    }
    filenameParts.push(`seed=${seed}`);
    const filename = `${filenameParts.join('_')}.wav`;

    return {
      params,
      seed,
      filename,
      payload,
    };
  });
}
