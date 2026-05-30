/* eslint-disable @typescript-eslint/no-explicit-any */
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
import type {
  Movement,
  NotationNote,
  SegmentType,
  VariationPoint,
  AutomationTrack,
  AutomationPoint,
  InterpolationMode,
} from '@/piece/types';
import type { TuningRef, TuningSystemId } from '@/audio/tuning/types';

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
  const parts = engineParamDefs(engineId).map((def) => {
    const value = params[def.key] ?? def.default;
    const serialized =
      typeof value === 'number'
        ? value.toFixed(decimalsForStep(def.step))
        : String(value);
    return `${ns}.${def.key}=${serialized}`;
  });
  if (
    params.grid_lock === 1 ||
    String(params.grid_lock) === 'true' ||
    (params.grid_lock as unknown) === true
  ) {
    parts.push(`${ns}.grid_lock=1`);
  }
  return parts.join('&');
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
  tuning?: TuningRef,
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
  if (tuning) {
    parts.push(`t.system=${tuning.system}`);
    if (tuning.sclId) parts.push(`t.scl_id=${tuning.sclId}`);
    if (tuning.referenceA4Hz !== undefined) {
      parts.push(`t.ref_a4=${tuning.referenceA4Hz}`);
    }
  }
  return parts.join('&');
}

export interface DecodedPieceSegment {
  type: 'fixed' | 'arc' | 'open' | 'transition' | 'meta-arc';
  durationMs: number | null;
  config: Record<string, unknown>;
  variations?: VariationPoint[];
}

export interface DecodedPiece {
  title?: string;
  description?: string;
  tempoBpm?: number | null; // <-- NEW
  variationSeed?: number | null;
  variations?: VariationPoint[];
  defaultsState: {
    params: Partial<AnnealMusicParams>;
    engineId: EngineId;
    engineParams: Partial<Record<EngineId, EngineParams>>;
    loops: LoopConfigMap;
    tuning?: TuningRef;
  };
  segments: DecodedPieceSegment[];
  notation?: NotationNote[];
  movements?: Movement[];
  automationTracks?: AutomationTrack[];
}

export interface DecodedListeningSession {
  pieceId: string;
  title?: string;
  description?: string;
  intention?: string;
  lengthCategory?: string;
  recommendedEnvironment?: string;
  settleInMs: number;
  integrationMs: number;
  openingTone: boolean;
  closingTone: boolean;
}

export type DecodedState =
  | {
      kind: 'patch';
      params: Partial<AnnealMusicParams>;
      engineId: EngineId;
      engineParams: Partial<Record<EngineId, EngineParams>>;
      mode: SessionMode;
      arcId?: string;
      durationSec?: number;
      loops: LoopConfigMap;
      tuning?: TuningRef;
      warnings: string[];
    }
  | {
      kind: 'piece';
      piece: DecodedPiece;
      warnings: string[];
    }
  | {
      kind: 'listening-session';
      listeningSession: DecodedListeningSession;
      warnings: string[];
    };

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
 * Decode a patch payload. Internal helper for decodeState.
 */
