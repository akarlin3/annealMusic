import { clampParam, type AnnealMusicParams } from '@/state/params';
import {
  KEY_BOUNDS,
  SHARED_KEYS,
  decimalsForStep,
  type SharedKey,
} from '@/share/schema';
import {
  ENGINE_URL_NS,
  clampEngineParam,
  engineIdForUrlNs,
  engineParamDefs,
  isEngineId,
} from '@/audio/engines/index';
import type { EngineId, EngineParams } from '@/audio/engines/types';
import { ARC_DURATION, clampArcDuration, getArcById } from '@/session/arcs';
import type { SessionMode } from '@/session/types';
import {
  SLOT_IDS,
  clampGrainParam,
  makeDefaultLoopConfig,
  type GrainParams,
  type LoopConfigMap,
  type SlotId,
} from '@/loop/types';

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

/**
 * Encode an engine's params as namespaced pairs, e.g. `fm.modRatio=1.00&...` or
 * `gr.size=120&...`. The namespace is the engine's short URL namespace (which
 * equals the id for sine/FM, and is `gr` for granular).
 */
export function encodeEngineParams(
  engineId: EngineId,
  params: EngineParams,
): string {
  const ns = ENGINE_URL_NS[engineId];
  return engineParamDefs(engineId)
    .map((def) => {
      const value = params[def.key] ?? def.default;
      return `${ns}.${def.key}=${value.toFixed(decimalsForStep(def.step))}`;
    })
    .join('&');
}

/** Grain field codes used in the URL (kept short). */
export const GRAIN_FIELDS: {
  code: string;
  key: keyof GrainParams;
  decimals: number;
}[] = [
  { code: 'gs', key: 'sizeMs', decimals: 0 },
  { code: 'gd', key: 'density', decimals: 0 },
  { code: 'gp', key: 'posJitter', decimals: 2 },
  { code: 'gx', key: 'pitchJitter', decimals: 0 },
];

/**
 * Encode loop slot config (schema v4+) as `L<id>.<field>` pairs. Buffers are
 * never encoded — only flags + grain params. Flags emit only when set; grain
 * params emit only for frozen slots. Default/empty slots contribute nothing.
 */
export function encodeLoops(loops: LoopConfigMap): string {
  const parts: string[] = [];
  for (const id of SLOT_IDS) {
    const slot = loops[id];
    if (slot.muted) parts.push(`L${id}.m=1`);
    if (slot.frozen) parts.push(`L${id}.f=1`);
    if (slot.driftCoupled) parts.push(`L${id}.c=1`);
    if (slot.frozen) {
      for (const f of GRAIN_FIELDS) {
        parts.push(`L${id}.${f.code}=${slot.grain[f.key].toFixed(f.decimals)}`);
      }
    }
  }
  return parts.join('&');
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
  loops?: LoopConfigMap,
): string {
  const parts = [`m=${session.mode}`];
  if (session.mode === 'arc') {
    parts.push(`arc=${session.arcId}`, `dur=${session.durationSec}`);
  }
  parts.push(`e=${engineId}`, encodeParams(params));
  const engine = encodeEngineParams(engineId, engineParams);
  if (engine) parts.push(engine);
  if (loops) {
    const loopStr = encodeLoops(loops);
    if (loopStr) parts.push(loopStr);
  }
  return parts.join('&');
}

export interface DecodedState {
  params: Partial<AnnealMusicParams>;
  engineId: EngineId;
  engineParams: Partial<Record<EngineId, EngineParams>>;
  mode: SessionMode;
  arcId?: string;
  durationSec?: number;
  /** Full loop config map (defaults for any slot not present in the URL). */
  loops: LoopConfigMap;
  warnings: string[];
}

const GRAIN_FIELD_BY_CODE = new Map(
  GRAIN_FIELDS.map((f) => [f.code, f] as const),
);

/** Parse one `L<id>.<field>=<raw>` loop pair into `loops`, recording warnings. */
function decodeLoopPair(
  loops: LoopConfigMap,
  id: SlotId,
  field: string,
  raw: string,
  warnings: string[],
): void {
  const slot = loops[id];
  if (field === 'm') {
    slot.muted = raw === '1';
    return;
  }
  if (field === 'f') {
    slot.frozen = raw === '1';
    return;
  }
  if (field === 'c') {
    slot.driftCoupled = raw === '1';
    return;
  }
  // `cap` marks a slot that ships with a server-stored capture (save links
  // only). Buffers are runtime-only, so it's recognized but not part of the
  // shareable SlotConfig — the load flow reads it straight off the payload.
  if (field === 'cap') {
    return;
  }
  const grainField = GRAIN_FIELD_BY_CODE.get(field);
  if (!grainField) {
    warnings.push(`unknown loop field ignored: L${id}.${field}`);
    return;
  }
  const num = raw.trim() === '' ? NaN : Number(raw);
  if (!Number.isFinite(num)) {
    warnings.push(`non-numeric value dropped for L${id}.${field}: ${raw}`);
    return;
  }
  const clamped = clampGrainParam(grainField.key, num);
  if (clamped !== num) {
    warnings.push(
      `value out of range for L${id}.${field}: ${num} clamped to ${clamped}`,
    );
  }
  slot.grain[grainField.key] = clamped;
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
  const loops = makeDefaultLoopConfig();
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

    // Loop slot config: `L<id>.<field>` (schema v4+).
    if (key.length >= 4 && key[0] === 'L' && key[2] === '.') {
      const slotId = key[1] as SlotId;
      if (version < 4) {
        warnings.push(`loop key ignored for schema v${version}: ${key}`);
      } else if (slotId === 'A' || slotId === 'B' || slotId === 'C') {
        decodeLoopPair(loops, slotId, key.slice(3), raw, warnings);
      } else {
        warnings.push(`unknown loop slot ignored: ${key}`);
      }
      continue;
    }

    // Namespaced engine param: `<urlNs>.<paramKey>` (`fm.*`, `gr.*`, ...).
    const dot = key.indexOf('.');
    if (dot !== -1) {
      if (version < 2) {
        warnings.push(`engine param ignored for schema v${version}: ${key}`);
        continue;
      }
      const ns = key.slice(0, dot);
      const paramKey = key.slice(dot + 1);
      const engineNs = engineIdForUrlNs(ns);
      if (!engineNs) {
        warnings.push(`unknown engine namespace ignored: ${key}`);
        continue;
      }
      const def = engineParamDefs(engineNs).find((d) => d.key === paramKey);
      if (!def) {
        warnings.push(`unknown engine param ignored: ${key}`);
        continue;
      }
      const num = raw.trim() === '' ? NaN : Number(raw);
      if (!Number.isFinite(num)) {
        warnings.push(`non-numeric value dropped for ${key}: ${raw}`);
        continue;
      }
      const clamped = clampEngineParam(engineNs, paramKey, num);
      if (clamped !== num) {
        warnings.push(
          `value out of range for ${key}: ${num} clamped to ${clamped}`,
        );
      }
      const bag = engineParams[engineNs] ?? {};
      bag[paramKey] = roundTo(clamped, decimalsForStep(def.step));
      engineParams[engineNs] = bag;
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

  return {
    params,
    engineId,
    engineParams,
    mode,
    arcId,
    durationSec,
    loops,
    warnings,
  };
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
