import { SineEngine } from '@/audio/engines/sine';
import { FmEngine } from '@/audio/engines/fm';
import { GranularEngine } from '@/audio/engines/granular';
import { PhysicalEngine } from '@/audio/engines/physical';
import {
  defaultsFromParamDefs,
  type AnnealEngine,
  type AnnealEngineCapabilities,
  type EngineId,
  type EngineParamDef,
  type EngineParams,
} from '@/audio/engines/types';

/** Factory for a fresh engine instance (start-is-not-idempotent contract). */
export type EngineFactory = () => AnnealEngine;

/**
 * Registry of selectable engines. Partial so the registry can grow without
 * forcing every `EngineId` to exist yet.
 */
export const ENGINES: Partial<Record<EngineId, EngineFactory>> = {
  sine: () => new SineEngine(),
  fm: () => new FmEngine(),
  granular: () => new GranularEngine(),
  physical: () => new PhysicalEngine(),
};

/** Selectable engines in display order (drives the selector + share schema). */
export const ENGINE_ORDER: readonly EngineId[] = [
  'sine',
  'fm',
  'granular',
  'physical',
];

/** Human-facing labels for each engine. */
export const ENGINE_LABELS: Record<EngineId, string> = {
  sine: 'Sine',
  fm: 'FM',
  granular: 'Granular',
  physical: 'Physical',
};

/**
 * Short URL namespace for each engine's params (schema v5). Defaults to the
 * engine id; granular uses `gr` to keep share links compact (`gr.size=...`).
 * The engine SELECTOR still uses the full id (`e=granular`).
 */
export const ENGINE_URL_NS: Record<EngineId, string> = {
  sine: 'sine',
  fm: 'fm',
  granular: 'gr',
  physical: 'ph',
};

const URL_NS_TO_ENGINE: ReadonlyMap<string, EngineId> = new Map(
  (Object.keys(ENGINE_URL_NS) as EngineId[]).map((id) => [
    ENGINE_URL_NS[id],
    id,
  ]),
);

/** Resolve a URL param namespace (e.g. `gr`) back to its engine id. */
export function engineIdForUrlNs(ns: string): EngineId | undefined {
  return URL_NS_TO_ENGINE.get(ns);
}

const EMPTY_CAPABILITIES: AnnealEngineCapabilities = {
  densityLockedWhilePlaying: false,
  params: [],
};

/** True when `value` names a registered engine (narrows to `EngineId`). */
export function isEngineId(value: string): value is EngineId {
  return value in ENGINES;
}

/** Capabilities (param defs + flags) for an engine. */
export function engineCapabilities(id: EngineId): AnnealEngineCapabilities {
  const factory = ENGINES[id];
  return factory ? factory().capabilities : EMPTY_CAPABILITIES;
}

/** Engine-specific param definitions for an engine (empty if it has none). */
export function engineParamDefs(id: EngineId): readonly EngineParamDef[] {
  return engineCapabilities(id).params;
}

export function clampEngineParam(
  id: EngineId,
  key: string,
  value: number | string,
): number | string {
  if (typeof value === 'string') return value;
  const def = engineParamDefs(id).find((d) => d.key === key);
  if (!def) return value;
  return Math.min(def.max, Math.max(def.min, value));
}

/** Build the default engine-param bag for every registered engine. */
export function makeDefaultEngineParams(): Partial<
  Record<EngineId, EngineParams>
> {
  const out: Partial<Record<EngineId, EngineParams>> = {};
  for (const id of Object.keys(ENGINES) as EngineId[]) {
    const factory = ENGINES[id];
    if (factory) out[id] = defaultsFromParamDefs(factory().capabilities.params);
  }
  return out;
}
