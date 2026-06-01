import { LookaheadScheduler } from '@/audio/granular/scheduler';
import { hannWindow } from '@/audio/granular/windows';

const HANN_SAMPLES = 256;
const GRAIN_TAIL_SEC = 0.02;

/**
 * Parameters for a single grain cloud. `sizeMs`, `density`, `positionJitter`,
 * `pitchJitter` and `positionCenter` are the sculptable texture; `pitchOffset`
 * (cents) is the cloud's constant transposition (a partial's pitch); `gain` is
 * its linear output level. `centerDriftRate` is an optional per-grain scan of the
 * cluster center through the source (0 = static) — used by the v0.6 loop freeze
 * to reproduce its wandering playback head; the v0.9 engine leaves it 0 and moves
 * `positionCenter` itself.
 */
export interface GrainCloudParams {
  source: AudioBuffer;
  sizeMs: number;
  density: number;
  positionJitter: number;
  pitchJitter: number;
  positionCenter: number;
  pitchOffset: number;
  gain: number;
  centerDriftRate?: number;
  /** Soft ceiling on simultaneous live grains; excess grains are skipped. */
  maxGrains?: number;
}

/**
 * The reusable granular core. Continuously triggers short Hann-windowed grains
 * read from a source `AudioBuffer`, clustered (with jitter) around a normalized
 * `positionCenter`, at `pitchOffset` cents (plus per-grain `pitchJitter`). Grains
 * are scheduled sample-accurately against `AudioContext.currentTime` via a
 * look-ahead loop; the Hann window comes from `windows.ts` (never redefined). The
 * cloud is policy-free: it does not know about loop drift-coupling or how the
 * center moves — consumers drive `positionCenter`/`positionJitter` via `setParams`
 * (see `GranularPlayer` for the v0.6 freeze policy, `GranularEngine` for v0.9).
 *
 * Used by:
 *   - v0.6 `LoopSlot.freeze()` (one cloud per frozen slot, via `GranularPlayer`)
 *   - v0.9 `GranularEngine` (one cloud per partial)
 */
export class GrainCloud {
  private readonly scheduler: LookaheadScheduler;
  private readonly hann = hannWindow(HANN_SAMPLES);
  private readonly grains = new Set<AudioBufferSourceNode>();
  private readonly out: GainNode;

  private params: GrainCloudParams | null = null;
  /** Absolute cluster center, in seconds, for the active source. */
  private centerSec = 0;
  private nextGrainTime = 0;
  private running = false;

  constructor(
    private readonly ctx: AudioContext,
    private readonly random: () => number = Math.random,
  ) {
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(1, this.ctx.currentTime);
    this.scheduler = new LookaheadScheduler(ctx, (until) => this.pump(until));
  }

  start(params: GrainCloudParams): void {
    this.params = { ...params };
    this.centerSec = params.positionCenter * params.source.duration;
    this.out.gain.setTargetAtTime(params.gain, this.ctx.currentTime, 0.015);
    if (this.running) return;
    this.running = true;
    this.nextGrainTime = this.ctx.currentTime + 0.02;
    this.scheduler.start();
  }

  /**
   * Update params; applies on the *next* scheduled grain (never retroactively).
   * Supplying `positionCenter` re-seats the cluster center; omitting it preserves
   * the current (possibly auto-scanned) center. `gain` ramps smoothly.
   */
  setParams(partial: Partial<GrainCloudParams>): void {
    if (!this.params) {
      return;
    }
    this.params = { ...this.params, ...partial };
    if (partial.positionCenter !== undefined) {
      this.centerSec = partial.positionCenter * this.params.source.duration;
    }
    if (partial.gain !== undefined) {
      this.out.gain.setTargetAtTime(partial.gain, this.ctx.currentTime, 0.05);
    }
  }

  /** Set the cloud's constant transposition (cents). Applies on the next grain. */
  setPitchOffset(cents: number): void {
    if (this.params) this.params.pitchOffset = cents;
  }

  /**
   * Stop scheduling and silence the cloud. With `fadeSeconds > 0` the output is
   * ramped to zero first (click-free), then live grains are torn down; with 0 it
   * stops immediately (the v0.6 freeze behavior).
   */
  stop(fadeSeconds = 0): Promise<void> {
    this.running = false;
    this.scheduler.stop();

    const teardown = (): void => {
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
    };

    if (fadeSeconds <= 0) {
      teardown();
      return Promise.resolve();
    }

    try {
      this.out.gain.cancelScheduledValues(this.ctx.currentTime);
      this.out.gain.setTargetAtTime(0, this.ctx.currentTime, fadeSeconds / 3);
    } catch {
      // node may be mid-teardown; ignore
    }
    return new Promise((resolve) => {
      setTimeout(
        () => {
          teardown();
          resolve();
        },
        Math.ceil(fadeSeconds * 1000),
      );
    });
  }

  getOutputNode(): AudioNode {
    return this.out;
  }

  isRunning(): boolean {
    return this.running;
  }

  private pump(until: number): void {
    const p = this.params;
    if (!p) return;
    const duration = p.source.duration;
    const driftRate = p.centerDriftRate ?? 0;
    while (this.running && this.nextGrainTime < until) {
      this.scheduleGrain(this.nextGrainTime);
      const interval = 1 / p.density;
      if (driftRate !== 0) {
        this.centerSec = (this.centerSec + interval * driftRate) % duration;
      }
      this.nextGrainTime += interval;
    }
  }

  private scheduleGrain(when: number): void {
    const p = this.params;
    if (!p) return;
    // Soft ceiling: under extreme settings, skip rather than glitch/overrun.
    if (p.maxGrains !== undefined && this.grains.size >= p.maxGrains) return;
    const duration = p.source.duration;
    const grainDur = Math.min(p.sizeMs / 1000, duration * 0.9);

    const jitter = (this.random() * 2 - 1) * p.positionJitter;
    let offset = this.centerSec + jitter * duration;
    offset = Math.max(0, Math.min(duration - grainDur, offset));

    const startTime = Math.max(when, this.ctx.currentTime);

    const src = this.ctx.createBufferSource();
    src.buffer = p.source;
    if (p.pitchOffset !== 0 || p.pitchJitter > 0) {
      const jit =
        p.pitchJitter > 0 ? (this.random() * 2 - 1) * p.pitchJitter : 0;
      src.detune.setValueAtTime(p.pitchOffset + jit, startTime);
    }

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    src.connect(gain).connect(this.out);

    gain.gain.setValueCurveAtTime(this.hann, startTime, grainDur);

    src.start(startTime, offset, grainDur);
    src.stop(startTime + grainDur + GRAIN_TAIL_SEC);
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
