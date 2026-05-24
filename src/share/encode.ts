import { clampParam, type AnnealMusicParams } from '@/state/params';
import {
  KEY_BOUNDS,
  SHARED_KEYS,
  decimalsForStep,
  type SharedKey,
} from '@/share/schema';
import {
  clampEngineParam,
  engineParamDefs,
  isEngineId,
} from '@/audio/engines/index';
import type { EngineId, EngineParams } from '@/audio/engines/types';

const SHARED_KEY_SET: ReadonlySet<string> = new Set(SHARED_KEYS);

function roundTo(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

/**
 * Encode the shared params into the payload portion of a URL fragment, e.g.
 * `rootFreq=147&spread=1.08&...`. Does not include the `#s=N:` prefix, the
 * engine selector, or volume.
 */
export function encodeParams(params: AnnealMusicParams): string {
  return SHARED_KEYS.map((key) => {
    const value = params[key].toFixed(KEY_BOUNDS[key].decimals);
    return `${key}=${value}`;
  }).join('&');
}

/** Encode an engine's params as namespaced pairs, e.g. `fm.modRatio=1.00&...`. */
export function encodeEngineParams(
  engineId: EngineId,
  params: EngineParams,
): string {
  return engineParamDefs(engineId)
    .map((def) => {
      const value = params[def.key] ?? def.default;
      return `${engineId}.${def.key}=${value.toFixed(decimalsForStep(def.step))}`;
    })
    .join('&');
}

/**
 * Encode the full share payload: `e=<id>&<shared>&<engine ns params>`. Engines
 * with no params contribute only the `e=` selector.
 */
export function encodeState(
  params: AnnealMusicParams,
  engineId: EngineId,
  engineParams: EngineParams,
): string {
  const parts = [`e=${engineId}`, encodeParams(params)];
  const engine = encodeEngineParams(engineId, engineParams);
  if (engine) parts.push(engine);
  return parts.join('&');
}

export interface DecodedState {
  params: Partial<AnnealMusicParams>;
  engineId: EngineId;
  engineParams: Partial<Record<EngineId, EngineParams>>;
  warnings: string[];
}

/**
 * Decode a payload for the given schema version into shared params, the engine
 * selection, and engine-specific params. Never throws: unknown keys and
 * unparseable values are dropped, out-of-range values clamped, each adjustment
 * recorded as a warning. v1 payloads carry no engine state → `engine=sine`.
 */
export function decodeState(version: number, payload: string): DecodedState {
  const params: Partial<AnnealMusicParams> = {};
  const engineParams: Partial<Record<EngineId, EngineParams>> = {};
  const warnings: string[] = [];
  let engineId: EngineId = 'sine';

  for (const pair of payload.split('&')) {
    if (pair === '') continue;

    const eq = pair.indexOf('=');
    if (eq === -1) {
      warnings.push(`malformed pair (no '='): ${pair}`);
      continue;
    }

    const key = pair.slice(0, eq);
    const raw = pair.slice(eq + 1);

    // Engine selector.
    if (key === 'e') {
      if (version < 2) {
        warnings.push(`engine key ignored for schema v${version}: ${pair}`);
      } else if (isEngineId(raw)) {
        engineId = raw;
      } else {
        warnings.push(`unknown engine '${raw}', defaulting to sine`);
      }
      continue;
    }

    // Namespaced engine param: `<engineId>.<paramKey>`.
    const dot = key.indexOf('.');
    if (dot !== -1) {
      if (version < 2) {
        warnings.push(`engine param ignored for schema v${version}: ${key}`);
        continue;
      }
      const ns = key.slice(0, dot);
      const paramKey = key.slice(dot + 1);
      if (!isEngineId(ns)) {
        warnings.push(`unknown engine namespace ignored: ${key}`);
        continue;
      }
      const def = engineParamDefs(ns).find((d) => d.key === paramKey);
      if (!def) {
        warnings.push(`unknown engine param ignored: ${key}`);
        continue;
      }
      const num = raw.trim() === '' ? NaN : Number(raw);
      if (!Number.isFinite(num)) {
        warnings.push(`non-numeric value dropped for ${key}: ${raw}`);
        continue;
      }
      const clamped = clampEngineParam(ns, paramKey, num);
      if (clamped !== num) {
        warnings.push(
          `value out of range for ${key}: ${num} clamped to ${clamped}`,
        );
      }
      const bag = engineParams[ns] ?? {};
      bag[paramKey] = roundTo(clamped, decimalsForStep(def.step));
      engineParams[ns] = bag;
      continue;
    }

    // Shared param.
    if (!SHARED_KEY_SET.has(key)) {
      warnings.push(`unknown key ignored: ${key}`);
      continue;
    }
    const sharedKey = key as SharedKey;
    const num = raw.trim() === '' ? NaN : Number(raw);
    if (!Number.isFinite(num)) {
      warnings.push(`non-numeric value dropped for ${key}: ${raw}`);
      continue;
    }
    const clamped = clampParam(sharedKey, num);
    if (clamped !== num) {
      warnings.push(
        `value out of range for ${key}: ${num} clamped to ${clamped}`,
      );
    }
    params[sharedKey] = roundTo(clamped, KEY_BOUNDS[sharedKey].decimals);
  }

  return { params, engineId, engineParams, warnings };
}

/**
 * Decode shared params only (v1 semantics). Retained for callers/tests that
 * deal purely with the sculptable shared params; delegates to `decodeState`.
 */
export function decodeParams(payload: string): {
  params: Partial<AnnealMusicParams>;
  warnings: string[];
} {
  const { params, warnings } = decodeState(1, payload);
  return { params, warnings };
}
