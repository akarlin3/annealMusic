/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AnnealMusicParams } from '@/state/params';
import type { TuningRef } from '@/audio/tuning/types';

/** Identifier for a selectable synthesis engine. */
export type EngineId =
  | 'sine'
  | 'fm'
  | 'granular'
  | 'physical'
  | 'pulse'
  | 'chimera';

/**
 * Shared physics + post-fx params, owned by the orchestration layer and passed
 * down to every engine. Identical to the app-wide param set.
 */
export type SharedParams = AnnealMusicParams & {
  tuning?: TuningRef;
  customScaleRatios?: number[];
  customEqRatio?: number;
  /**
   * Synchronization-driven spectral fusion amount, 0..1. Couples the Kuramoto
   * order parameter to *timbre*: as the partials synchronize, their amplitudes
   * are reshaped by per-partial coherence so the spectrum fuses (see
   * `audio/fusion.ts`). 0 (the default) is fully bypassed and behavior-
   * preserving — every partial keeps its base gain.
   */
  fusion?: number;
  /**
   * Structured-sync clustering bias, −1..1. Feeds a heterogeneous per-partial
   * coupling profile into the Kuramoto step so one frequency band locks while
   * the other stays incoherent — making the *existing* spectral fusion shift the
   * spectral centroid (spectral redistribution). `> 0` locks the high band
   * (centroid rises), `< 0` locks the low band (centroid falls). 0 (the default)
   * is homogeneous coupling — fully bypassed and bit-identical to the prior
   * behavior. Has audible effect only when `fusion > 0`.
   */
  cluster?: number;
  /**
   * Chimera-voice **intensity**, 0..1 — the basin↔morph trade-off control for
   * the identical-ω chimera engine. Maps to the two-population coupling
   * disparity `A = 0.5 − 0.3·intensity`: low intensity → A ≈ 0.5 (wide, stable
   * basin, gentle breath), high intensity → A ≈ 0.2 (bigger, faster morph that
   * needs more supervision). Only the `chimera` engine reads it; other engines
   * ignore it entirely. Default (when unset) is a gentle ≈0.2 (see
   * `audio/chimera.ts` `intensityToA` and `audio/chimeraVoice.ts`).
   */
  chimeraIntensity?: number;
  /** High-resolution floating point pitch bend value (-1.0 to 1.0) */
  pitchBend?: number;
};

/** Engine-specific params: a flat scalar bag, keyed by the engine's param defs. */
export type EngineParams = Record<string, number | string>;

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
  setSharedParams(
    partial: Partial<SharedParams>,
    targetTime?: number,
    instant?: boolean,
  ): void;

  /** Update engine-specific params (e.g. FM ratio, index). */
  setEngineParams(partial: Partial<EngineParams>): void;

  /** Push a detune offset (cents) to partial `index`, called by the drift loop. */
  setPartialDetune(index: number, cents: number): void;

  /**
   * [Optional] Apply per-partial fusion gain multipliers, called by the drift
   * loop. `multipliers[i]` scales partial `i`'s amplitude (1 = unchanged). The
   * scalars are produced by the single fusion core (`audio/fusion.ts`) on the
   * main thread; engines only *apply* them (worklets via a thin port message),
   * so the math is never duplicated. Engines that don't support per-partial
   * gain omit this.
   */
  setPartialFusionGains?(multipliers: readonly number[]): void;

  /** Number of currently active partials (the drift loop needs this). */
  getPartialCount(): number;

  /** Per-partial fundamental frequencies (Hz) — drives the visualizer overlay. */
  getPartialFrequencies(): number[];

  /**
   * Register a sink for *asynchronous* engine errors that surface after `start`
   * returns (e.g. a worklet module that fails to load). Synchronous start
   * failures throw from `start`; this is only for the deferred path. Optional —
   * engines with no async failure mode omit it.
   */
  setErrorHandler?(fn: (error: Error) => void): void;

  /** [Optional] Expose individual partial output nodes for stem capture. */
  getPartialOutputs?(): AudioNode[];
}

export interface StemExportableEngine {
  getPartialOutputs(): AudioNode[];
}

export interface AssetLoadableEngine {
  setErrorHandler(fn: (error: Error) => void): void;
}

export interface DynamicModulatableEngine {
  setPartialDetune(index: number, cents: number): void;
  getPartialCount(): number;
  getPartialFrequencies(): number[];
}

export function isStemExportable(engine: any): engine is StemExportableEngine {
  return engine && typeof engine.getPartialOutputs === 'function';
}

export function isAssetLoadable(engine: any): engine is AssetLoadableEngine {
  return engine && typeof engine.setErrorHandler === 'function';
}

export function isDynamicModulatable(
  engine: any,
): engine is DynamicModulatableEngine {
  return (
    engine &&
    typeof engine.setPartialDetune === 'function' &&
    typeof engine.getPartialCount === 'function' &&
    typeof engine.getPartialFrequencies === 'function'
  );
}

/** Build the default engine-param bag for a set of param defs. */
export function defaultsFromParamDefs(
  defs: readonly EngineParamDef[],
): EngineParams {
  const out: EngineParams = {};
  for (const def of defs) out[def.key] = def.default;
  return out;
}
