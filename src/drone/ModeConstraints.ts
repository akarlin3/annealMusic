import type { SharedParams } from '@/audio/engines/types';

/**
 * Adapter enforcing parameter limits and constraints in Drone mode.
 * - Forces drift <= 0.2 (stays meditative, slow organic movement).
 * - Forces coupling >= 0.6 (partials stay tightly coherent).
 * - Forces spread = 1.0 (pure harmonic ratios under the chosen tuning).
 * - Forces space >= 0.5 (reverb is active and spacious).
 */
export const DRONE_CONSTRAINTS = {
  drift: { max: 0.2 },
  coupling: { min: 0.6 },
  spread: 1.0,
  space: { min: 0.5 },
} as const;

/**
 * Enforce drone-specific constraints on a partial set of shared parameters.
 */
export function clampSharedParamsForDrone(
  partial: Partial<SharedParams>,
): Partial<SharedParams> {
  const result = { ...partial };

  if (result.drift !== undefined) {
    result.drift = Math.min(result.drift, DRONE_CONSTRAINTS.drift.max);
  }
  if (result.coupling !== undefined) {
    result.coupling = Math.max(result.coupling, DRONE_CONSTRAINTS.coupling.min);
  }
  if (result.spread !== undefined) {
    result.spread = DRONE_CONSTRAINTS.spread;
  }
  if (result.space !== undefined) {
    result.space = Math.max(result.space, DRONE_CONSTRAINTS.space.min);
  }

  return result;
}

/**
 * Enforce drone-specific constraints on a complete set of shared parameters.
 */
export function enforceDroneConstraints(params: SharedParams): SharedParams {
  return {
    ...params,
    drift: Math.min(params.drift, DRONE_CONSTRAINTS.drift.max),
    coupling: Math.max(params.coupling, DRONE_CONSTRAINTS.coupling.min),
    spread: DRONE_CONSTRAINTS.spread,
    space: Math.max(params.space, DRONE_CONSTRAINTS.space.min),
  };
}
