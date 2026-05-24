import { SineEngine } from '@/audio/engines/sine';
import { FmEngine } from '@/audio/engines/fm';
import {
  defaultsFromParamDefs,
  type AnnealEngine,
  type EngineId,
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
