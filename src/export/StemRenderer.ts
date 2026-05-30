/* eslint-disable @typescript-eslint/no-explicit-any */
import { makeIR } from '@/audio/ir';
import { cutoffFor } from '@/audio/orchestrator';
import { ENGINES, engineCapabilities } from '@/audio/engines/index';
import type { EngineFactory } from '@/audio/engines/index';
import type {
  EngineId,
  EngineParams,
  SharedParams,
} from '@/audio/engines/types';
import { driftStep } from '@/audio/drift';
import { ArcRunner } from '@/session/ArcRunner';
import { getArcById } from '@/session/arcs';
import { HARMONICS, type DriftPartial } from '@/types/audio';
import { SeamLoopPlayer } from '@/loop/SeamLoopPlayer';
import { GranularPlayer } from '@/loop/GranularPlayer';
import type { SlotId, SlotState, LoopConfigMap } from '@/loop/types';
import { createPRNG } from './prng';
import { getActiveStems } from './StemTaps';
import { encodeWav } from './WavEncoder';
import type { Piece, VariationPoint } from '@/piece/types';
import { interpolateState } from '@/piece/transitions';
import { generateMetaArc } from '@/piece/generators';
import { resolveVariations, hashStringToInt } from '@/piece/resolver';
import { playBell } from '@/listening/punctuation';

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

const DRIFT_DT = 0.05;
const DRIFT_INTERVAL_SEC = 0.05;
const FADE_IN_SEC = 3.0;
const FADE_OUT_SEC = 4.0;

export interface StemRenderConfig {
  params: SharedParams;
  engineId: EngineId;
  engineParams: EngineParams;
  loopConfig: LoopConfigMap;
  loopBuffers: Record<SlotId, AudioBuffer | null>;
  loopStates: Record<SlotId, SlotState>;
  mode: 'open' | 'arc' | 'piece' | 'listening-session';
  piece?: Piece;
  arcId?: string;
  listeningSession?: {
    settleInMs: number;
    integrationMs: number;
    openingTone: boolean;
    closingTone: boolean;
  };
  durationSec: number;

  sampleRate: number;
  bitDepth: 24 | 32;
  includeFx: boolean;
  includePartials: boolean;
  seed: number;
  patchTitle: string;
  patchHash: string;
}

export interface RenderProgressEvent {
  stemId: string;
  stemLabel: string;
  progress: number; // 0..1 for current stem
  completedStems: number;
  totalStems: number;
}

export type OfflineContextFactory = (
  channels: number,
  frames: number,
  sampleRate: number,
) => OfflineAudioContext;

const defaultOfflineFactory: OfflineContextFactory = (ch, frames, sr) =>
  new OfflineAudioContext(ch, frames, sr);

export function isOfflineRenderSupported(): boolean {
  return typeof OfflineAudioContext !== 'undefined';
}

/**
 * Compute checkpoints at which to advance drift/arc.
 */
export function driftCheckpoints(durationSec: number): number[] {
  const out: number[] = [];
  for (let t = DRIFT_INTERVAL_SEC; t < durationSec; t += DRIFT_INTERVAL_SEC) {
    out.push(Number(t.toFixed(4)));
  }
  return out;
}

