import type { Piece } from '@/piece/types';
import type { Orchestrator } from '@/audio/orchestrator';
import { interpolateState, type PieceState } from '@/piece/transitions';

export class PiecePlayer {
  private piece: Piece;
  private orchestrator: Orchestrator;

  private playheadMs = 0;
  private activeSegmentIdx = 0;
  private isPlaying = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTickTime = 0;

  private segmentResolvedStates: PieceState[] = [];

  private onProgressCallback:
    | ((progress: number, segmentIdx: number) => void)
    | null = null;
  private onEndedCallback: (() => void) | null = null;

  constructor(piece: Piece, orchestrator: Orchestrator) {
    this.piece = piece;
    this.orchestrator = orchestrator;
    this.resolveAllSegmentStates();
  }

  private resolveAllSegmentStates(): void {
    const defaults = this.piece.defaultsState;
    this.segmentResolvedStates = this.piece.segments.map((seg) => {
      if (seg.type === 'fixed' || seg.type === 'open') {
        const params = { ...defaults.params, ...seg.config.params };
        const engineId = seg.config.engineId || defaults.engineId;
        const engineParams = { ...defaults.engineParams } as any;
        if (seg.config.engineParams) {
          engineParams[engineId] = {
            ...engineParams[engineId],
            ...seg.config.engineParams[engineId],
          };
        }
        return { params, engineId, engineParams };
      } else if (seg.type === 'arc') {
        const params = { ...defaults.params };
        const engineId = defaults.engineId;
        const engineParams = { ...defaults.engineParams };
        return { params, engineId, engineParams };
      } else {
        return {
          params: { ...defaults.params },
          engineId: defaults.engineId,
          engineParams: { ...defaults.engineParams },
        };
      }
    });
  }

  start(
    onProgress?: (progress: number, segmentIdx: number) => void,
    onEnded?: () => void,
  ): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.onProgressCallback = onProgress || null;
    this.onEndedCallback = onEnded || null;

    this.lastTickTime = performance.now();
    this.orchestrator.start();

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
  }

  stop(): void {
    this.pause();
    this.playheadMs = 0;
    this.activeSegmentIdx = 0;
  }

  private tick(): void {
    if (!this.isPlaying) return;
    const now = performance.now();
    const dt = now - this.lastTickTime;
    this.lastTickTime = now;

    const currentSeg = this.piece.segments[this.activeSegmentIdx];
    if (!currentSeg) {
      this.endPiece();
      return;
    }

    const isHoldOpen = currentSeg.type === 'open';

    if (!isHoldOpen) {
      const duration = currentSeg.durationMs ?? 5000;
      this.playheadMs += dt;
      if (this.playheadMs >= duration) {
        this.playheadMs -= duration;
        this.activeSegmentIdx++;
        if (this.activeSegmentIdx >= this.piece.segments.length) {
          this.endPiece();
          return;
        }
      }
    }

    this.applyActiveState();

    if (this.onProgressCallback) {
      const duration = currentSeg.durationMs || 1000;
      const progress = isHoldOpen
        ? 1.0
        : Math.min(1.0, this.playheadMs / duration);
      this.onProgressCallback(progress, this.activeSegmentIdx);
    }
  }

  private applyActiveState(): void {
    const seg = this.piece.segments[this.activeSegmentIdx];
    if (!seg) return;

    let targetState: PieceState;

    if (seg.type === 'transition') {
      const prevIdx = this.activeSegmentIdx - 1;
      const nextIdx = this.activeSegmentIdx + 1;
      const prevState =
        prevIdx >= 0
          ? this.segmentResolvedStates[prevIdx]!
          : (this.piece.defaultsState as PieceState);
      const nextState =
        nextIdx < this.piece.segments.length
          ? this.segmentResolvedStates[nextIdx]!
          : (this.piece.defaultsState as PieceState);

      const duration = seg.durationMs ?? 5000;
      const t = duration > 0 ? Math.min(1.0, this.playheadMs / duration) : 1.0;
      const easing = seg.config.easing || 'linear';

      targetState = interpolateState(prevState, nextState, t, easing);
    } else {
      targetState = this.segmentResolvedStates[this.activeSegmentIdx]!;
    }

    this.orchestrator.setEngine(targetState.engineId);
    this.orchestrator.setSharedParams(targetState.params);
    const ep = targetState.engineParams[targetState.engineId];
    if (ep) {
      this.orchestrator.setEngineParams(ep);
    }
  }

  nextSegment(): void {
    const currentSeg = this.piece.segments[this.activeSegmentIdx];
    if (!currentSeg || currentSeg.type !== 'open') return;

    this.playheadMs = 0;
    this.activeSegmentIdx++;
    if (this.activeSegmentIdx >= this.piece.segments.length) {
      this.endPiece();
    } else {
      this.lastTickTime = performance.now();
      this.applyActiveState();
    }
  }

  private endPiece(): void {
    this.stop();
    if (this.onEndedCallback) {
      this.onEndedCallback();
    }
  }

  getPlayheadMs(): number {
    return this.playheadMs;
  }

  getActiveSegmentIndex(): number {
    return this.activeSegmentIdx;
  }
}
