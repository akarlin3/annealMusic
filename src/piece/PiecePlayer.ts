/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  Piece,
  PieceSegment,
  VariationPoint,
  AutomationPoint,
} from '@/piece/types';
import type { Orchestrator } from '@/audio/orchestrator';
import { interpolateState, type PieceState } from '@/piece/transitions';
import { ArcRunner } from '@/session/ArcRunner';
import { getArcById } from '@/session/arcs';
import { engineCapabilities } from '@/audio/engines/index';
import { generateMetaArc } from '@/piece/generators';
import { doc, sessionConfigMap } from '@/jam/crdt';
import { getAnonId } from '@/api/anon';
import { resolveVariations, hashStringToInt } from '@/piece/resolver';
import { resolveMidiNote } from '@/audio/tuning/resolver';
import type { TuningRef } from '@/audio/tuning/types';
import { useParamStore } from '@/state/params';

export function evaluateAutomation(
  points: AutomationPoint[],
  timeMs: number,
): number | null {
  if (!points || points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.timeMs - b.timeMs);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return null;
  if (timeMs <= first.timeMs) return first.value;
  if (timeMs >= last.timeMs) return last.value;

  let idx = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const pCurr = sorted[i]!;
    const pNext = sorted[i + 1]!;
    if (timeMs >= pCurr.timeMs && timeMs < pNext.timeMs) {
      idx = i;
      break;
    }
  }

  const p0 = sorted[idx]!;
  const p1 = sorted[idx + 1]!;
  const dt = p1.timeMs - p0.timeMs;
  if (dt === 0) return p0.value;
  const t = (timeMs - p0.timeMs) / dt;

  if (p0.interpolation === 'hold') {
    return p0.value;
  }
  if (p0.interpolation === 'exponential') {
    if (p0.value !== 0 && p1.value !== 0 && p0.value * p1.value > 0) {
      return p0.value * Math.pow(p1.value / p0.value, t);
    }
  }
  return p0.value + t * (p1.value - p0.value);
}