export function resolvePieceStateAtTime(piece: Piece, tSec: number): any {
  const tMs = tSec * 1000;
  let elapsed = 0;

  const defaults = piece.defaultsState;
  const currentParams = { ...defaults.params };

  for (let idx = 0; idx < piece.segments.length; idx++) {
    const seg = piece.segments[idx]!;

    let duration = seg.durationMs ?? 5000;
    if (
      seg.config?.tempoLocked &&
      piece.tempoBpm !== null &&
      piece.tempoBpm > 0
    ) {
      duration = duration * 4 * (60 / piece.tempoBpm) * 1000;
    }

    const startMs = elapsed;
    const endMs = elapsed + duration;

    // Check if the target time falls within this segment (or it's the last one)
    if (
      seg.type === 'open' ||
      tMs < endMs ||
      idx === piece.segments.length - 1
    ) {
      if (seg.type === 'fixed' || seg.type === 'open') {
        const params = { ...currentParams, ...seg.config.params };
        const engineId = seg.config.engineId || defaults.engineId;
        const engineParams = { ...defaults.engineParams } as any;
        if (seg.config.engineParams) {
          engineParams[engineId] = {
            ...engineParams[engineId],
            ...seg.config.engineParams[engineId],
          };
        }
        return { params, engineId, engineParams };
      } else if (seg.type === 'arc' || seg.type === 'meta-arc') {
        const arcDef =
          seg.config.generatedArc || getArcById(seg.config.arcId || 'bell');
        if (arcDef) {
          const localSec = Math.max(0, (tMs - startMs) / 1000);
          const durationSec = duration / 1000;
          const runner = new ArcRunner(
            arcDef,
            durationSec,
            currentParams as any,
            engineCapabilities(defaults.engineId),
          );
          const frame = runner.tick(localSec);
          return {
            params: { ...defaults.params, ...frame.params },
            engineId: defaults.engineId,
            engineParams: defaults.engineParams,
          };
        }
        return {
          params: { ...defaults.params, ...currentParams },
          engineId: defaults.engineId,
          engineParams: defaults.engineParams,
        };
      } else if (seg.type === 'transition') {
        const nextIdx = idx + 1;

        // End state of previous segment is currentParams
        const prevState = {
          params: { ...currentParams },
          engineId: defaults.engineId,
          engineParams: { ...defaults.engineParams },
        };

        let nextState: any;
        if (nextIdx < piece.segments.length) {
          const nextSeg = piece.segments[nextIdx]!;
          if (nextSeg.type === 'fixed' || nextSeg.type === 'open') {
            nextState = {
              params: { ...defaults.params, ...nextSeg.config.params },
              engineId: nextSeg.config.engineId || defaults.engineId,
              engineParams: { ...defaults.engineParams },
            };
          } else {
            nextState = {
              params: { ...defaults.params },
              engineId: defaults.engineId,
              engineParams: { ...defaults.engineParams },
            };
          }
        } else {
          nextState = {
            params: { ...defaults.params },
            engineId: defaults.engineId,
            engineParams: { ...defaults.engineParams },
          };
        }

        const progress = duration > 0 ? (tMs - startMs) / duration : 1.0;
        return interpolateState(
          prevState,
          nextState,
          Math.min(1.0, progress),
          seg.config.easing || 'linear',
        );
      }
    }

    // Advance currentParams to end of segment
    if (seg.type === 'fixed') {
      Object.assign(currentParams, seg.config.params);
    } else if (seg.type === 'arc' || seg.type === 'meta-arc') {
      const arcDef =
        seg.config.generatedArc || getArcById(seg.config.arcId || 'bell');
      if (arcDef) {
        const durationSec = duration / 1000;
        const runner = new ArcRunner(
          arcDef,
          durationSec,
          currentParams as any,
          engineCapabilities(defaults.engineId),
        );
        const frame = runner.tick(durationSec);
        Object.assign(currentParams, frame.params);
      }
    }

    elapsed += duration;
  }

  return {
    params: { ...defaults.params, ...currentParams },
    engineId: defaults.engineId,
    engineParams: defaults.engineParams,
  };
}

/**
 * Sequential offline stem renderer.
 */
