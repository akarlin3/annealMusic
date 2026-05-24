/**
 * Single home for reading a normalized RMS (0..1) from an analyser's
 * time-domain data — used by the level meter, the visualizer input ring, and
 * the feedback guard so they all agree on "how loud is the input right now."
 */
export function readRms(analyser: AnalyserNode): number {
  const buf = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = ((buf[i] ?? 128) - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buf.length);
}

/**
 * Trips when the monitored input RMS stays above `threshold` for `needed`
 * consecutive samples — a sustained-loudness test for runaway feedback, so a
 * single loud strum doesn't trip it. Stateful + pure (no timers): the caller
 * pushes one sample per tick.
 */
export class FeedbackDetector {
  private overCount = 0;

  constructor(
    private readonly threshold = 0.9,
    private readonly needed = 20,
  ) {}

  push(rms: number): boolean {
    if (rms <= this.threshold) {
      this.overCount = 0;
      return false;
    }
    this.overCount += 1;
    if (this.overCount >= this.needed) {
      this.overCount = 0;
      return true;
    }
    return false;
  }

  reset(): void {
    this.overCount = 0;
  }
}
