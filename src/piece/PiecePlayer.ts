import type { Piece, PieceSegment } from '@/piece/types';
import type { Orchestrator } from '@/audio/orchestrator';
import { interpolateState, type PieceState } from '@/piece/transitions';
import { ArcRunner } from '@/session/ArcRunner';
import { getArcById } from '@/session/arcs';
import { engineCapabilities } from '@/audio/engines/index';
import { generateMetaArc } from '@/piece/generators';
import { doc, sessionConfigMap } from '@/jam/crdt';
import { getAnonId } from '@/api/anon';

export class PiecePlayer {
  private piece: Piece;
  private orchestrator: Orchestrator;

  private playheadMs = 0;
  private activeSegmentIdx = 0;
  private isPlaying = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTickTime = 0;

  private segmentResolvedStates: PieceState[] = [];
  private lastNotationPitchHz: number | null = null;
  private smoothPitch = true;

  private activeArcRunner: ArcRunner | null = null;

  private onProgressCallback: ((progress: number, segmentIdx: number) => void) | null = null;
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
        const engineParams = { ...defaults.engineParams } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        if (seg.config.engineParams) {
          engineParams[engineId] = {
            ...engineParams[engineId],
            ...seg.config.engineParams[engineId],
          };
        }
        return { params, engineId, engineParams };
      } else if (seg.type === 'arc' || seg.type === 'meta-arc') {
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

  start(onProgress?: (progress: number, segmentIdx: number) => void, onEnded?: () => void): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.onProgressCallback = onProgress || null;
    this.onEndedCallback = onEnded || null;

    this.lastTickTime = performance.now();
    this.orchestrator.setTempoBpm(this.piece.tempoBpm);
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
    this.lastNotationPitchHz = null;
    this.activeArcRunner = null;
  }

  setSmoothPitch(smooth: boolean): void {
    this.smoothPitch = smooth;
  }

  isSmoothPitch(): boolean {
    return this.smoothPitch;
  }

  private getSegmentDuration(seg: PieceSegment): number {
    const raw = seg.durationMs ?? 5000;
    if (seg.config?.tempoLocked && this.piece.tempoBpm !== null && this.piece.tempoBpm > 0) {
      return raw * 4 * (60 / this.piece.tempoBpm) * 1000;
    }
    return raw;
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
      const duration = this.getSegmentDuration(currentSeg);
      this.playheadMs += dt;
      if (this.playheadMs >= duration) {
        this.playheadMs -= duration;
        this.activeSegmentIdx++;
        this.activeArcRunner = null;
        if (this.activeSegmentIdx >= this.piece.segments.length) {
          this.endPiece();
          return;
        }
      }
    }

    this.applyActiveState();

    if (this.onProgressCallback) {
      const duration = this.getSegmentDuration(currentSeg) || 1000;
      const progress = isHoldOpen ? 1.0 : Math.min(1.0, this.playheadMs / duration);
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
        prevIdx >= 0 ? this.segmentResolvedStates[prevIdx]! : (this.piece.defaultsState as PieceState);
      const nextState =
        nextIdx < this.piece.segments.length
          ? this.segmentResolvedStates[nextIdx]!
          : (this.piece.defaultsState as PieceState);

      const duration = this.getSegmentDuration(seg);
      const t = duration > 0 ? Math.min(1.0, this.playheadMs / duration) : 1.0;
      const easing = seg.config.easing || 'linear';

      targetState = interpolateState(prevState, nextState, t, easing);
    } else if (seg.type === 'arc' || seg.type === 'meta-arc') {
      if (!this.activeArcRunner) {
        const durationSec = this.getSegmentDuration(seg) / 1000;
        const defaults = this.piece.defaultsState;
        const startParams = { ...defaults.params };

        if (seg.type === 'arc') {
          const def = getArcById(seg.config.arcId || 'bell');
          if (def) {
            this.activeArcRunner = new ArcRunner(
              def,
              durationSec,
              startParams as any, // eslint-disable-line @typescript-eslint/no-explicit-any
              engineCapabilities(defaults.engineId),
            );
          }
        } else {
          // Resolve meta-arc seed
          let seed = seg.config.seed;
          if (seed === null || seed === undefined) {
            const inJam = sessionConfigMap.size > 0;
            if (inJam) {
              const hostId = doc.getMap('metadata').get('hostId') as string | undefined;
              const isLeader = hostId === getAnonId() || !hostId;

              if (isLeader) {
                const rolledSeed = Math.floor(Math.random() * 1000000);
                sessionConfigMap.set(`meta_arc_seed_${this.activeSegmentIdx}`, rolledSeed);
                seed = rolledSeed;
              } else {
                const remoteSeed = sessionConfigMap.get(`meta_arc_seed_${this.activeSegmentIdx}`) as number | undefined;
                if (remoteSeed !== undefined && remoteSeed !== null) {
                  seed = remoteSeed;
                } else {
                  seed = Math.floor(Math.random() * 1000000);
                }
              }
            } else {
              seed = Math.floor(Math.random() * 1000000);
            }
          }

          const generatedArc = generateMetaArc(seg.config.kind || 'random-walk', seg.config, seed);
          this.activeArcRunner = new ArcRunner(
            generatedArc,
            durationSec,
            startParams as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            engineCapabilities(defaults.engineId),
          );
        }
      }

      if (this.activeArcRunner) {
        const frame = this.activeArcRunner.tick(this.playheadMs / 1000);
        targetState = {
          params: { ...this.piece.defaultsState.params, ...frame.params },
          engineId: this.piece.defaultsState.engineId,
          engineParams: this.piece.defaultsState.engineParams,
        };
      } else {
        targetState = this.segmentResolvedStates[this.activeSegmentIdx]!;
      }
    } else {
      targetState = this.segmentResolvedStates[this.activeSegmentIdx]!;
    }

    // Notation Overlay Override Logic
    let playheadGlobalMs = 0;
    for (let i = 0; i < this.activeSegmentIdx; i++) {
      playheadGlobalMs += this.getSegmentDuration(this.piece.segments[i]!);
    }
    playheadGlobalMs += this.playheadMs;

    const activeNote = this.piece.notation?.find(
      (note) => playheadGlobalMs >= note.onset_ms && playheadGlobalMs < note.onset_ms + note.duration_ms,
    );

    let targetRootFreq = targetState.params.rootFreq;
    let isFromNotation = false;

    if (activeNote) {
      const freq = 440 * Math.pow(2, (activeNote.pitch_midi - 69) / 12);
      targetRootFreq = freq;
      this.lastNotationPitchHz = freq;
      isFromNotation = true;
    } else {
      const hasSegmentRootOverride =
        seg.type === 'transition' ||
        seg.type === 'arc' ||
        seg.type === 'meta-arc' ||
        (seg.type === 'fixed' && seg.config?.params?.rootFreq !== undefined);

      if (hasSegmentRootOverride) {
        this.lastNotationPitchHz = null;
      } else if (this.lastNotationPitchHz !== null) {
        targetRootFreq = this.lastNotationPitchHz;
      }
    }

    this.orchestrator.setEngine(targetState.engineId);

    // Set smooth/instant pitch change parameter
    const isInstantChange = !this.smoothPitch && isFromNotation;

    this.orchestrator.setSharedParams({ ...targetState.params, rootFreq: targetRootFreq }, isInstantChange);

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
    this.activeArcRunner = null;
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

  updatePiece(piece: Piece): void {
    this.piece = piece;
    this.resolveAllSegmentStates();
  }
}