export async function renderStemsOffline(
  config: StemRenderConfig,
  onProgress: (ev: RenderProgressEvent) => void,
  cancelSignal: { aborted: boolean },
  offlineFactory: OfflineContextFactory = defaultOfflineFactory,
  engineFactories: Partial<Record<EngineId, EngineFactory>> = ENGINES,
): Promise<Record<string, ArrayBuffer>> {
  const results: Record<string, ArrayBuffer> = {};

  // Construct a mock orchestrator to compute active stems
  const mockOrchestrator = {
    getPartialCount: () => {
      const make = engineFactories[config.engineId];
      if (!make) return 0;
      const eng = make();
      return eng.capabilities.densityLockedWhilePlaying
        ? config.params.density
        : config.params.density;
    },
    getInputVoice: () => null, // Offline renders do not capture live input
    getLoopSlot: (id: SlotId) => {
      const buffer = config.loopBuffers[id];
      return buffer ? { hasBuffer: () => true } : null;
    },
  } as any;

  let stems = getActiveStems(mockOrchestrator, {
    includeFx: config.includeFx,
    includePartials: config.includePartials,
  });
  if (config.mode === 'piece' || config.mode === 'listening-session') {
    stems = stems.filter((s) => s.id === 'master');
  }

  const totalStems = stems.length;

  // Pre-resolve all variation rules and meta-arc segments inside config.piece so resolvePieceStateAtTime remains completely stateless
  let renderedPiece = config.piece;
  if (renderedPiece && config.mode === 'piece') {
    const activeVarSeed = renderedPiece.variationSeed ?? config.seed;

    // Resolve piece-level variations (play/render rules are stable for the export)
    const pieceVariations = renderedPiece.variations || [];
    const playRenderVars = pieceVariations.filter(
      (v) => v.rule !== 'per-segment',
    );
    const resolvedDefaultsParams = resolveVariations(
      renderedPiece.defaultsState.params as Record<string, number>,
      playRenderVars,
      activeVarSeed,
    );

    renderedPiece = {
      ...renderedPiece,
      defaultsState: {
        ...renderedPiece.defaultsState,
        params: resolvedDefaultsParams,
      },
      segments: renderedPiece.segments.map((seg, idx) => {
        // Resolve piece-level variations that vary per-segment
        const segmentPieceVars = pieceVariations.filter(
          (v) => v.rule === 'per-segment',
        );
        let segmentDefaultsParams = resolvedDefaultsParams;
        if (segmentPieceVars.length > 0) {
          const segmentSeed =
            (activeVarSeed + hashStringToInt('segment-piece-' + idx)) >>> 0;
          segmentDefaultsParams = resolveVariations(
            segmentDefaultsParams,
            segmentPieceVars,
            segmentSeed,
          );
        }

        // Apply segment override variations
        let segmentParams = {
          ...segmentDefaultsParams,
          ...(seg.config.params || {}),
        };
        if (
          seg.variations &&
          seg.variations.length > 0 &&
          (seg.type === 'fixed' || seg.type === 'open')
        ) {
          const segmentSeed =
            (activeVarSeed + hashStringToInt('segment-' + idx)) >>> 0;
          segmentParams = resolveVariations(
            segmentParams,
            seg.variations,
            segmentSeed,
          );
        }

        // Apply segment overrides config
        const updatedConfig = { ...seg.config };
        if (seg.type === 'fixed' || seg.type === 'open') {
          updatedConfig.params = {
            ...seg.config.params,
            ...segmentParams,
          };
        }

        // Resolve meta-arc segment variations
        if (seg.type === 'meta-arc') {
          let seed = seg.config.seed;
          if (seed === null || seed === undefined) {
            seed = (activeVarSeed + hashStringToInt('meta-arc-' + idx)) >>> 0;
          }

          let resolvedConfig = seg.config;
          if (seg.variations && seg.variations.length > 0) {
            const segmentSeed =
              (activeVarSeed + hashStringToInt('segment-config-' + idx)) >>> 0;
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

          return {
            ...seg,
            type: 'arc',
            variations: [],
            config: {
              ...resolvedConfig,
              generatedArc,
            },
          };
        }

        return {
          ...seg,
          variations: [],
          config: updatedConfig,
        };
      }),
    };
  }

  for (let sIdx = 0; sIdx < totalStems; sIdx++) {
    if (cancelSignal.aborted) {
      throw new Error('Render cancelled by user');
    }

    const stem = stems[sIdx];
    if (!stem) continue;

    onProgress({
      stemId: stem.id,
      stemLabel: stem.label,
      progress: 0,
      completedStems: sIdx,
      totalStems,
    });

    const frames = Math.ceil(config.durationSec * config.sampleRate);
    const ctx = offlineFactory(stem.channels, frames, config.sampleRate);

    // List of loop players and engines in this context to clean up later
    const activeLoopPlayers: any[] = [];
    let activeEngine: any = null;

    // A seeded PRNG instance for this specific stem render
    const rng = createPRNG(config.seed);

    // Setup duplicate audio graph based on stem type
    let stemOutputNode: AudioNode;

    if (stem.isFx) {
      // Build full post-fx chain mirroring live core
      const master = ctx.createGain();
      master.gain.value = 1;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoffFor(config.params.brightness);
      filter.Q.value = 0.6;

      const convolver = ctx.createConvolver();
      convolver.buffer = makeIR(ctx as any, 4.0, 2.4);

      const wet = ctx.createGain();
      wet.gain.value = config.params.space;

      const dry = ctx.createGain();
      dry.gain.value = 1 - config.params.space * 0.4;

      const masterVol = ctx.createGain();

      filter.connect(dry).connect(master);
      filter.connect(convolver).connect(wet).connect(master);
      master.connect(masterVol).connect(ctx.destination);

      stemOutputNode = filter;

      if (config.mode === 'listening-session' && config.listeningSession) {
        const ls = config.listeningSession;
        const startOffset = ls.openingTone ? 4.0 : 0.0;
        const pieceDuration =
          config.durationSec -
          (ls.openingTone ? 4.0 : 0.0) -
          (ls.closingTone ? 4.0 : 0.0);

        // Start silent
        masterVol.gain.setValueAtTime(0, 0);

        if (ls.openingTone) {
          // Play opening chime at t=0
          playBell(ctx as any, ctx.destination, 660, 0);
          masterVol.gain.setValueAtTime(0, startOffset);
        }

        // Settle-in fade-in ramp
        const settleInSec = ls.settleInMs / 1000;
        masterVol.gain.setValueAtTime(0, startOffset);
        masterVol.gain.linearRampToValueAtTime(
          config.params.volume,
          startOffset + settleInSec,
        );

        // Integration fade-out ramp
        const integrationSec = ls.integrationMs / 1000;
        const fadeOutStart = startOffset + pieceDuration - integrationSec;
        masterVol.gain.setValueAtTime(config.params.volume, fadeOutStart);
        masterVol.gain.linearRampToValueAtTime(0, startOffset + pieceDuration);

        if (ls.closingTone) {
          // Play closing chime at the end of the piece
          playBell(
            ctx as any,
            ctx.destination,
            660,
            startOffset + pieceDuration,
          );
          masterVol.gain.setValueAtTime(0, startOffset + pieceDuration);
        }
      } else {
        masterVol.gain.value = config.params.volume;
        // End fade-out on masterVol so tail doesn't clip
        masterVol.gain.setValueAtTime(
          config.params.volume,
          Math.max(0, config.durationSec - FADE_OUT_SEC),
        );
        masterVol.gain.linearRampToValueAtTime(0, config.durationSec);
      }

      // Connect sources based on stem target
      if (stem.type === 'master' || stem.type === 'engine') {
        const make = engineFactories[config.engineId];
        if (make) {
          const engine = make();
          engine.start(ctx as any, config.params, config.engineParams);
          activeEngine = engine;

          const bus = ctx.createGain();
          bus.gain.setValueAtTime(0, 0);
          bus.gain.linearRampToValueAtTime(1, FADE_IN_SEC);
          engine.getOutputNode().connect(bus);
          bus.connect(filter);
        }
      }

      if (stem.type === 'master' || stem.type === 'loop') {
        // Build active loop players and route to filter
        const slotsToRender =
          stem.type === 'master'
            ? (Object.keys(config.loopBuffers) as SlotId[])
            : [stem.slotId!];

        for (const slotId of slotsToRender) {
          const buffer = config.loopBuffers[slotId];
          const slotState = config.loopStates[slotId];
          const slotConf = config.loopConfig[slotId];

          if (buffer && slotState !== 'empty' && slotConf) {
            const loopBus = ctx.createGain();
            loopBus.gain.value = slotConf.muted ? 0 : 1;
            loopBus.connect(filter);

            let player: any;
            if (slotConf.frozen) {
              player = new GranularPlayer(ctx as any, buffer, loopBus, rng);
              player.start(slotConf.grain);
            } else {
              player = new SeamLoopPlayer(ctx as any, buffer, loopBus);
              player.start();
            }
            activeLoopPlayers.push(player);
          }
        }
      }
    } else {
      // Raw/pre-fx stems connect directly to destination
      if (stem.type === 'engine') {
        const make = engineFactories[config.engineId];
        if (make) {
          const engine = make();
          engine.start(ctx as any, config.params, config.engineParams);
          activeEngine = engine;
          engine.getOutputNode().connect(ctx.destination);
        }
      } else if (stem.type === 'partial') {
        const make = engineFactories[config.engineId];
        if (make) {
          const engine = make();
          engine.start(ctx as any, config.params, config.engineParams);
          activeEngine = engine;

          // Connect only the specific partial's output node
          if (engine.getPartialOutputs) {
            const partials = engine.getPartialOutputs();
            const partialNode = partials[stem.partialIndex!];
            if (partialNode) {
              partialNode.connect(ctx.destination);
            }
          }
        }
      } else if (stem.type === 'loop') {
        const buffer = config.loopBuffers[stem.slotId!];
        const slotConf = config.loopConfig[stem.slotId!];
        if (buffer && slotConf) {
          const loopBus = ctx.createGain();
          loopBus.gain.value = slotConf.muted ? 0 : 1;
          loopBus.connect(ctx.destination);

          let player: any;
          if (slotConf.frozen) {
            player = new GranularPlayer(ctx as any, buffer, loopBus, rng);
            player.start(slotConf.grain);
          } else {
            player = new SeamLoopPlayer(ctx as any, buffer, loopBus);
            player.start();
          }
          activeLoopPlayers.push(player);
        }
      }
    }

    // Set up drift/arc automation and scheduler pumping at checkpoints
    const drift: DriftPartial[] = activeEngine
      ? Array.from({ length: activeEngine.getPartialCount() }, (_, i) => ({
          ratio: HARMONICS[i] ?? 1,
          detune: 0,
        }))
      : [];

    let arc: ArcRunner | null = null;
    if (config.mode === 'arc' && config.arcId) {
      const def = getArcById(config.arcId);
      if (def) {
        arc = new ArcRunner(
          def,
          config.durationSec,
          config.params,
          engineCapabilities(config.engineId),
        );
      }
    }
    const live: SharedParams = { ...config.params };

    // Register offline suspensions
    for (const t of driftCheckpoints(config.durationSec)) {
      ctx.suspend(t).then(() => {
        // 1. Advance engine detune walk deterministically
        if (activeEngine && drift.length > 0) {
          const next = driftStep(
            drift,
            { drift: live.drift, coupling: live.coupling },
            DRIFT_DT,
            rng,
          );
          drift.forEach((p, i) => {
            const d = next[i];
            if (d === undefined) return;
            p.detune = d;
            activeEngine.setPartialDetune(i, d);
          });
        }

        // 2. Advance arc runner or piece timeline
        if (arc) {
          const frame = arc.tick(t);
          if (Object.keys(frame.params).length > 0) {
            Object.assign(live, frame.params);
            activeEngine?.setSharedParams(frame.params);
            if (stem.isFx && stemOutputNode) {
              const filter = stemOutputNode as BiquadFilterNode;
              filter.frequency.setValueAtTime(cutoffFor(live.brightness), t);
            }
          }
        } else if (config.mode === 'piece' && renderedPiece) {
          const resolved = resolvePieceStateAtTime(renderedPiece, t);
          Object.assign(live, resolved.params);
          activeEngine?.setSharedParams(resolved.params);
          if (stem.isFx && stemOutputNode) {
            const filter = stemOutputNode as BiquadFilterNode;
            filter.frequency.setValueAtTime(cutoffFor(live.brightness), t);
          }
        } else if (config.mode === 'listening-session' && renderedPiece) {
          const ls = config.listeningSession;
          const startOffset = ls?.openingTone ? 4.0 : 0.0;
          const pieceTime = Math.max(0, t - startOffset);
          const resolved = resolvePieceStateAtTime(renderedPiece, pieceTime);
          Object.assign(live, resolved.params);
          activeEngine?.setSharedParams(resolved.params);
          if (stem.isFx && stemOutputNode) {
            const filter = stemOutputNode as BiquadFilterNode;
            filter.frequency.setValueAtTime(cutoffFor(live.brightness), t);
          }
        }

        // 3. Dynamically collect and pump look-ahead schedulers to keep pace with OAC
        const schedulers: any[] = [];
        if (config.engineId === 'granular' && activeEngine) {
          const enginePartials = (activeEngine as any).partials || [];
          for (const p of enginePartials) {
            if (p.cloud && p.cloud.scheduler) {
              schedulers.push(p.cloud.scheduler);
            }
          }
        }

        for (const player of activeLoopPlayers) {
          if (player.scheduler) {
            schedulers.push(player.scheduler);
          } else if (player.cloud && player.cloud.scheduler) {
            schedulers.push(player.cloud.scheduler);
          }
        }

        for (const s of schedulers) {
          s.pump();
        }

        void ctx.resume();
      });
    }

    // Run OAC render pass
    const rendered = await ctx.startRendering();

    // 5. Clean up nodes and stop players immediately to free up memory (GC sweep)
    if (activeEngine) {
      await activeEngine.stop(0);
    }
    for (const player of activeLoopPlayers) {
      player.stop();
    }

    // 6. Encode rendering output to the requested WAV format
    results[stem.id] = encodeWav(rendered, {
      bitDepth: config.bitDepth,
      stemName: stem.id,
      label: stem.label,
      patchTitle: config.patchTitle,
      patchHash: config.patchHash,
      engineType: config.engineId,
      partialIndex: stem.partialIndex,
    });

    onProgress({
      stemId: stem.id,
      stemLabel: stem.label,
      progress: 1,
      completedStems: sIdx + 1,
      totalStems,
    });
  }

  return results;
}
