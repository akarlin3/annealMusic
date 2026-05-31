/**
 * Feature flags configuration for AnnealMusic v8.4 rollout.
 * Enables co-existence of old and new codebases during migration.
 */
export const FEATURE_FLAGS = {
  // Checkpoint 1: Render path consolidation
  USE_UNIFIED_RENDER: true,

  // Checkpoint 3: Bridge transport unification
  USE_UNIFIED_BRIDGE: true,

  // Checkpoint 3: Audio engine composition
  USE_COMPOSITION_ENGINES: true,

  // Checkpoint 4: Capacitor plugin shared base
  USE_UNIFIED_CAPACITOR_BASE: true,

  // Checkpoint 4: Unified session player
  USE_UNIFIED_PLAYER: true,

  // Checkpoint 4: Storage abstraction
  USE_STORAGE_ABSTRACTION: true,
};