function decodePatchState(
  version: number,
  payload: string,
): {
  params: Partial<AnnealMusicParams>;
  engineId: EngineId;
  engineParams: Partial<Record<EngineId, EngineParams>>;
  mode: SessionMode;
  arcId?: string;
  durationSec?: number;
  loops: LoopConfigMap;
  tuning?: TuningRef;
  warnings: string[];
} {
  const params: Partial<AnnealMusicParams> = {};
  const engineParams: Partial<Record<EngineId, EngineParams>> = {};
  const loops = makeDefaultLoopConfig();
  const warnings: string[] = [];
  let engineId: EngineId = 'sine';
  let mode: SessionMode = 'open';
  let arcId: string | undefined;
  let durationSec: number | undefined;
  let tuning: TuningRef | undefined;

  for (const pair of payload.split('&')) {
    if (pair === '') continue;

    const eq = pair.indexOf('=');
    if (eq === -1) {
      warnings.push(`malformed pair (no '='): ${pair}`);
      continue;
    }

    const key = pair.slice(0, eq);
    const raw = pair.slice(eq + 1);

    if (key === 't.system') {
      if (!tuning) tuning = { system: 'equal', referenceA4Hz: 440 };
      tuning.system = raw as TuningSystemId;
      continue;
    }
    if (key === 't.scl_id') {
      if (!tuning) tuning = { system: 'equal', referenceA4Hz: 440 };
      tuning.sclId = raw;
      continue;
    }
    if (key === 't.ref_a4') {
      if (!tuning) tuning = { system: 'equal', referenceA4Hz: 440 };
      tuning.referenceA4Hz = parseFloat(raw) || 440;
      continue;
    }

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
      if (paramKey === 'grid_lock') {
        const bag = engineParams[engineNs] ?? {};
        bag[paramKey] = raw === '1' || raw === 'true' ? 1 : 0;
        engineParams[engineNs] = bag;
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
      const clamped = clampEngineParam(engineNs, paramKey, num) as number;
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

  if (version <= 16 && !tuning) {
    tuning = { system: 'equal', referenceA4Hz: 440 };
  }

  return {
    params,
    engineId,
    engineParams,
    mode,
    arcId,
    durationSec,
    loops,
    tuning,
    warnings,
  };
}

function encodeVariationPoint(vp: VariationPoint): string {
  const c = vp.constraint;
  let cfg = '';
  if (c.type === 'range') {
    cfg = `${c.min ?? ''},${c.max ?? ''}`;
  } else if (c.type === 'enum') {
    cfg = (c.choices ?? []).join('|');
  } else if (c.type === 'relative') {
    cfg = `${c.percent ?? ''}`;
  } else if (c.type === 'correlated') {
    cfg = `${c.targetParam ?? ''},${c.coefficient ?? ''}`;
  }
  return `${vp.id}:${vp.paramKey}:${c.type}:${cfg}:${vp.rule}`;
}

function decodeVariationPoint(str: string): VariationPoint | null {
  const parts = str.split(':');
  if (parts.length < 5) return null;
  const [id, paramKey, type, cfg, rule] = parts;
  if (!id || !paramKey || !type || cfg === undefined || !rule) return null;

  const constraint: any = { type };
  if (type === 'range') {
    const [minStr, maxStr] = cfg.split(',');
    constraint.min = minStr ? Number(minStr) : undefined;
    constraint.max = maxStr ? Number(maxStr) : undefined;
  } else if (type === 'enum') {
    constraint.choices = cfg ? cfg.split('|').map(Number) : [];
  } else if (type === 'relative') {
    constraint.percent = cfg ? Number(cfg) : undefined;
  } else if (type === 'correlated') {
    const [targetParam, coeffStr] = cfg.split(',');
    constraint.targetParam = targetParam || undefined;
    constraint.coefficient = coeffStr ? Number(coeffStr) : undefined;
  }

  return {
    id,
    paramKey,
    constraint,
    rule: rule as 'per-play' | 'per-segment' | 'per-render',
  };
}

/** Decode a v8 piece payload from URL */
export function decodePiecePayload(
  payload: string,
  version: number = 17,
): DecodedPiece {
  let title: string | undefined;
  let description: string | undefined;
  let tempoBpm: number | null = null;
  let variationSeed: number | null = null;
  let variations: VariationPoint[] = [];
  let notation: NotationNote[] = [];
  const defPairs: string[] = [];
  const automationTracksMap = new Map<string, AutomationPoint[]>();
  const segMap: Record<
    number,
    {
      type?: SegmentType;
      dur?: number | null;
      config: Record<string, unknown>;
      variations?: VariationPoint[];
    }
  > = {};
  const movMap: Record<
    number,
    {
      name?: string;
      desc?: string;
      in?: number;
      out?: number;
      start?: number;
      end?: number;
    }
  > = {};

  for (const pair of payload.split('&')) {
    if (pair === '') continue;
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const key = pair.slice(0, eq);
    const raw = pair.slice(eq + 1);

    if (key === 'title') {
      title = decodeURIComponent(raw);
    } else if (key === 'desc') {
      description = decodeURIComponent(raw);
    } else if (key === 'tempo') {
      const parsed = Number(raw);
      tempoBpm = isNaN(parsed) ? null : parsed;
    } else if (key === 'varSeed') {
      const parsed = Number(raw);
      variationSeed = isNaN(parsed) ? null : parsed;
    } else if (key === 'v.p' && raw !== '') {
      variations = decodeURIComponent(raw)
        .split(';')
        .map(decodeVariationPoint)
        .filter(Boolean) as VariationPoint[];
    } else if (key === 'notation' && raw !== '') {
      notation = raw.split(';').map((noteStr, idx) => {
        const parts = noteStr.split(',').map(Number);
        const onset = parts[0] ?? 0;
        const dur = parts[1] ?? 500;
        const pitch = parts[2] ?? 60;
        return {
          id: `note-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          onset_ms: onset,
          duration_ms: dur,
          pitch_midi: pitch,
        };
      });
    } else if (key.startsWith('auto.')) {
      const paramKey = key.slice(5);
      if (raw !== '') {
        const points: AutomationPoint[] = decodeURIComponent(raw)
          .split(';')
          .map((ptStr, idx) => {
            const parts = ptStr.split(',');
            const timeMs = Number(parts[0] ?? 0);
            const value = Number(parts[1] ?? 0);
            const interpCode = parts[2] ?? 'l';
            const interpolation: InterpolationMode =
              interpCode === 'e'
                ? 'exponential'
                : interpCode === 'h'
                  ? 'hold'
                  : 'linear';
            return {
              id: `point-${idx}-${Math.random().toString(36).substr(2, 5)}`,
              timeMs,
              value,
              interpolation,
            };
          });
        automationTracksMap.set(paramKey, points);
      }
    } else if (key.startsWith('def.')) {
      defPairs.push(pair.slice(4));
    } else if (key.startsWith('mov')) {
      const dot = key.indexOf('.');
      if (dot !== -1) {
        const prefix = key.slice(3, dot);
        const idx = parseInt(prefix, 10);
        if (!isNaN(idx)) {
          const movKey = key.slice(dot + 1);
          if (!movMap[idx]) {
            movMap[idx] = {};
          }
          if (movKey === 'name') {
            movMap[idx].name = decodeURIComponent(raw);
          } else if (movKey === 'desc') {
            movMap[idx].desc = decodeURIComponent(raw);
          } else if (movKey === 'in') {
            movMap[idx].in = parseInt(raw, 10);
          } else if (movKey === 'out') {
            movMap[idx].out = parseInt(raw, 10);
          } else if (movKey === 'start') {
            movMap[idx].start = parseInt(raw, 10);
          } else if (movKey === 'end') {
            movMap[idx].end = parseInt(raw, 10);
          }
        }
      }
    } else if (key.startsWith('seg')) {
      const dot = key.indexOf('.');
      if (dot !== -1) {
        const prefix = key.slice(3, dot);
        const idx = parseInt(prefix, 10);
        if (!isNaN(idx)) {
          const segKey = key.slice(dot + 1);
          if (!segMap[idx]) {
            segMap[idx] = { config: {} };
          }
          if (segKey === 'type') {
            segMap[idx].type = raw as SegmentType;
          } else if (segKey === 'dur') {
            segMap[idx].dur = raw === 'null' ? null : parseInt(raw, 10);
          } else if (segKey === 'v' && raw !== '') {
            segMap[idx].variations = decodeURIComponent(raw)
              .split(';')
              .map(decodeVariationPoint)
              .filter(Boolean) as VariationPoint[];
          } else if (segKey === 'cfg') {
            try {
              segMap[idx].config = JSON.parse(
                decodeURIComponent(raw),
              ) as Record<string, unknown>;
            } catch (e) {
              console.warn('Failed to parse meta-arc config JSON', e);
            }
          } else if (segKey.startsWith('t.')) {
            if (!segMap[idx].config.tuning) {
              segMap[idx].config.tuning = {};
            }
            const tKey = segKey.slice(2);
            const tuningObj = segMap[idx].config.tuning as any;
            if (tKey === 'system') {
              tuningObj.system = raw;
            } else if (tKey === 'scl_id') {
              tuningObj.sclId = raw;
            } else if (tKey === 'ref_a4') {
              tuningObj.referenceA4Hz = parseFloat(raw);
            }
          } else {
            const num = Number(raw);
            let parsedVal: unknown = isNaN(num) ? decodeURIComponent(raw) : num;
            if (parsedVal === 'true') parsedVal = true;
            if (parsedVal === 'false') parsedVal = false;
            segMap[idx].config[segKey] = parsedVal;
          }
        }
      }
    }
  }

  const defPayload = defPairs.join('&');
  const decodedDef = decodePatchState(version, defPayload);

  const sortedIndices = Object.keys(segMap)
    .map(Number)
    .sort((a, b) => a - b);
  const segments: DecodedPieceSegment[] = sortedIndices.map((idx) => {
    const s = segMap[idx]!;
    return {
      type: s.type || 'fixed',
      durationMs: s.dur !== undefined ? s.dur : 5000,
      config: s.config,
      variations: s.variations || [],
    };
  });

  const sortedMovIndices = Object.keys(movMap)
    .map(Number)
    .sort((a, b) => a - b);
  const movements: Movement[] = sortedMovIndices
    .map((idx) => {
      const m = movMap[idx]!;
      if (
        m.name === undefined ||
        m.start === undefined ||
        m.end === undefined
      ) {
        return null;
      }
      return {
        name: m.name,
        description: m.desc,
        transition_in_ms: m.in !== undefined && !isNaN(m.in) ? m.in : undefined,
        transition_out_ms:
          m.out !== undefined && !isNaN(m.out) ? m.out : undefined,
        startSegmentIndex: m.start,
        endSegmentIndex: m.end,
      };
    })
    .filter(Boolean) as Movement[];

  const automationTracks: AutomationTrack[] = Array.from(
    automationTracksMap.entries(),
  ).map(([paramKey, points]) => ({
    id: `track-${paramKey}`,
    paramKey,
    points: points.sort((a, b) => a.timeMs - b.timeMs),
  }));

  return {
    title,
    description,
    tempoBpm,
    variationSeed,
    variations,
    defaultsState: {
      params: decodedDef.params,
      engineId: decodedDef.engineId,
      engineParams: decodedDef.engineParams,
      loops: decodedDef.loops,
      tuning: decodedDef.tuning,
    },
    segments,
    notation,
    movements: movements.length > 0 ? movements : undefined,
    automationTracks:
      automationTracks.length > 0 ? automationTracks : undefined,
  };
}

function simplifyPoints(
  points: {
    timeMs: number;
    value: number;
    interpolation: string;
    id?: string;
  }[],
  tolerance: number = 0.001,
): typeof points {
  if (points.length <= 2) return points;

  let maxSqDist = 0;
  let index = 0;
  const end = points.length - 1;
  const p0 = points[0]!;
  const pE = points[end]!;

  for (let i = 1; i < end; i++) {
    const p = points[i]!;
    let sqDist = 0;
    const dx = pE.timeMs - p0.timeMs;
    const dy = pE.value - p0.value;
    if (dx !== 0 || dy !== 0) {
      const t =
        ((p.timeMs - p0.timeMs) * dx + (p.value - p0.value) * dy) /
        (dx * dx + dy * dy);
      const clampedT = Math.max(0, Math.min(1, t));
      const projX = p0.timeMs + clampedT * dx;
      const projY = p0.value + clampedT * dy;
      sqDist = Math.pow(p.timeMs - projX, 2) + Math.pow(p.value - projY, 2);
    } else {
      sqDist =
        Math.pow(p.timeMs - p0.timeMs, 2) + Math.pow(p.value - p0.value, 2);
    }

    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }

  if (maxSqDist > tolerance * tolerance) {
    const results1 = simplifyPoints(points.slice(0, index + 1), tolerance);
    const results2 = simplifyPoints(points.slice(index), tolerance);
    return results1.slice(0, results1.length - 1).concat(results2);
  } else {
    return [p0, pE];
  }
}

/** Encode a Piece into a version 14 URL payload string */
export function encodePiece(piece: {
  title?: string | null;
  description?: string | null;
  tempoBpm?: number | null;
  variationSeed?: number | null;
  variations?: VariationPoint[];
  defaultsState: {
    params: AnnealMusicParams;
    engineId: EngineId;
    engineParams: EngineParams;
    loops?: LoopConfigMap;
  };
  segments: {
    type: 'fixed' | 'arc' | 'open' | 'transition' | 'meta-arc';
    durationMs: number | null;
    config: Record<string, unknown>;
    variations?: VariationPoint[];
  }[];
  notation?: {
    onset_ms: number;
    duration_ms: number;
    pitch_midi: number;
  }[];
  movements?: {
    name: string;
    description?: string;
    transition_in_ms?: number;
    transition_out_ms?: number;
    startSegmentIndex: number;
    endSegmentIndex: number;
  }[];
  automationTracks?: {
    paramKey: string;
    points: {
      timeMs: number;
      value: number;
      interpolation: InterpolationMode;
    }[];
  }[];
}): string {
  const parts = ['kind=piece'];
  if (piece.title) parts.push(`title=${encodeURIComponent(piece.title)}`);
  if (piece.description) {
    parts.push(`desc=${encodeURIComponent(piece.description)}`);
  }
  if (piece.tempoBpm !== undefined && piece.tempoBpm !== null) {
    parts.push(`tempo=${piece.tempoBpm}`);
  }
  if (piece.variationSeed !== undefined && piece.variationSeed !== null) {
    parts.push(`varSeed=${piece.variationSeed}`);
  }
  if (piece.variations && piece.variations.length > 0) {
    const val = piece.variations.map(encodeVariationPoint).join(';');
    parts.push(`v.p=${encodeURIComponent(val)}`);
  }
  if (piece.notation && piece.notation.length > 0) {
    const encodedNotes = piece.notation
      .map((n) => `${n.onset_ms},${n.duration_ms},${n.pitch_midi}`)
      .join(';');
    parts.push(`notation=${encodedNotes}`);
  }
  if (piece.movements && piece.movements.length > 0) {
    piece.movements.forEach((mov, idx) => {
      parts.push(`mov${idx}.name=${encodeURIComponent(mov.name)}`);
      if (mov.description) {
        parts.push(`mov${idx}.desc=${encodeURIComponent(mov.description)}`);
      }
      if (mov.transition_in_ms !== undefined && mov.transition_in_ms !== null) {
        parts.push(`mov${idx}.in=${mov.transition_in_ms}`);
      }
      if (
        mov.transition_out_ms !== undefined &&
        mov.transition_out_ms !== null
      ) {
        parts.push(`mov${idx}.out=${mov.transition_out_ms}`);
      }
      parts.push(`mov${idx}.start=${mov.startSegmentIndex}`);
      parts.push(`mov${idx}.end=${mov.endSegmentIndex}`);
    });
  }
  if (piece.automationTracks && piece.automationTracks.length > 0) {
    piece.automationTracks.forEach((track) => {
      const simplified = simplifyPoints(track.points, 0.001);
      const bounds = KEY_BOUNDS[track.paramKey as SharedKey];
      const decimals = bounds ? bounds.decimals : 2;
      const encodedPoints = simplified
        .map(
          (p) =>
            `${p.timeMs},${p.value.toFixed(decimals)},${p.interpolation[0]}`,
        )
        .join(';');
      parts.push(`auto.${track.paramKey}=${encodeURIComponent(encodedPoints)}`);
    });
  }

  const defStateStr = encodeState(
    piece.defaultsState.params as AnnealMusicParams,
    piece.defaultsState.engineId,
    piece.defaultsState.engineParams as EngineParams,
    undefined,
    piece.defaultsState.loops,
    (piece.defaultsState as any).tuning,
  );
  for (const pair of defStateStr.split('&')) {
    if (pair !== '') {
      parts.push(`def.${pair}`);
    }
  }

  piece.segments.forEach((seg, idx) => {
    parts.push(`seg${idx}.type=${seg.type}`);
    parts.push(
      `seg${idx}.dur=${seg.durationMs === null ? 'null' : seg.durationMs}`,
    );
    if (seg.variations && seg.variations.length > 0) {
      const val = seg.variations.map(encodeVariationPoint).join(';');
      parts.push(`seg${idx}.v=${encodeURIComponent(val)}`);
    }
    if (seg.type === 'meta-arc') {
      parts.push(
        `seg${idx}.cfg=${encodeURIComponent(JSON.stringify(seg.config))}`,
      );
    } else {
      for (const [k, v] of Object.entries(seg.config)) {
        if (k === 'tuning' && v && typeof v === 'object') {
          const segTuning = v as any;
          parts.push(`seg${idx}.t.system=${segTuning.system}`);
          if (segTuning.sclId)
            parts.push(`seg${idx}.t.scl_id=${segTuning.sclId}`);
          if (segTuning.referenceA4Hz !== undefined) {
            parts.push(`seg${idx}.t.ref_a4=${segTuning.referenceA4Hz}`);
          }
        } else {
          parts.push(
            `seg${idx}.${k}=${typeof v === 'string' ? encodeURIComponent(v) : v}`,
          );
        }
      }
    }
  });

  return parts.join('&');
}

/**
 * Decode a payload for the given schema version into shared params, the engine
 * selection, and engine-specific params. Never throws: unknown keys and
 * unparseable values are dropped, out-of-range values clamped, each adjustment
 * recorded as a warning. v1 payloads carry no engine state → `engine=sine`.
 */
export function decodeState(version: number, payload: string): DecodedState {
  if (version < 8) {
    const patchState = decodePatchState(version, payload);
    return {
      kind: 'patch',
      ...patchState,
    };
  }

  // Version 8+
  const pairs = payload.split('&');
  let kind: 'patch' | 'piece' | 'listening-session' = 'patch';
  for (const pair of pairs) {
    if (pair.startsWith('kind=')) {
      const val = pair.slice(5);
      if (val === 'piece') kind = 'piece';
      else if (val === 'listening-session') kind = 'listening-session';
      break;
    }
  }

  if (kind === 'piece') {
    return {
      kind: 'piece',
      piece: decodePiecePayload(payload, version),
      warnings: [],
    };
  } else if (kind === 'listening-session') {
    return {
      kind: 'listening-session',
      listeningSession: decodeListeningSessionPayload(payload),
      warnings: [],
    };
  } else {
    const cleanPayload = pairs.filter((p) => !p.startsWith('kind=')).join('&');
    const patchState = decodePatchState(version, cleanPayload);
    return {
      kind: 'patch',
      ...patchState,
    };
  }
}

/**
 * Decode shared params only (v1 semantics). Retained for callers/tests that
 * deal purely with the sculptable shared params; delegates to `decodeState`.
 */
export function decodeParams(payload: string): {
  params: Partial<AnnealMusicParams>;
  warnings: string[];
} {
  const res = decodeState(1, payload);
  if (res.kind === 'patch') {
    return { params: res.params, warnings: res.warnings };
  }
  return { params: {}, warnings: [] };
}

export function decodeListeningSessionPayload(
  payload: string,
): DecodedListeningSession {
  let pieceId = '';
  let title: string | undefined;
  let description: string | undefined;
  let intention: string | undefined;
  let lengthCategory: string | undefined;
  let recommendedEnvironment: string | undefined;
  let settleInMs = 30000;
  let integrationMs = 60000;
  let openingTone = false;
  let closingTone = false;

  for (const pair of payload.split('&')) {
    if (pair === '') continue;
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const key = pair.slice(0, eq);
    const raw = pair.slice(eq + 1);

    if (key === 'pieceId') {
      pieceId = raw;
    } else if (key === 'title') {
      title = decodeURIComponent(raw);
    } else if (key === 'desc') {
      description = decodeURIComponent(raw);
    } else if (key === 'intention') {
      intention = decodeURIComponent(raw);
    } else if (key === 'cat') {
      lengthCategory = decodeURIComponent(raw);
    } else if (key === 'env') {
      recommendedEnvironment = decodeURIComponent(raw);
    } else if (key === 'settle') {
      settleInMs = parseInt(raw, 10) || 30000;
    } else if (key === 'integrate') {
      integrationMs = parseInt(raw, 10) || 60000;
    } else if (key === 'openB') {
      openingTone = raw === '1' || raw === 'true';
    } else if (key === 'closeB') {
      closingTone = raw === '1' || raw === 'true';
    }
  }

  return {
    pieceId,
    title,
    description,
    intention,
    lengthCategory,
    recommendedEnvironment,
    settleInMs,
    integrationMs,
    openingTone,
    closingTone,
  };
}

export function encodeListeningSession(
  session: DecodedListeningSession,
): string {
  const parts = ['kind=listening-session'];
  parts.push(`pieceId=${session.pieceId}`);
  if (session.title) parts.push(`title=${encodeURIComponent(session.title)}`);
  if (session.description)
    parts.push(`desc=${encodeURIComponent(session.description)}`);
  if (session.intention)
    parts.push(`intention=${encodeURIComponent(session.intention)}`);
  if (session.lengthCategory)
    parts.push(`cat=${encodeURIComponent(session.lengthCategory)}`);
  if (session.recommendedEnvironment)
    parts.push(`env=${encodeURIComponent(session.recommendedEnvironment)}`);
  parts.push(`settle=${session.settleInMs}`);
  parts.push(`integrate=${session.integrationMs}`);
  parts.push(`openB=${session.openingTone ? '1' : '0'}`);
  parts.push(`closeB=${session.closingTone ? '1' : '0'}`);
  return parts.join('&');
}
