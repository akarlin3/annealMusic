import { CONTROL_DEFS, type ParamKey } from '@/state/params';

/** Schema version embedded in shared URLs as `#s=<version>:<payload>`. */
export const SCHEMA_VERSION = 5;

/**
 * Schema versions this build can still decode. v1 predates engine state; v2
 * predates session mode (both load as `mode=open`); v3 predates loop config
 * (loads with default empty slots); v4 predates the granular engine + `gr.*`
 * params (loads with no granular state).
 */
export const SUPPORTED_SCHEMA_VERSIONS: readonly number[] = [1, 2, 3, 4, 5];

/** Param keys carried in shared URLs — everything sculptable except volume. */
export type SharedKey = Exclude<ParamKey, 'volume'>;

/** Decimal precision for a control, derived from its slider step. */
export function decimalsForStep(step: number): number {
  return step >= 1 ? 0 : 2;
}

export interface KeyBound {
  min: number;
  max: number;
  decimals: number;
}

/**
 * Shared keys, in a stable serialization order. Derived from `CONTROL_DEFS`,
 * which already excludes volume, so the two can never drift apart.
 */
export const SHARED_KEYS: readonly SharedKey[] = CONTROL_DEFS.map(
  (def) => def.key as SharedKey,
);

/**
 * Per-key bounds and precision for URL encode/decode. Derived from
 * `CONTROL_DEFS` rather than re-declared, so bounds live in exactly one place.
 */
export const KEY_BOUNDS: Record<SharedKey, KeyBound> = (() => {
  const out = {} as Record<SharedKey, KeyBound>;
  for (const def of CONTROL_DEFS) {
    out[def.key as SharedKey] = {
      min: def.min,
      max: def.max,
      decimals: decimalsForStep(def.step),
    };
  }
  return out;
})();
