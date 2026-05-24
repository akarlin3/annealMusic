import { GrainCloud } from '@/audio/granular/GrainCloud';
import type { GrainParams } from '@/loop/types';

/** Speed of the grain center scan through the buffer (× real time). */
const CENTER_DRIFT_RATE = 0.25;
/** How strongly mean drift widens position jitter when drift-coupled. */
const DRIFT_POS_GAIN = 0.5;
/** The loop freeze always scans from the buffer midpoint. */
const START_CENTER = 0.5;

export interface GranularStartParams extends GrainParams {
  /** When true, mean drift widens position jitter. */
  driftCoupled?: boolean;
}

/**
 * Granular re-synthesis of a captured `AudioBuffer` — the v0.6 loop "freeze"
 * engine. A thin policy wrapper over the reusable {@link GrainCloud}: it adds the
 * loop-pedal specifics the core deliberately omits — a slowly scanning playback
 * center (`centerDriftRate`) and drift-coupled position-jitter widening — while
 * the grain scheduling, windowing and teardown live in the shared core. Behavior
 * is identical to the pre-refactor standalone implementation.
 */
export class GranularPlayer {
  private readonly cloud: GrainCloud;

  private params: GranularStartParams = {
    sizeMs: 120,
    density: 12,
    posJitter: 0.4,
    pitchJitter: 0,
  };
  private meanDrift = 0;
  private running = false;

  constructor(
    ctx: AudioContext,
    private readonly buffer: AudioBuffer,
    output: AudioNode,
    random: () => number = Math.random,
  ) {
    this.cloud = new GrainCloud(ctx, random);
    this.cloud.getOutputNode().connect(output);
  }

  start(params: GranularStartParams): void {
    this.params = { ...params };
    if (this.running) return;
    this.running = true;
    this.cloud.start({
      source: this.buffer,
      sizeMs: this.params.sizeMs,
      density: this.params.density,
      positionJitter: this.effectivePosJitter(),
      pitchJitter: this.params.pitchJitter,
      positionCenter: START_CENTER,
      pitchOffset: 0,
      gain: 1,
      centerDriftRate: CENTER_DRIFT_RATE,
    });
  }

  setParams(params: GranularStartParams): void {
    this.params = { ...params };
    // Note: positionCenter is intentionally omitted so the scanning center set
    // up at start() keeps wandering across live param edits.
    this.cloud.setParams({
      sizeMs: this.params.sizeMs,
      density: this.params.density,
      positionJitter: this.effectivePosJitter(),
      pitchJitter: this.params.pitchJitter,
    });
  }

  /** Mean drift (normalized −1..1), used only when `driftCoupled` is set. */
  setDriftModulation(meanNorm: number): void {
    this.meanDrift = Math.max(-1, Math.min(1, meanNorm));
    if (this.running) {
      this.cloud.setParams({ positionJitter: this.effectivePosJitter() });
    }
  }

  stop(): void {
    this.running = false;
    void this.cloud.stop();
  }

  isRunning(): boolean {
    return this.running;
  }

  private effectivePosJitter(): number {
    const base = this.params.posJitter;
    if (!this.params.driftCoupled) return base;
    return Math.min(1, base + DRIFT_POS_GAIN * Math.abs(this.meanDrift));
  }
}