function resolveNestedConfigVariations(
  config: Record<string, any>,
  variations: VariationPoint[],
  seed: number,
): Record<string, any> {
  const resolvedConfig = JSON.parse(JSON.stringify(config));
  const flatRecord: Record<string, number> = {};
  for (const vp of variations) {
    const parts = vp.paramKey.split('.');
    let val = resolvedConfig;
    for (const part of parts) {
      val = val?.[part];
    }
    if (typeof val === 'number') {
      flatRecord[vp.paramKey] = val;
    } else {
      flatRecord[vp.paramKey] = vp.constraint.min ?? 0;
    }
  }

  const resolvedFlat = resolveVariations(flatRecord, variations, seed);

  for (const vp of variations) {
    const parts = vp.paramKey.split('.');
    let target = resolvedConfig;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (!target[part]) target[part] = {};
      target = target[part];
    }
    const lastPart = parts[parts.length - 1]!;
    target[lastPart] = resolvedFlat[vp.paramKey];
  }

  return resolvedConfig;
}

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
  private activeVariationSeed = 0;

  private onProgressCallback:
    | ((progress: number, segmentIdx: number) => void)
    | null = null;
  private onEndedCallback: (() => void) | null = null;

  constructor(piece: Piece, orchestrator: Orchestrator) {
    this.piece = piece;
    this.orchestrator = orchestrator;
    this.activeVariationSeed = this.getActiveVariationSeed();
    this.resolveAllSegmentStates();
  }

  private getActiveVariationSeed(): number {
    const inJam = sessionConfigMap.size > 0;
    if (inJam) {
      const hostId = doc.getMap('metadata').get('hostId') as string | undefined;
      const isLeader = hostId === getAnonId() || !hostId;
      if (isLeader) {
        let seed = this.piece.variationSeed;
        if (seed === null || seed === undefined) {
          const existing = sessionConfigMap.get('variation_seed_active') as
            | number
            | undefined;
          if (existing !== undefined && existing !== null) {
            seed = existing;
          } else {
            seed = Math.floor(Math.random() * 1000000);
            sessionConfigMap.set('variation_seed_active', seed);
          }
        }
        return seed;
      } else {
        const remoteSeed = sessionConfigMap.get('variation_seed_active') as
          | number
          | undefined;
        if (remoteSeed !== undefined && remoteSeed !== null) {
          return remoteSeed;
        }
        return this.piece.variationSeed ?? Math.floor(Math.random() * 1000000);
      }
    }
    return this.piece.variationSeed ?? Math.floor(Math.random() * 1000000);
  }

  reRoll(): void {
    const inJam = sessionConfigMap.size > 0;
    if (inJam) {
      const hostId = doc.getMap('metadata').get('hostId') as string | undefined;
      const isLeader = hostId === getAnonId() || !hostId;
      if (isLeader) {
        const nextSeed = Math.floor(Math.random() * 1000000);
        sessionConfigMap.set('variation_seed_active', nextSeed);
        this.activeVariationSeed = nextSeed;
      }
    } else {
      this.activeVariationSeed = Math.floor(Math.random() * 1000000);
    }
    this.resolveAllSegmentStates();
    this.applyActiveState();
  }

  private getResolvedDefaultsParams(
    segmentIdx: number,
  ): Record<string, number> {
    const defaults = this.piece.defaultsState;
    const pieceVariations = this.piece.variations || [];

    const playRenderVars = pieceVariations.filter(
      (v) => v.rule !== 'per-segment',
    );
    const segmentVars = pieceVariations.filter((v) => v.rule === 'per-segment');

    let resolved = resolveVariations(
      defaults.params as Record<string, number>,
      playRenderVars,
      this.activeVariationSeed,
    );

    if (segmentVars.length > 0) {
      const segmentSeed =
        (this.activeVariationSeed +
          hashStringToInt('segment-piece-' + segmentIdx)) >>>
        0;
      resolved = resolveVariations(resolved, segmentVars, segmentSeed);
    }

    return resolved;
  }

  private resolveAllSegmentStates(): void {
    const defaults = this.piece.defaultsState;
    this.segmentResolvedStates = this.piece.segments.map((seg, idx) => {
      const defaultsParams = this.getResolvedDefaultsParams(idx);

      if (seg.type === 'fixed' || seg.type === 'open') {
        let params = { ...defaultsParams, ...(seg.config.params || {}) };

        // Apply segment-level variations
        if (seg.variations && seg.variations.length > 0) {
          const segmentSeed =
            (this.activeVariationSeed + hashStringToInt('segment-' + idx)) >>>
            0;
          params = resolveVariations(params, seg.variations, segmentSeed);
        }

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
        const params = { ...defaultsParams };
        const engineId = defaults.engineId;
        const engineParams = { ...defaults.engineParams };
        return { params, engineId, engineParams };
      } else {
        return {
          params: { ...defaultsParams },
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
    this.activeVariationSeed = this.getActiveVariationSeed();
    this.resolveAllSegmentStates();
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
    if (
      seg.config?.tempoLocked &&
      this.piece.tempoBpm !== null &&
      this.piece.tempoBpm > 0
    ) {
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

      const duration = this.getSegmentDuration(seg);
      const t = duration > 0 ? Math.min(1.0, this.playheadMs / duration) : 1.0;
      const easing = seg.config.easing || 'linear';

      targetState = interpolateState(prevState, nextState, t, easing);
    } else if (seg.type === 'arc' || seg.type === 'meta-arc') {
      if (!this.activeArcRunner) {
        const durationSec = this.getSegmentDuration(seg) / 1000;
        const defaults = this.piece.defaultsState;
        const defaultsParams =
          this.segmentResolvedStates[this.activeSegmentIdx]!.params;
        const startParams = { ...defaultsParams };

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
            seed =
              (this.activeVariationSeed +
                hashStringToInt('meta-arc-' + this.activeSegmentIdx)) >>>
              0;
          }

          // Apply segment variations to meta-arc generator config (e.g. driftStrength)
          let resolvedConfig = seg.config;
          if (seg.variations && seg.variations.length > 0) {
            const segmentSeed =
              (this.activeVariationSeed +
                hashStringToInt('segment-config-' + this.activeSegmentIdx)) >>>
              0;
            resolvedConfig = resolveNestedConfigVariations(
              seg.config,
              seg.variations,
              segmentSeed,
            );
          }

          const generatedArc = generateMetaArc(
            resolvedConfig.kind || 'random-walk',
            resolvedConfig,
            seed,
          );
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
        const defaultsParams =
          this.segmentResolvedStates[this.activeSegmentIdx]!.params;
        targetState = {
          params: { ...defaultsParams, ...frame.params },
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

    // Apply Automation Overrides
    const mergedParams = { ...targetState.params };
    if (this.piece.automationTracks) {
      for (const track of this.piece.automationTracks) {
        const autoValue = evaluateAutomation(track.points, playheadGlobalMs);
        if (autoValue !== null) {
          (mergedParams as any)[track.paramKey] = autoValue;
        }
      }
    }

    const segTuning = seg.config?.tuning as TuningRef | undefined;
    const pieceTuning = (this.piece.defaultsState as any).tuning as
      | TuningRef
      | undefined;
    const activeTuning = segTuning ||
      pieceTuning || { system: 'equal' as const, referenceA4Hz: 440 };

    let customRatios: number[] | undefined;
    let customEq: number | undefined;
    if (activeTuning.system === 'custom' && activeTuning.sclId) {
      const customScale = useParamStore
        .getState()
        .customScales.find((s) => s.id === activeTuning.sclId);
      if (customScale) {
        customRatios = customScale.parsed_scale;
        customEq =
          customScale.parsed_scale[customScale.parsed_scale.length - 1];
      }
    }

    const defaultsStateAny = this.piece.defaultsState as any;
    if (!customRatios) {
      customRatios =
        defaultsStateAny.customScaleRatios ||
        (seg.config as any).customScaleRatios;
    }
    if (customEq === undefined) {
      customEq =
        defaultsStateAny.customEqRatio ??
        (seg.config as any).customEqRatio ??
        2.0;
    }

    const activeNote = this.piece.notation?.find(
      (note) =>
        playheadGlobalMs >= note.onset_ms &&
        playheadGlobalMs < note.onset_ms + note.duration_ms,
    );

    let targetRootFreq = mergedParams.rootFreq ?? targetState.params.rootFreq;
    let isFromNotation = false;

    if (activeNote) {
      const freq = resolveMidiNote(
        activeTuning,
        activeNote.pitch_midi,
        customRatios,
        customEq,
      );
      targetRootFreq = freq;
      this.lastNotationPitchHz = freq;
      isFromNotation = true;
    } else {
      const hasAutomationRootOverride = this.piece.automationTracks?.some(
        (track) =>
          track.paramKey === 'rootFreq' &&
          evaluateAutomation(track.points, playheadGlobalMs) !== null,
      );
      const hasSegmentRootOverride =
        seg.type === 'transition' ||
        seg.type === 'arc' ||
        seg.type === 'meta-arc' ||
        (seg.type === 'fixed' && seg.config?.params?.rootFreq !== undefined) ||
        hasAutomationRootOverride;

      if (hasSegmentRootOverride) {
        this.lastNotationPitchHz = null;
      } else if (this.lastNotationPitchHz !== null) {
        targetRootFreq = this.lastNotationPitchHz;
      }
    }

    this.orchestrator.setEngine(targetState.engineId);

    // Set smooth/instant pitch change parameter
    const isInstantChange = !this.smoothPitch && isFromNotation;

    this.orchestrator.setSharedParams(
      {
        ...mergedParams,
        rootFreq: targetRootFreq,
        tuning: activeTuning,
        customScaleRatios: customRatios,
        customEqRatio: customEq,
      },
      isInstantChange,
    );

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

  seek(timeMs: number): void {
    let currentMs = 0;
    let segIdx = 0;
    this.activeArcRunner = null;

    while (segIdx < this.piece.segments.length) {
      const seg = this.piece.segments[segIdx]!;
      const dur = this.getSegmentDuration(seg);
      if (currentMs + dur > timeMs) {
        this.activeSegmentIdx = segIdx;
        this.playheadMs = timeMs - currentMs;
        this.applyActiveState();
        return;
      }
      currentMs += dur;
      segIdx++;
    }
    // Clamp to end
    this.activeSegmentIdx = this.piece.segments.length - 1;
    const lastSeg = this.piece.segments[this.activeSegmentIdx];
    this.playheadMs = lastSeg ? this.getSegmentDuration(lastSeg) : 0;
    this.applyActiveState();
  }

  skipToMovement(movementIdx: number): void {
    if (!this.piece.movements || !this.piece.movements[movementIdx]) return;
    const movement = this.piece.movements[movementIdx]!;

    this.activeSegmentIdx = movement.startSegmentIndex;
    this.playheadMs = 0;
    this.activeArcRunner = null;
    this.lastTickTime = performance.now();
    this.applyActiveState();
  }

  replayCurrentMovement(): void {
    if (!this.piece.movements || this.piece.movements.length === 0) {
      this.activeSegmentIdx = 0;
      this.playheadMs = 0;
      this.activeArcRunner = null;
      this.lastTickTime = performance.now();
      this.applyActiveState();
      return;
    }

    const currentIdx = this.activeSegmentIdx;
    const movementIdx = this.piece.movements.findIndex(
      (m) =>
        currentIdx >= m.startSegmentIndex && currentIdx <= m.endSegmentIndex,
    );

    if (movementIdx !== -1) {
      this.skipToMovement(movementIdx);
    } else {
      this.playheadMs = 0;
      this.activeArcRunner = null;
      this.lastTickTime = performance.now();
      this.applyActiveState();
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
