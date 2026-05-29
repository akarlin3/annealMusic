import type { Arc, ArcSegment, ArcTargetKey, CurveName } from '@/session/types';

/**
 * Standard robust Mulberry32 seeded RNG.
 * Produces deterministic floats in [0, 1).
 */
export function createSeededRng(seed: string | number): () => number {
  let s = 0;
  if (typeof seed === 'number') {
    s = seed >>> 0;
  } else {
    // cyrb128 style hash to turn string into 32-bit int
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    s = h >>> 0;
  }
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fallback conservative multiplier bounds for each key. */
export const DEFAULT_MULTIPLIER_BOUNDS: Record<
  ArcTargetKey,
  { min: number; max: number }
> = {
  rootFreq: { min: 0.4, max: 2.0 },
  spread: { min: 0.5, max: 2.0 },
  density: { min: 0.2, max: 4.0 },
  coupling: { min: 0.1, max: 2.0 },
  drift: { min: 0.1, max: 2.0 },
  brightness: { min: 0.1, max: 2.0 },
  space: { min: 0.1, max: 2.0 },
};

/** Ensure value is clamped within designated or default multiplier bounds. */
function clampMultiplier(
  key: ArcTargetKey,
  val: number,
  customBounds?: Partial<Record<ArcTargetKey, { min: number; max: number }>>,
): number {
  const bounds = customBounds?.[key] || DEFAULT_MULTIPLIER_BOUNDS[key];
  return Math.min(bounds.max, Math.max(bounds.min, val));
}

export interface RandomWalkConfig {
  params?: ArcTargetKey[];
  driftStrength?: number;
  meanReversion?: number;
  steps?: number;
  bounds?: Partial<Record<ArcTargetKey, { min: number; max: number }>>;
}

export interface WaypointTourConfig {
  params?: ArcTargetKey[];
  waypointsCount?: number;
  maxDistance?: number;
  easing?: CurveName;
  bounds?: Partial<Record<ArcTargetKey, { min: number; max: number }>>;
}

export interface BellCurveConfig {
  params?: ArcTargetKey[];
  minSettleFraction?: number;
  maxSettleFraction?: number;
  minHoldFraction?: number;
  maxHoldFraction?: number;
  paramBounds?: Partial<Record<ArcTargetKey, { min: number; max: number }>>;
}

export interface SpectralConfig {
  rootBounds?: { min: number; max: number };
  densityBounds?: { min: number; max: number };
  brightnessBounds?: { min: number; max: number };
  coordinationType?: 'inverse-crossover' | 'parallel-sweep';
}

export interface MetaArcConfig {
  randomWalk?: RandomWalkConfig;
  waypointTour?: WaypointTourConfig;
  bellCurveVariation?: BellCurveConfig;
  spectralEvolution?: SpectralConfig;
}

/**
 * 1. Random Walk Generator
 * Ornstein-Uhlenbeck-like discrete wander in multiplier space.
 */
export function generateRandomWalk(
  config: RandomWalkConfig | undefined,
  seed: string | number,
): Arc {
  const rng = createSeededRng(seed);
  const params: ArcTargetKey[] = config?.params || [
    'rootFreq',
    'brightness',
    'space',
  ];
  const driftStrength =
    config?.driftStrength !== undefined ? config.driftStrength : 0.1;
  const meanReversion =
    config?.meanReversion !== undefined ? config.meanReversion : 0.15;
  const steps = Math.min(100, Math.max(5, config?.steps || 20));
  const customBounds = config?.bounds || {};

  const activeParams = params.filter((p) => DEFAULT_MULTIPLIER_BOUNDS[p]);
  if (activeParams.length === 0) {
    activeParams.push('rootFreq');
  }

  const dt = 1.0 / steps;
  const sqrtDt = Math.sqrt(dt);
  const state: Record<string, number> = {};

  // Start at neutral multiplier (1.0)
  for (const p of activeParams) {
    state[p] = 1.0;
  }

  const segments: ArcSegment[] = [];

  for (let i = 0; i < steps; i++) {
    const targets: Record<string, number> = {};
    for (const p of activeParams) {
      const current = state[p]!;
      const ou = -meanReversion * (current - 1.0) * dt;
      const noise = driftStrength * (rng() - 0.5) * sqrtDt;
      const next = clampMultiplier(p, current + ou + noise, customBounds);
      state[p] = next;
      targets[p] = next;
    }
    segments.push({
      fraction: dt,
      curve: 'linear',
      targets,
    });
  }

  return {
    id: `walk-${seed}`,
    name: 'Random Walk',
    description: `OU Random Walk with seed ${seed}`,
    segments,
  };
}

/**
 * 2. Waypoint Tour Generator
 * Selects N target parameter waypoints and smooth-eases through them.
 */
export function generateWaypointTour(
  config: WaypointTourConfig | undefined,
  seed: string | number,
): Arc {
  const rng = createSeededRng(seed);
  const params: ArcTargetKey[] = config?.params || [
    'rootFreq',
    'brightness',
    'space',
  ];
  const waypointsCount = Math.min(10, Math.max(3, config?.waypointsCount || 5));
  const maxDistance =
    config?.maxDistance !== undefined ? config.maxDistance : 0.4;
  const easing: CurveName = config?.easing || 'easeInOut';
  const customBounds = config?.bounds || {};

  const activeParams = params.filter((p) => DEFAULT_MULTIPLIER_BOUNDS[p]);
  if (activeParams.length === 0) {
    activeParams.push('rootFreq');
  }

  const waypoints: Record<string, number>[] = [];
  const current: Record<string, number> = {};
  for (const p of activeParams) {
    current[p] = 1.0;
  }
  waypoints.push({ ...current });

  for (let w = 1; w < waypointsCount; w++) {
    const nextW: Record<string, number> = {};
    for (const p of activeParams) {
      const bounds = customBounds[p] || DEFAULT_MULTIPLIER_BOUNDS[p];
      const range = bounds.max - bounds.min;
      const prevVal = current[p]!;

      // Select value and clamp delta by maxDistance * range
      const randVal = bounds.min + rng() * range;
      const maxDelta = maxDistance * range;
      const nextVal = clampMultiplier(
        p,
        Math.min(prevVal + maxDelta, Math.max(prevVal - maxDelta, randVal)),
        customBounds,
      );
      current[p] = nextVal;
      nextW[p] = nextVal;
    }
    waypoints.push(nextW);
  }

  const segments: ArcSegment[] = [];
  const fraction = 1.0 / (waypointsCount - 1);

  for (let i = 1; i < waypoints.length; i++) {
    segments.push({
      fraction,
      curve: easing,
      targets: { ...waypoints[i] },
    });
  }

  return {
    id: `tour-${seed}`,
    name: 'Waypoint Tour',
    description: `Smooth Waypoint Tour with seed ${seed}`,
    segments,
  };
}

/**
 * 3. Bell Curve Variation Generator
 * "Open, Deepen, Return" preset with randomized durations & depths.
 */
export function generateBellCurveVariation(
  config: BellCurveConfig | undefined,
  seed: string | number,
): Arc {
  const rng = createSeededRng(seed);
  const params: ArcTargetKey[] = config?.params || [
    'rootFreq',
    'coupling',
    'drift',
    'space',
  ];

  const minSettle =
    config?.minSettleFraction !== undefined ? config.minSettleFraction : 0.25;
  const maxSettle =
    config?.maxSettleFraction !== undefined ? config.maxSettleFraction : 0.35;
  const minHold =
    config?.minHoldFraction !== undefined ? config.minHoldFraction : 0.25;
  const maxHold =
    config?.maxHoldFraction !== undefined ? config.maxHoldFraction : 0.35;
  const customParamBounds = config?.paramBounds || {};

  const activeParams = params.filter((p) => DEFAULT_MULTIPLIER_BOUNDS[p]);
  if (activeParams.length === 0) {
    activeParams.push('rootFreq');
  }

  // Roll fractions
  let f1 = minSettle + rng() * (maxSettle - minSettle);
  let f2 = minHold + rng() * (maxHold - minHold);
  if (f1 + f2 >= 0.9) {
    // scale to safe bounds
    const sum = f1 + f2;
    f1 = (f1 / sum) * 0.6;
    f2 = (f2 / sum) * 0.3;
  }
  const f3 = 1.0 - f1 - f2;

  const targetsSettle: Record<string, number> = {};
  const targetsHold: Record<string, number> = {};

  for (const p of activeParams) {
    const bounds = customParamBounds[p] || DEFAULT_MULTIPLIER_BOUNDS[p];
    const range = bounds.max - bounds.min;

    const valSettle = bounds.min + rng() * range;
    // Hold target is close to settle target (+-10% of range)
    const valHold = valSettle + (rng() - 0.5) * 0.2 * range;

    targetsSettle[p] = clampMultiplier(p, valSettle, customParamBounds);
    targetsHold[p] = clampMultiplier(p, valHold, customParamBounds);
  }

  return {
    id: `bell-var-${seed}`,
    name: 'Bell Curve Variation',
    description: `Generative Bell Curve with seed ${seed}`,
    segments: [
      { fraction: f1, curve: 'easeInOut', targets: targetsSettle },
      { fraction: f2, curve: 'linear', targets: targetsHold },
      { fraction: f3, curve: 'easeInOut', targets: 'restoreStart' },
    ],
  };
}

/**
 * 4. Spectral Evolution Generator
 * Coordinated evolution of root, density, and brightness.
 */
export function generateSpectralEvolution(
  config: SpectralConfig | undefined,
  seed: string | number,
): Arc {
  const rng = createSeededRng(seed);
  const rootBounds = config?.rootBounds || { min: 0.6, max: 1.4 };
  const densityBounds = config?.densityBounds || { min: 0.5, max: 2.0 };
  const brightnessBounds = config?.brightnessBounds || { min: 0.3, max: 1.8 };
  const coordinationType = config?.coordinationType || 'inverse-crossover';

  // 3 segments with randomized fractions around 0.33
  const f1 = 0.33 + (rng() - 0.5) * 0.05;
  const f2 = 0.34 + (rng() - 0.5) * 0.05;
  const f3 = 1.0 - f1 - f2;

  const w1: Record<string, number> = {};
  const w2: Record<string, number> = {};
  const w3: Record<string, number> = {};

  if (coordinationType === 'inverse-crossover') {
    // W1: Density rises, Brightness falls, Root falls
    w1.density =
      densityBounds.max - (densityBounds.max - densityBounds.min) * rng() * 0.2;
    w1.brightness =
      brightnessBounds.min +
      (brightnessBounds.max - brightnessBounds.min) * rng() * 0.2;
    w1.rootFreq =
      rootBounds.min + (rootBounds.max - rootBounds.min) * rng() * 0.3;

    // W2: Crossover! Density falls, Brightness rises, Root rises
    w2.density =
      densityBounds.min + (densityBounds.max - densityBounds.min) * rng() * 0.2;
    w2.brightness =
      brightnessBounds.max -
      (brightnessBounds.max - brightnessBounds.min) * rng() * 0.2;
    w2.rootFreq =
      rootBounds.max - (rootBounds.max - rootBounds.min) * rng() * 0.3;

    // W3: Midpoint settling
    w3.density =
      (densityBounds.min + densityBounds.max) / 2 +
      (rng() - 0.5) * 0.1 * (densityBounds.max - densityBounds.min);
    w3.brightness =
      (brightnessBounds.min + brightnessBounds.max) / 2 +
      (rng() - 0.5) * 0.1 * (brightnessBounds.max - brightnessBounds.min);
    w3.rootFreq =
      (rootBounds.min + rootBounds.max) / 2 +
      (rng() - 0.5) * 0.1 * (rootBounds.max - rootBounds.min);
  } else {
    // Parallel Sweep: Density and Brightness sweep high, then sweep low
    w1.density =
      densityBounds.max - (densityBounds.max - densityBounds.min) * rng() * 0.2;
    w1.brightness =
      brightnessBounds.max -
      (brightnessBounds.max - brightnessBounds.min) * rng() * 0.2;
    w1.rootFreq =
      rootBounds.min + (rootBounds.max - rootBounds.min) * rng() * 0.3;

    w2.density =
      densityBounds.min + (densityBounds.max - densityBounds.min) * rng() * 0.2;
    w2.brightness =
      brightnessBounds.min +
      (brightnessBounds.max - brightnessBounds.min) * rng() * 0.2;
    w2.rootFreq =
      rootBounds.max - (rootBounds.max - rootBounds.min) * rng() * 0.3;

    w3.density =
      (densityBounds.min + densityBounds.max) / 2 +
      (rng() - 0.5) * 0.1 * (densityBounds.max - densityBounds.min);
    w3.brightness =
      (brightnessBounds.min + brightnessBounds.max) / 2 +
      (rng() - 0.5) * 0.1 * (brightnessBounds.max - brightnessBounds.min);
    w3.rootFreq =
      (rootBounds.min + rootBounds.max) / 2 +
      (rng() - 0.5) * 0.1 * (rootBounds.max - rootBounds.min);
  }

  // Ensure all values are strictly clamped and rounded for safety
  const clampW = (w: Record<string, number>) => {
    w.density = Math.round(
      Math.min(densityBounds.max, Math.max(densityBounds.min, w.density!)),
    );
    w.brightness = Math.min(
      brightnessBounds.max,
      Math.max(brightnessBounds.min, w.brightness!),
    );
    w.rootFreq = Math.min(
      rootBounds.max,
      Math.max(rootBounds.min, w.rootFreq!),
    );
    return w;
  };

  return {
    id: `spectral-${seed}`,
    name: 'Spectral Evolution',
    description: `Coordinated Spectral Evolution with seed ${seed}`,
    segments: [
      { fraction: f1, curve: 'easeInOut', targets: clampW(w1) },
      { fraction: f2, curve: 'easeInOut', targets: clampW(w2) },
      { fraction: f3, curve: 'easeInOut', targets: clampW(w3) },
    ],
  };
}

/** Top-level generator resolver dispatcher */
export function generateMetaArc(
  kind: string,
  config: MetaArcConfig | undefined,
  seed: string | number,
): Arc {
  switch (kind) {
    case 'random-walk':
      return generateRandomWalk(config?.randomWalk, seed);
    case 'waypoint-tour':
      return generateWaypointTour(config?.waypointTour, seed);
    case 'bell-curve-variation':
      return generateBellCurveVariation(config?.bellCurveVariation, seed);
    case 'spectral-evolution':
      return generateSpectralEvolution(config?.spectralEvolution, seed);
    default:
      throw new Error(`Unknown meta-arc kind: ${kind}`);
  }
}
