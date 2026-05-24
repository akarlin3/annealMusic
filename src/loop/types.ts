/** The three loop slots available in v0.6. */
export type SlotId = 'A' | 'B' | 'C';

export const SLOT_IDS: readonly SlotId[] = ['A', 'B', 'C'];

/**
 * Lifecycle states for a single loop slot. `empty` has no buffer; `armed` is
 * waiting to capture; `capturing` is recording; `playing` loops the buffer with
 * a seam crossfade; `frozen` re-synthesizes the buffer granularly; `muted`
 * keeps the buffer but silences the slot (remembering whether it was frozen).
 */
export type SlotState =
  | 'empty'
  | 'armed'
  | 'capturing'
  | 'playing'
  | 'frozen'
  | 'muted';

/** Per-frozen-slot granular re-synthesis parameters. */
export interface GrainParams {
  /** Grain length in milliseconds (30–300). */
  sizeMs: number;
  /** Grains per second (4–40). */
  density: number;
  /** How far grain start wanders from the moving center (0–1). */
  posJitter: number;
  /** Per-grain pitch randomization in cents (0–100; 0 = pitch-stable). */
  pitchJitter: number;
}

/**
 * URL-encodable loop slot config. Does NOT include the captured buffer — only
 * the parameters that survive a share link. `driftCoupled` ties grain wander to
 * the orchestrator's mean drift when frozen.
 */
export interface SlotConfig {
  muted: boolean;
  frozen: boolean;
  driftCoupled: boolean;
  grain: GrainParams;
}

export type LoopConfigMap = Record<SlotId, SlotConfig>;

export const GRAIN_BOUNDS = {
  sizeMs: { min: 30, max: 300 },
  density: { min: 4, max: 40 },
  posJitter: { min: 0, max: 1 },
  pitchJitter: { min: 0, max: 100 },
} as const;

export const DEFAULT_GRAIN: GrainParams = {
  sizeMs: 120,
  density: 12,
  posJitter: 0.4,
  pitchJitter: 0,
};

export const DEFAULT_SLOT_CONFIG: SlotConfig = {
  muted: false,
  frozen: false,
  driftCoupled: false,
  grain: { ...DEFAULT_GRAIN },
};

export function makeDefaultLoopConfig(): LoopConfigMap {
  return {
    A: { ...DEFAULT_SLOT_CONFIG, grain: { ...DEFAULT_GRAIN } },
    B: { ...DEFAULT_SLOT_CONFIG, grain: { ...DEFAULT_GRAIN } },
    C: { ...DEFAULT_SLOT_CONFIG, grain: { ...DEFAULT_GRAIN } },
  };
}

/** Hard cap on capture length — bounds memory (~23 MB/slot stereo @ 48 kHz). */
export const MAX_CAPTURE_SEC = 60;
/** Captures shorter than this are discarded on stop (likely a misfire). */
export const MIN_CAPTURE_SEC = 0.25;
/** RMS above which an armed slot auto-starts capturing. */
export const CAPTURE_TRIGGER_RMS = 0.02;

export function clampGrainParam<K extends keyof GrainParams>(
  key: K,
  value: number,
): number {
  const b = GRAIN_BOUNDS[key];
  return Math.min(b.max, Math.max(b.min, value));
}

export function clampGrain(grain: GrainParams): GrainParams {
  return {
    sizeMs: clampGrainParam('sizeMs', grain.sizeMs),
    density: clampGrainParam('density', grain.density),
    posJitter: clampGrainParam('posJitter', grain.posJitter),
    pitchJitter: clampGrainParam('pitchJitter', grain.pitchJitter),
  };
}
