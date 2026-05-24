import type { AnnealMusicParams } from '@/state/params';

/** Identifier for a selectable synthesis engine. */
export type EngineId = 'sine' | 'fm' | 'granular';

/**
 * Shared physics + post-fx params, owned by the orchestration layer and passed
 * down to every engine. Identical to the app-wide param set.
 */
export type SharedParams = AnnealMusicParams;

/** Engine-specific params: a flat scalar bag, keyed by the engine's param defs. */
export type EngineParams = Record<string, number>;

/** Declaration of a single engine-specific param (bounds, default, formatting). */
export interface EngineParamDef {
  readonly key: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly default: number;
  readonly fmt: (v: number) => string;
}

export interface AnnealEngineCapabilities {
  /** If true, density (partial count) cannot change while running (structural). */
  readonly densityLockedWhilePlaying: boolean;
  /** Engine-specific param keys, with bounds + defaults. */
  readonly params: readonly EngineParamDef[];
  /**
   * Preferred crossfade window (ms) when the orchestrator swaps *into* this
   * engine. Lets a heavier engine (e.g. granular) ask for a longer fade to mask
   * start-up jitter. Omitted ⇒ the orchestrator's default.
   */
  readonly crossfadeMs?: number;
}

/**
 * The contract every synthesis engine implements. Engines own their voice
 * construction and timbre; the orchestrator owns the audio context, post-fx
 * chain, drift loop, and engine lifecycle/crossfade.
 */
export interface AnnealEngine {
  readonly id: EngineId;
  readonly capabilities: AnnealEngineCapabilities;

  /** Build internal nodes and start sources. Calling twice without stop throws. */
  start(ctx: AudioContext, shared: SharedParams, engine: EngineParams): void;

  /**
   * Ramp this engine's own output to zero over `fadeSeconds` (a short
   * click-avoidance ramp; the audible crossfade/settle fade is the
   * orchestrator's), then stop sources and dispose. Resolves when stopped.
   */
  stop(fadeSeconds?: number): Promise<void>;

  /** Single node the orchestrator routes into the shared post-fx chain. */
  getOutputNode(): AudioNode;

  /** Smoothly update shared params relevant to voice frequencies (root, spread). */
  setSharedParams(partial: Partial<SharedParams>): void;

  /** Update engine-specific params (e.g. FM ratio, index). */
  setEngineParams(partial: Partial<EngineParams>): void;

  /** Push a detune offset (cents) to partial `index`, called by the drift loop. */
  setPartialDetune(index: number, cents: number): void;

  /** Number of currently active partials (the drift loop needs this). */
  getPartialCount(): number;

  /** Per-partial fundamental frequencies (Hz) — drives the visualizer overlay. */
  getPartialFrequencies(): number[];
}

/** Build the default engine-param bag for a set of param defs. */
export function defaultsFromParamDefs(
  defs: readonly EngineParamDef[],
): EngineParams {
  const out: EngineParams = {};
  for (const def of defs) out[def.key] = def.default;
  return out;
}
