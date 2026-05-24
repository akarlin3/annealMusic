import { SineEngine } from '@/audio/engines/sine';
import {
  defaultsFromParamDefs,
  type AnnealEngine,
  type EngineId,
  type EngineParams,
} from '@/audio/engines/types';

/** Factory for a fresh engine instance (start-is-not-idempotent contract). */
export type EngineFactory = () => AnnealEngine;

/**
 * Registry of selectable engines. v0.3 ships `sine` (CP1); `fm` is added in CP2.
 * Partial so the registry can grow checkpoint-by-checkpoint without forcing
 * every `EngineId` to exist yet.
 */
export const ENGINES: Partial<Record<EngineId, EngineFactory>> = {
  sine: () => new SineEngine(),
};

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
