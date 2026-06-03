import type { Piece, PieceSegment } from '@/piece/types';
import { PiecePlayer } from '@/piece/PiecePlayer';
import type { Orchestrator } from '@/audio/orchestrator';
import {
  BellEvent,
  BellScheduler,
  resolveBellSchedule,
} from '@/audio/bells/scheduler';

export interface ListeningSessionConfig {
  piece: Piece;
  settleInMs: number;
  integrationMs: number;
  bellSchedule: BellEvent[];
}

export type ListeningSessionState = 'idle' | 'sounding' | 'ended';

export class ListeningSessionPlayer {
  private config: ListeningSessionConfig;
  private orchestrator: Orchestrator;
  private piecePlayer: PiecePlayer;

  private isPlaying = false;
  private sessionState: ListeningSessionState = 'idle';

  private elapsedMs = 0;
  private totalDurationMs = 0;
  private pieceDurationMs = 0;

  private lastTickTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private bellScheduler: BellScheduler | null = null;

  private onProgressCallback:
    | ((progress: number, remainingMs: number) => void)
    | null = null;
  private onEndedCallback: (() => void) | null = null;

  constructor(config: ListeningSessionConfig, orchestrator: Orchestrator) {
    this.config = config;
    this.orchestrator = orchestrator;
    this.piecePlayer = new PiecePlayer(config.piece, orchestrator);
    this.pieceDurationMs = this.calculatePieceDuration();
    this.totalDurationMs = this.calculateTotalDuration();
  }

  private getPieceSegmentDuration(seg: PieceSegment): number {
    const raw = seg.durationMs ?? 5000;
    if (
      seg.config?.tempoLocked &&
      this.config.piece.tempoBpm !== null &&
      this.config.piece.tempoBpm > 0
    ) {
      return raw * 4 * (60 / this.config.piece.tempoBpm);
    }
    return raw;
  }

  private calculatePieceDuration(): number {
    let total = 0;
    for (const seg of this.config.piece.segments) {
      total += this.getPieceSegmentDuration(seg);
    }
    return total;
  }

  private calculateTotalDuration(): number {
    // Bells layer concurrently on top of playback, so total session duration is exactly the piece's duration
    return this.pieceDurationMs;
  }

  start(
    onProgress?: (progress: number, remainingMs: number) => void,
    onEnded?: () => void,
  ): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.onProgressCallback = onProgress || null;
    this.onEndedCallback = onEnded || null;
    this.lastTickTime = performance.now();

    // Start orchestrator so Web Audio context exists for chimes / engine
    this.orchestrator.start();

    // Resolve & initialize BellScheduler
    const tap = this.orchestrator.getRecordingTap();
    if (tap) {
      this.bellScheduler = new BellScheduler(tap.ctx, tap.node);
      const segmentDurations = this.config.piece.segments.map((seg) =>
        this.getPieceSegmentDuration(seg),
      );

      // Resolve piece schedule
      const resolvedPieceSched = resolveBellSchedule(
        this.config.piece.bellSchedule || [],
        this.pieceDurationMs,
        segmentDurations,
        this.config.piece.movements,
      );

      // Resolve listening session schedule
      const resolvedSessionSched = resolveBellSchedule(
        this.config.bellSchedule || [],
        this.totalDurationMs,
        segmentDurations,
        this.config.piece.movements,
      );

      // Merge and sort all bell events
      const merged = [...resolvedPieceSched, ...resolvedSessionSched].sort(
        (a, b) => a.offsetMs - b.offsetMs,
      );

      this.bellScheduler.setTriggers(merged);
      this.bellScheduler.start(0);
    }

    this.sessionState = 'sounding';
    this.elapsedMs = 0;
    this.piecePlayer.start(
      undefined, // Piece progress is tracked internally in tick
      () => this.handlePieceEnded(),
    );

    this.timer = setInterval(() => {
      this.tick();
    }, 50);
    this.tick();
  }

  pause(): void {
    this.isPlaying = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.sessionState === 'sounding') {
      this.piecePlayer.pause();
    }
    this.bellScheduler?.stop();
  }

  resume(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastTickTime = performance.now();

    if (this.sessionState === 'sounding') {
      this.piecePlayer.start(undefined, () => this.handlePieceEnded());
    }
    this.bellScheduler?.start(this.elapsedMs);

    this.timer = setInterval(() => {
      this.tick();
    }, 50);
  }

  stop(): void {
    this.isPlaying = false;
    this.sessionState = 'idle';
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.piecePlayer.stop();
    this.bellScheduler?.stop();
    this.bellScheduler = null;
    this.orchestrator.stop();
    this.elapsedMs = 0;
  }

  private handlePieceEnded(): void {
    this.sessionState = 'ended';
    this.stop();
    if (this.onEndedCallback) {
      this.onEndedCallback();
    }
  }

  private tick(): void {
    if (!this.isPlaying) return;

    const now = performance.now();
    const dt = now - this.lastTickTime;
    this.lastTickTime = now;

    this.elapsedMs += dt;

    const nodes = this.orchestrator.getNodes();
    const ctx = this.orchestrator.getRecordingTap()?.ctx;

    if (this.sessionState === 'sounding') {
      // Calculate active piece playhead
      const segIdx = this.piecePlayer.getActiveSegmentIndex();
      let piecePlayhead = 0;
      for (let i = 0; i < segIdx; i++) {
        const seg = this.config.piece.segments[i];
        if (seg) {
          piecePlayhead += this.getPieceSegmentDuration(seg);
        }
      }
      piecePlayhead += this.piecePlayer.getPlayheadMs();

      // Compute master gain fades
      let fadeFactor = 1.0;
      if (piecePlayhead < this.config.settleInMs) {
        fadeFactor = piecePlayhead / this.config.settleInMs;
      } else if (
        this.pieceDurationMs - piecePlayhead <
        this.config.integrationMs
      ) {
        fadeFactor = Math.max(
          0,
          (this.pieceDurationMs - piecePlayhead) / this.config.integrationMs,
        );
      }

      if (nodes?.masterVol && ctx) {
        nodes.masterVol.gain.setValueAtTime(fadeFactor, ctx.currentTime);
      }
    }

    if (this.onProgressCallback) {
      const progress = Math.min(1.0, this.elapsedMs / this.totalDurationMs);
      const remainingMs = Math.max(0, this.totalDurationMs - this.elapsedMs);
      this.onProgressCallback(progress, remainingMs);
    }
  }

  getElapsedMs(): number {
    return this.elapsedMs;
  }

  getTotalDurationMs(): number {
    return this.totalDurationMs;
  }

  getSessionState(): ListeningSessionState {
    return this.sessionState;
  }
}
