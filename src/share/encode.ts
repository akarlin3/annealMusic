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
import { ARC_DURATION, clampArcDuration, getArcById } from '@/session/arcs';
import type { SessionMode } from '@/session/types';

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

/** Session selection carried in the URL (schema v3+). */
export interface SessionConfig {
  mode: SessionMode;
  arcId: string;
  durationSec: number;
}

const DEFAULT_SESSION: SessionConfig = {
  mode: 'open',
  arcId: 'bell',
  durationSec: ARC_DURATION.default,
};

/**
 * Encode the full share payload:
 * `m=<mode>[&arc=<id>&dur=<sec>]&e=<id>&<shared>&<engine ns params>`.
 * `m` is always present; `arc`/`dur` only when `mode === 'arc'`. Engines with no
 * params contribute only the `e=` selector.
 */
export function encodeState(
  params: AnnealMusicParams,
  engineId: EngineId,
  engineParams: EngineParams,
  session: SessionConfig = DEFAULT_SESSION,
): string {
  const parts = [`m=${session.mode}`];
  if (session.mode === 'arc') {
    parts.push(`arc=${session.arcId}`, `dur=${session.durationSec}`);
  }
  parts.push(`e=${engineId}`, encodeParams(params));
  const engine = encodeEngineParams(engineId, engineParams);
  if (engine) parts.push(engine);
  return parts.join('&');
}

export interface DecodedState {
  params: Partial<AnnealMusicParams>;
  engineId: EngineId;
  engineParams: Partial<Record<EngineId, EngineParams>>;
  mode: SessionMode;
  arcId?: string;
  durationSec?: number;
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
  let mode: SessionMode = 'open';
  let arcId: string | undefined;
  let durationSec: number | undefined;

  for (const pair of payload.split('&')) {
    if (pair === '') continue;

    const eq = pair.indexOf('=');
    if (eq === -1) {
      warnings.push(`malformed pair (no '='): ${pair}`);
      continue;
    }

    const key = pair.slice(0, eq);
    const raw = pair.slice(eq + 1);

    // Session mode.
    if (key === 'm') {
      if (version < 3) {
        warnings.push(`mode key ignored for schema v${version}: ${pair}`);
      } else if (raw === 'open' || raw === 'arc') {
        mode = raw;
      } else {
        warnings.push(`unknown mode '${raw}', defaulting to open`);
      }
      continue;
    }

    // Selected arc id (validated after the loop).
    if (key === 'arc') {
      if (version < 3) {
        warnings.push(`arc key ignored for schema v${version}: ${pair}`);
      } else {
        arcId = raw;
      }
      continue;
    }

    // Arc duration (seconds), clamped to bounds.
    if (key === 'dur') {
      if (version < 3) {
        warnings.push(`dur key ignored for schema v${version}: ${pair}`);
      } else {
        const num = raw.trim() === '' ? NaN : Number(raw);
        if (!Number.isFinite(num)) {
          warnings.push(`non-numeric value dropped for dur: ${raw}`);
        } else {
          const clamped = clampArcDuration(num);
          if (clamped !== num) {
            warnings.push(
              `value out of range for dur: ${num} clamped to ${clamped}`,
            );
          }
          durationSec = clamped;
        }
      }
      continue;
    }

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

  // Resolve arc selection: an unknown id (or arc mode with no id) loads as open.
  if (mode === 'arc') {
    if (!arcId || !getArcById(arcId)) {
      warnings.push(`unknown arc '${arcId ?? ''}', loaded open mode`);
      mode = 'open';
      arcId = undefined;
      durationSec = undefined;
    } else if (durationSec === undefined) {
      durationSec = ARC_DURATION.default;
    }
  } else {
    arcId = undefined;
    durationSec = undefined;
  }

  return { params, engineId, engineParams, mode, arcId, durationSec, warnings };
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
