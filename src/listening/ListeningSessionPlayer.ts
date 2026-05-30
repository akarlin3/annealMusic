import type { Piece, PieceSegment } from '@/piece/types';
import { PiecePlayer } from '@/piece/PiecePlayer';
import type { Orchestrator } from '@/audio/orchestrator';
import { playBell } from './punctuation';

export interface ListeningSessionConfig {
  piece: Piece;
  settleInMs: number;
  integrationMs: number;
  openingTone: boolean;
  closingTone: boolean;
}

export type ListeningSessionState =
  | 'idle'
  | 'opening_bell'
  | 'sounding'
  | 'closing_bell'
  | 'ended';

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
  private closingBellStartMs = 0;

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
      return raw * 4 * (60 / this.config.piece.tempoBpm) * 1000;
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
    let total = this.pieceDurationMs;
    if (this.config.openingTone) total += 4000;
    if (this.config.closingTone) total += 4000;
    return total;
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

    if (this.config.openingTone) {
      this.sessionState = 'opening_bell';
      this.elapsedMs = 0;
      this.triggerBell();
    } else {
      this.sessionState = 'sounding';
      this.elapsedMs = 0;
      this.piecePlayer.start(
        undefined, // Piece progress is tracked internally in tick
        () => this.handlePieceEnded(),
      );
    }

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
  }

  resume(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastTickTime = performance.now();

    if (this.sessionState === 'sounding') {
      this.piecePlayer.start(undefined, () => this.handlePieceEnded());
    }

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
    this.orchestrator.stop();
    this.elapsedMs = 0;
  }

  private triggerBell(): void {
    const tap = this.orchestrator.getRecordingTap();
    const dest =
      this.orchestrator.getAnalyser() || this.orchestrator.getNodes()?.master;
    if (tap?.ctx && dest) {
      playBell(tap.ctx, dest, 660);
    }
  }

  private handlePieceEnded(): void {
    if (this.config.closingTone) {
      this.sessionState = 'closing_bell';
      this.closingBellStartMs = this.elapsedMs;
      this.triggerBell();
    } else {
      this.sessionState = 'ended';
      this.stop();
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
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

    if (this.sessionState === 'opening_bell') {
      // Keep master gain completely silent during opening chime decay
      if (nodes?.masterVol && ctx) {
        nodes.masterVol.gain.setValueAtTime(0, ctx.currentTime);
      }

      if (this.elapsedMs >= 4000) {
        this.sessionState = 'sounding';
        this.piecePlayer.start(undefined, () => this.handlePieceEnded());
      }
    } else if (this.sessionState === 'sounding') {
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
    } else if (this.sessionState === 'closing_bell') {
      // Keep master gain silent during closing chime decay
      if (nodes?.masterVol && ctx) {
        nodes.masterVol.gain.setValueAtTime(0, ctx.currentTime);
      }

      if (this.elapsedMs - this.closingBellStartMs >= 4000) {
        this.sessionState = 'ended';
        this.stop();
        if (this.onEndedCallback) {
          this.onEndedCallback();
        }
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
