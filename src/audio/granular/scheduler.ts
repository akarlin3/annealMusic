/**
 * A look-ahead scheduler for sample-accurate audio events. A `setInterval`
 * ticker wakes us every `tickMs`; on each wake we schedule every event whose
 * time falls inside the look-ahead window. The *audio events themselves* are
 * placed with `AudioContext.currentTime`-based timestamps (`source.start(when)`)
 * — the timer only governs how far ahead we plan, never the actual audio timing.
 * (Chris Wilson, "A Tale of Two Clocks".)
 */

export interface SchedulerClock {
  readonly currentTime: number;
}

export const DEFAULT_LOOKAHEAD_SEC = 0.1;
export const DEFAULT_TICK_MS = 25;

export class LookaheadScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;

  /**
   * @param clock      Source of `currentTime` (the AudioContext).
   * @param onTick     Called each wake with the absolute time up to which events
   *                   should be scheduled (`currentTime + lookAhead`).
   * @param lookAhead  How far ahead to schedule, in seconds.
   * @param tickMs     Timer wake interval, in milliseconds.
   */
  constructor(
    private readonly clock: SchedulerClock,
    private readonly onTick: (scheduleUntil: number) => void,
    private readonly lookAhead = DEFAULT_LOOKAHEAD_SEC,
    private readonly tickMs = DEFAULT_TICK_MS,
  ) {}

  start(): void {
    if (this.timer !== null) return;
    this.pump();
    this.timer = setInterval(() => this.pump(), this.tickMs);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  private pump(): void {
    this.onTick(this.clock.currentTime + this.lookAhead);
  }
}
