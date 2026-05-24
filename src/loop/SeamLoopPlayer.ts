import { LookaheadScheduler } from '@/audio/granular/scheduler';
import { equalPowerFadeIn, equalPowerFadeOut } from '@/audio/granular/windows';

/** Longest seam crossfade, in seconds. */
export const MAX_XFADE_SEC = 0.12;
/** Crossfade as a fraction of buffer length (so short loops don't over-fade). */
export const XFADE_FRACTION = 0.15;
const CURVE_SAMPLES = 256;
const START_DELAY_SEC = 0.04;

/** Equal-power crossfade length for a buffer of `duration` seconds. */
export function xfadeFor(duration: number): number {
  return Math.min(MAX_XFADE_SEC, duration * XFADE_FRACTION);
}

/**
 * Seamless looping playback of an `AudioBuffer`. Rather than relying on
 * `AudioBufferSourceNode.loop` (which clicks at the seam), this overlaps
 * successive whole-buffer voices by an equal-power crossfade: each voice fades
 * in over `xfade`, holds, and fades out over its final `xfade`; the next voice
 * starts `duration − xfade` later so its fade-in sums with the previous voice's
 * fade-out to constant power. Playback rate is always 1.0 (no pitch in v0.6).
 */
export class SeamLoopPlayer {
  private readonly scheduler: LookaheadScheduler;
  private readonly fadeIn = equalPowerFadeIn(CURVE_SAMPLES);
  private readonly fadeOut = equalPowerFadeOut(CURVE_SAMPLES);
  private readonly voices = new Set<AudioBufferSourceNode>();
  private nextStart = 0;
  private running = false;

  private readonly duration: number;
  private readonly xfade: number;
  private readonly period: number;

  constructor(
    private readonly ctx: AudioContext,
    private readonly buffer: AudioBuffer,
    private readonly output: AudioNode,
  ) {
    this.duration = buffer.duration;
    this.xfade = xfadeFor(this.duration);
    this.period = Math.max(this.duration - this.xfade, this.duration * 0.5);
    this.scheduler = new LookaheadScheduler(ctx, (until) => this.pump(until));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.nextStart = this.ctx.currentTime + START_DELAY_SEC;
    this.scheduler.start();
  }

  stop(): void {
    this.running = false;
    this.scheduler.stop();
    const t = this.ctx.currentTime;
    for (const v of this.voices) {
      try {
        v.stop(t);
      } catch {
        // already stopped
      }
      try {
        v.disconnect();
      } catch {
        // already detached
      }
    }
    this.voices.clear();
  }

  /** The seam crossfade length actually in use (seconds). Exposed for tests. */
  getXfade(): number {
    return this.xfade;
  }

  private pump(until: number): void {
    while (this.running && this.nextStart < until) {
      this.scheduleVoice(this.nextStart);
      this.nextStart += this.period;
    }
  }

  private scheduleVoice(when: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain).connect(this.output);

    const start = Math.max(when, this.ctx.currentTime);
    gain.gain.setValueCurveAtTime(this.fadeIn, start, this.xfade);
    gain.gain.setValueCurveAtTime(
      this.fadeOut,
      start + this.duration - this.xfade,
      this.xfade,
    );

    src.start(start);
    src.stop(start + this.duration);
    this.voices.add(src);
    src.onended = (): void => {
      this.voices.delete(src);
      try {
        src.disconnect();
        gain.disconnect();
      } catch {
        // already detached
      }
    };
  }
}
