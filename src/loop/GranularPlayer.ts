import { LookaheadScheduler } from '@/loop/scheduler';
import { hannWindow } from '@/loop/windows';
import type { GrainParams } from '@/loop/types';

const HANN_SAMPLES = 256;
/** Speed of the grain center scan through the buffer (× real time). */
const CENTER_DRIFT_RATE = 0.25;
/** How strongly mean drift widens position jitter when drift-coupled. */
const DRIFT_POS_GAIN = 0.5;
const GRAIN_TAIL_SEC = 0.02;

export interface GranularStartParams extends GrainParams {
  /** When true, mean drift widens position jitter. */
  driftCoupled?: boolean;
}

/**
 * Granular re-synthesis from a captured `AudioBuffer` — the "freeze" engine.
 * Continuously triggers short Hann-windowed grains from positions that wander
 * (with jitter) around a slowly scanning center, turning a finite capture into
 * an endless drone of itself. Grains are scheduled sample-accurately against
 * `AudioContext.currentTime` via a look-ahead loop. The Hann window comes from
 * `windows.ts` (never redefined here).
 */
export class GranularPlayer {
  private readonly scheduler: LookaheadScheduler;
  private readonly hann = hannWindow(HANN_SAMPLES);
  private readonly grains = new Set<AudioBufferSourceNode>();
  private readonly duration: number;

  private params: GranularStartParams = {
    sizeMs: 120,
    density: 12,
    posJitter: 0.4,
    pitchJitter: 0,
  };
  private center = 0;
  private nextGrainTime = 0;
  private meanDrift = 0;
  private running = false;

  constructor(
    private readonly ctx: AudioContext,
    private readonly buffer: AudioBuffer,
    private readonly output: AudioNode,
    private readonly random: () => number = Math.random,
  ) {
    this.duration = buffer.duration;
    this.center = this.duration * 0.5;
    this.scheduler = new LookaheadScheduler(ctx, (until) => this.pump(until));
  }

  start(params: GranularStartParams): void {
    this.params = { ...params };
    if (this.running) return;
    this.running = true;
    this.nextGrainTime = this.ctx.currentTime + 0.02;
    this.scheduler.start();
  }

  setParams(params: GranularStartParams): void {
    this.params = { ...params };
  }

  /** Mean drift (normalized −1..1), used only when `driftCoupled` is set. */
  setDriftModulation(meanNorm: number): void {
    this.meanDrift = Math.max(-1, Math.min(1, meanNorm));
  }

  stop(): void {
    this.running = false;
    this.scheduler.stop();
    const t = this.ctx.currentTime;
    for (const g of this.grains) {
      try {
        g.stop(t);
      } catch {
        // already stopped
      }
      try {
        g.disconnect();
      } catch {
        // already detached
      }
    }
    this.grains.clear();
  }

  isRunning(): boolean {
    return this.running;
  }

  private effectivePosJitter(): number {
    const base = this.params.posJitter;
    if (!this.params.driftCoupled) return base;
    return Math.min(1, base + DRIFT_POS_GAIN * Math.abs(this.meanDrift));
  }

  private pump(until: number): void {
    while (this.running && this.nextGrainTime < until) {
      this.scheduleGrain(this.nextGrainTime);
      const interval = 1 / this.params.density;
      this.center =
        (this.center + interval * CENTER_DRIFT_RATE) % this.duration;
      this.nextGrainTime += interval;
    }
  }

  private scheduleGrain(when: number): void {
    const grainDur = Math.min(this.params.sizeMs / 1000, this.duration * 0.9);
    const jitter = (this.random() * 2 - 1) * this.effectivePosJitter();
    let offset = this.center + jitter * this.duration;
    offset = Math.max(0, Math.min(this.duration - grainDur, offset));

    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    if (this.params.pitchJitter > 0) {
      src.detune.value = (this.random() * 2 - 1) * this.params.pitchJitter;
    }
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain).connect(this.output);

    const start = Math.max(when, this.ctx.currentTime);
    gain.gain.setValueCurveAtTime(this.hann, start, grainDur);

    src.start(start, offset, grainDur);
    src.stop(start + grainDur + GRAIN_TAIL_SEC);
    this.grains.add(src);
    src.onended = (): void => {
      this.grains.delete(src);
      try {
        src.disconnect();
        gain.disconnect();
      } catch {
        // already detached
      }
    };
  }
}
