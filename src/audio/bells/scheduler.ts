/* eslint-disable @typescript-eslint/no-explicit-any */
import { BellLoader } from './loader';

export interface ResolvedBellTrigger {
  offsetMs: number;
  bellId: string;
  volume: number;
}

export class BellScheduler {
  private ctx: AudioContext;
  private destination: AudioNode;
  private triggers: ResolvedBellTrigger[] = [];
  private startTime = 0; // AudioContext.currentTime when start() was called
  private elapsedAtStart = 0; // session playhead position in ms when started
  private scheduledSet = new Set<string>(); // tracks scheduled timestamps to prevent duplicate schedules
  private timer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private activeSources = new Set<AudioBufferSourceNode>();
  private activeGains = new Set<GainNode>();

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;
  }

  /** Sets the resolved triggers sorted by offset time. */
  setTriggers(triggers: ResolvedBellTrigger[]): void {
    this.triggers = [...triggers].sort((a, b) => a.offsetMs - b.offsetMs);
  }

  /** Returns currently loaded triggers. */
  getTriggers(): ResolvedBellTrigger[] {
    return this.triggers;
  }

  /** Starts the scheduler clock loop. */
  start(elapsedMs: number): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = this.ctx.currentTime;
    this.elapsedAtStart = elapsedMs;
    this.scheduledSet.clear();

    // Check look-ahead window every 100ms
    this.timer = setInterval(() => this.tick(), 100);
    this.tick(); // Run immediate first pass
  }

  /** Stops the scheduler clock loop. */
  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    for (const src of this.activeSources) {
      try {
        src.stop();
      } catch {
        /* ignore */
      }
      try {
        src.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.activeSources.clear();
    for (const gain of this.activeGains) {
      try {
        gain.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.activeGains.clear();
  }

  private tick(): void {
    if (!this.isRunning) return;

    const lookAheadMs = 300; // 300ms look-ahead window
    const elapsedSessionMs =
      this.elapsedAtStart + (this.ctx.currentTime - this.startTime) * 1000;

    for (const t of this.triggers) {
      // Skip if event is already in the past
      if (t.offsetMs < elapsedSessionMs - 50) continue;

      // Stop scanning if event is beyond the look-ahead window
      if (t.offsetMs > elapsedSessionMs + lookAheadMs) break;

      const key = `${t.bellId}-${t.offsetMs}`;
      if (this.scheduledSet.has(key)) continue;

      this.scheduledSet.add(key);
      void this.scheduleBell(t);
    }
  }

  private async scheduleBell(t: ResolvedBellTrigger): Promise<void> {
    try {
      const buffer = await BellLoader.loadBell(this.ctx, t.bellId);
      if (!this.isRunning) return; // stopped during fetch/decode

      const delaySec = (t.offsetMs - this.elapsedAtStart) / 1000;
      const targetTime = this.startTime + delaySec;

      // If due time is already in the past, play immediately
      if (targetTime < this.ctx.currentTime) {
        this.playNow(buffer, t.volume);
      } else {
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(t.volume, targetTime);

        source.connect(gainNode).connect(this.destination);
        this.activeSources.add(source);
        this.activeGains.add(gainNode);
        source.onended = () => {
          this.activeSources.delete(source);
          this.activeGains.delete(gainNode);
          try {
            source.disconnect();
            gainNode.disconnect();
          } catch {
            /* ignore */
          }
        };
        source.start(targetTime);
      }
    } catch (err) {
      console.error(
        `[BellScheduler] Failed to schedule bell ${t.bellId}:`,
        err,
      );
    }
  }

  private playNow(buffer: AudioBuffer, volume: number): void {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.005);

    source.connect(gainNode).connect(this.destination);
    this.activeSources.add(source);
    this.activeGains.add(gainNode);
    source.onended = () => {
      this.activeSources.delete(source);
      this.activeGains.delete(gainNode);
      try {
        source.disconnect();
        gainNode.disconnect();
      } catch {
        /* ignore */
      }
    };
    source.start(this.ctx.currentTime);
  }
}

/** Standalone preview triggers. Bypasses the scheduler loops. */
export async function playBellPreview(
  ctx: BaseAudioContext,
  destination: AudioNode,
  id: string,
  volume = 0.7,
): Promise<void> {
  const buffer = await BellLoader.loadBell(ctx, id);
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(volume, ctx.currentTime);

  source.connect(gainNode).connect(destination);
  source.start(ctx.currentTime);
}

export interface BellEvent {
  bellId: string;
  trigger:
    | 'at-start'
    | 'at-end'
    | 'at-time'
    | 'every'
    | 'at-movement-start'
    | 'at-movement-end';
  offsetMs?: number; // Used for 'at-start', 'at-end', 'at-time'
  intervalMin?: number; // Used for 'every'
  movementIndex?: number; // Used for 'at-movement-start', 'at-movement-end'
  volume: number; // 0..1, default 0.7
}

/**
 * Resolves a complex bell schedule into flat absolute triggers relative to the session start.
 * @param schedule Array of bell events.
 * @param totalDurationMs Total session duration in milliseconds.
 * @param segmentDurations Optional array of individual segment durations in ms (used for movement boundaries).
 * @param movements Optional array of movements in the piece.
 */
export function resolveBellSchedule(
  schedule: BellEvent[],
  totalDurationMs: number,
  segmentDurations: number[] = [],
  movements: any[] = [],
): ResolvedBellTrigger[] {
  const triggers: ResolvedBellTrigger[] = [];

  for (const event of schedule) {
    const vol = event.volume !== undefined ? event.volume : 0.7;
    const offset = event.offsetMs !== undefined ? event.offsetMs : 0;

    switch (event.trigger) {
      case 'at-start': {
        const triggerTime = offset;
        if (triggerTime >= 0 && triggerTime <= totalDurationMs) {
          triggers.push({
            offsetMs: triggerTime,
            bellId: event.bellId,
            volume: vol,
          });
        }
        break;
      }
      case 'at-end': {
        const triggerTime = totalDurationMs - offset;
        if (triggerTime >= 0 && triggerTime <= totalDurationMs) {
          triggers.push({
            offsetMs: triggerTime,
            bellId: event.bellId,
            volume: vol,
          });
        }
        break;
      }
      case 'at-time': {
        if (offset >= 0 && offset <= totalDurationMs) {
          triggers.push({
            offsetMs: offset,
            bellId: event.bellId,
            volume: vol,
          });
        }
        break;
      }
      case 'every': {
        const intervalMs = (event.intervalMin || 1) * 60 * 1000;
        let triggerTime = intervalMs;
        while (triggerTime < totalDurationMs) {
          triggers.push({
            offsetMs: triggerTime,
            bellId: event.bellId,
            volume: vol,
          });
          triggerTime += intervalMs;
        }
        break;
      }
      case 'at-movement-start': {
        if (
          event.movementIndex !== undefined &&
          movements[event.movementIndex] !== undefined
        ) {
          const mov = movements[event.movementIndex];
          const startSeg = mov.startSegmentIndex ?? 0;
          let triggerTime = 0;
          for (let s = 0; s < startSeg && s < segmentDurations.length; s++) {
            triggerTime += segmentDurations[s] ?? 0;
          }
          triggerTime += offset;
          if (triggerTime >= 0 && triggerTime <= totalDurationMs) {
            triggers.push({
              offsetMs: triggerTime,
              bellId: event.bellId,
              volume: vol,
            });
          }
        }
        break;
      }
      case 'at-movement-end': {
        if (
          event.movementIndex !== undefined &&
          movements[event.movementIndex] !== undefined
        ) {
          const mov = movements[event.movementIndex];
          const endSeg =
            mov.endSegmentIndex !== undefined ? mov.endSegmentIndex : 0;
          let triggerTime = 0;
          for (let s = 0; s <= endSeg && s < segmentDurations.length; s++) {
            triggerTime += segmentDurations[s] ?? 0;
          }
          triggerTime -= offset;
          if (triggerTime >= 0 && triggerTime <= totalDurationMs) {
            triggers.push({
              offsetMs: triggerTime,
              bellId: event.bellId,
              volume: vol,
            });
          }
        }
        break;
      }
    }
  }

  // Deduplicate triggers at exactly the same time for the same bell
  const seen = new Set<string>();
  const deduped: ResolvedBellTrigger[] = [];
  for (const t of triggers) {
    const key = `${t.bellId}-${Math.round(t.offsetMs / 10) * 10}`; // 10ms tolerance
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(t);
    }
  }

  return deduped.sort((a, b) => a.offsetMs - b.offsetMs);
}
