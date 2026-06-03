/* eslint-disable @typescript-eslint/no-explicit-any */
import { makeIR, setupConvolverBuffer } from '@/audio/ir';
import { cutoffFor } from '@/audio/orchestrator';
import { ENGINES, engineCapabilities } from '@/audio/engines/index';
import type { EngineFactory } from '@/audio/engines/index';
import type {
  EngineId,
  EngineParams,
  SharedParams,
} from '@/audio/engines/types';
import { driftStep } from '@/audio/drift';
import { fusionMultipliers } from '@/audio/fusion';
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
import { BellLoader } from '@/audio/bells/loader';
import { resolveBellSchedule, type BellEvent } from '@/audio/bells/scheduler';
import {
  applyHannWindow,
  computeFFTSpectrum,
  getMagnitudeSpectrum,
  spectralCentroid,
} from '@/audio/analysis/spectrum';
import { writeJSONL } from '@/datalog/writers/jsonl';
import { writeCSV } from '@/datalog/writers/csv';
import { SonificationPlayer } from '@/sonification/SonificationPlayer';
import type { MappingSpec } from '@/sonification/types';

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
  mode: 'open' | 'arc' | 'piece' | 'listening-session' | 'sonification';
  piece?: Piece;
  arcId?: string;
  sonificationSpec?: MappingSpec;
  listeningSession?: {
    settleInMs: number;
    integrationMs: number;
    bellSchedule: BellEvent[];
  };
  durationSec: number;

  sampleRate: number;
  bitDepth: 24 | 32;
  includeFx: boolean;
  includePartials: boolean;
  seed: number;
  patchTitle: string;
  patchHash: string;

  logFormat?: string;
  logOut?: string;
  logRate?: number;
  logMode?: string;
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
      duration = duration * 4 * (60 / piece.tempoBpm);
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

  // Pre-resolve segment durations of the piece for scheduling bells
  const segmentDurations: number[] = [];
  if (renderedPiece) {
    for (const seg of renderedPiece.segments) {
      let dur = seg.durationMs ?? 5000;
      if (
        seg.config?.tempoLocked &&
        renderedPiece.tempoBpm !== null &&
        renderedPiece.tempoBpm > 0
      ) {
        dur = dur * 4 * (60 / renderedPiece.tempoBpm);
      }
      segmentDurations.push(dur);
    }
  }

  // Pre-resolve and sort all scheduled bells
  let resolvedBells: { offsetMs: number; bellId: string; volume: number }[] =
    [];
  if (renderedPiece) {
    const pieceBells = resolveBellSchedule(
      renderedPiece.bellSchedule || [],
      config.durationSec * 1000,
      segmentDurations,
      renderedPiece.movements || [],
    );
    resolvedBells.push(...pieceBells);
  }

  if (config.mode === 'listening-session' && config.listeningSession) {
    const ls = config.listeningSession;
    const sessionBells = resolveBellSchedule(
      ls.bellSchedule || [],
      config.durationSec * 1000,
      segmentDurations,
      renderedPiece?.movements || [],
    );
    resolvedBells.push(...sessionBells);
  }

  // Deduplicate and sort
  const seenBells = new Set<string>();
  const dedupedBells: typeof resolvedBells = [];
  for (const b of resolvedBells) {
    const key = `${b.bellId}-${Math.round(b.offsetMs / 10) * 10}`;
    if (!seenBells.has(key)) {
      seenBells.add(key);
      dedupedBells.push(b);
    }
  }
  resolvedBells = dedupedBells.sort((a, b) => a.offsetMs - b.offsetMs);

  const uniqueBellIds = Array.from(new Set(resolvedBells.map((b) => b.bellId)));

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

    // Preload bells for this offline context
    if (uniqueBellIds.length > 0) {
      await BellLoader.preloadBells(ctx, uniqueBellIds);
    }

    // List of loop players and engines in this context to clean up later
    const activeLoopPlayers: any[] = [];
    let activeEngine: any = null;

    // A seeded PRNG instance for this specific stem render
    const rng = createPRNG(config.seed);

    const collectedRecords: any[] = [];
    const startTimeStr = new Date().toISOString();
    const startTimeMs = new Date(startTimeStr).getTime();
    let currentR = 0;

    // Setup duplicate audio graph based on stem type
    let stemOutputNode: AudioNode;

    if (stem.isFx) {
      // Build full post-fx chain mirroring live core
      const master = ctx.createGain();
      master.gain.setValueAtTime(1, 0);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoffFor(config.params.brightness), 0);
      filter.Q.setValueAtTime(0.6, 0);

      const convolver = ctx.createConvolver();
      await setupConvolverBuffer(
        ctx as any,
        convolver,
        makeIR(ctx as any, 4.0, 2.4),
      );

      const wet = ctx.createGain();
      wet.gain.setValueAtTime(config.params.space, 0);

      const dry = ctx.createGain();
      dry.gain.setValueAtTime(1 - config.params.space * 0.4, 0);

      const masterVol = ctx.createGain();

      filter.connect(dry).connect(master);
      filter.connect(convolver).connect(wet).connect(master);
      master.connect(masterVol).connect(ctx.destination);

      stemOutputNode = filter;

      if (config.mode === 'listening-session' && config.listeningSession) {
        const ls = config.listeningSession;
        // Start silent
        masterVol.gain.setValueAtTime(0, 0);

        // Settle-in fade-in ramp
        const settleInSec = ls.settleInMs / 1000;
        masterVol.gain.setValueAtTime(0, 0);
        masterVol.gain.linearRampToValueAtTime(
          config.params.volume,
          settleInSec,
        );

        // Integration fade-out ramp
        const integrationSec = ls.integrationMs / 1000;
        const fadeOutStart = config.durationSec - integrationSec;
        masterVol.gain.setValueAtTime(config.params.volume, fadeOutStart);
        masterVol.gain.linearRampToValueAtTime(0, config.durationSec);
      } else {
        masterVol.gain.setValueAtTime(config.params.volume, 0);
        // End fade-out on masterVol so tail doesn't clip
        masterVol.gain.setValueAtTime(
          config.params.volume,
          Math.max(0, config.durationSec - FADE_OUT_SEC),
        );
        masterVol.gain.linearRampToValueAtTime(0, config.durationSec);
      }

      // Schedule resolved bells on the master stem
      if (stem.id === 'master' && resolvedBells.length > 0) {
        for (const bell of resolvedBells) {
          const targetTime = bell.offsetMs / 1000;
          if (targetTime >= 0 && targetTime <= config.durationSec) {
            const audioBuffer = await BellLoader.loadBell(ctx, bell.bellId);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;

            const gainNode = ctx.createGain();
            gainNode.gain.setValueAtTime(bell.volume, targetTime);

            source.connect(gainNode).connect(masterVol);
            source.start(targetTime);
          }
        }
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
            loopBus.gain.setValueAtTime(slotConf.muted ? 0 : 1, 0);
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
          loopBus.gain.setValueAtTime(slotConf.muted ? 0 : 1, 0);
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

    let sonificationPlayer: SonificationPlayer | null = null;
    if (config.mode === 'sonification' && config.sonificationSpec) {
      sonificationPlayer = new SonificationPlayer(
        config.sonificationSpec,
        config.durationSec * 1000,
        1.0,
        false,
      );
    }

    const live: SharedParams = { ...config.params };

    // Register offline suspensions
    for (const t of driftCheckpoints(config.durationSec)) {
      ctx.suspend(t).then(() => {
        // 1. Advance engine detune walk deterministically
        if (activeEngine && drift.length > 0) {
          const { detunes, phases, r, psi } = driftStep(
            drift,
            {
              drift: live.drift,
              coupling: live.coupling,
              cluster: live.cluster,
            },
            DRIFT_DT,
            rng,
          );
          currentR = r ?? 0;
          drift.forEach((p, i) => {
            const d = detunes[i];
            if (d === undefined) return;
            p.detune = d;
            p.phase = phases[i];
            activeEngine.setPartialDetune(i, d);
          });
          const fusionAmount = live.fusion ?? 0;
          if (fusionAmount > 0) {
            activeEngine.setPartialFusionGains?.(
              fusionMultipliers(phases, psi, fusionAmount),
            );
          }
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
          const pieceTime = t;
          const resolved = resolvePieceStateAtTime(renderedPiece, pieceTime);
          Object.assign(live, resolved.params);
          activeEngine?.setSharedParams(resolved.params);
          if (stem.isFx && stemOutputNode) {
            const filter = stemOutputNode as BiquadFilterNode;
            filter.frequency.setValueAtTime(cutoffFor(live.brightness), t);
          }
        } else if (config.mode === 'sonification' && sonificationPlayer) {
          const stateFrame = sonificationPlayer.resolveStateAt(t);
          if (Object.keys(stateFrame.params).length > 0) {
            Object.assign(live, stateFrame.params);
            activeEngine?.setSharedParams(stateFrame.params);
            if (stem.isFx && stemOutputNode) {
              const filter = stemOutputNode as BiquadFilterNode;
              filter.frequency.setValueAtTime(cutoffFor(live.brightness), t);
            }
          }
          const engineUpdates = stateFrame.engineParams[config.engineId];
          if (engineUpdates && activeEngine) {
            activeEngine.setEngineParams(engineUpdates);
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

        if (sIdx === 0 && config.logOut) {
          const frequencies = activeEngine
            ? activeEngine.getPartialFrequencies()
            : [];
          const amplitudes = frequencies.map(
            (_freq: number, i: number) => 0.32 / (i + 1),
          );
          const driftPartials = drift.map((d) => d.detune);

          collectedRecords.push({
            timestamp: t,
            wallTime: new Date(startTimeMs + t * 1000).toISOString(),
            params: {
              rootFreq: live.rootFreq,
              spread: live.spread,
              density: live.density,
              coupling: live.coupling,
              drift: live.drift,
              brightness: live.brightness,
              space: live.space,
              volume: live.volume,
            },
            metadata: {
              mode:
                config.mode === 'open' || config.mode === 'arc'
                  ? config.mode
                  : 'piece',
              engineId: config.engineId,
              engineParams: config.engineParams,
              tuning: {
                system: live.tuning?.system ?? 'equal',
                referenceA4Hz: live.tuning?.referenceA4Hz ?? 440,
                sclId: live.tuning?.sclId,
              },
              schemaVersion: 'v20',
              logSchemaVersion: '1.0',
            },
            drift: {
              meanDetune:
                driftPartials.length > 0
                  ? driftPartials.reduce((a, b) => a + b, 0) /
                    driftPartials.length
                  : 0,
              orderParameter: currentR,
              partials: driftPartials,
            },
            partials: {
              frequencies,
              amplitudes,
            },
            features: {
              rms: 0,
              spectralCentroid: 0,
              spectralFlux: 0,
              zcr: 0,
            },
            event: collectedRecords.length === 0 ? 'session-start' : null,
          });
        }

        void ctx.resume();
      });
    }

    // Run OAC render pass
    const rendered = await ctx.startRendering();

    if (sIdx === 0 && config.logOut) {
      let prevMags: Float32Array | null = null;

      for (const r of collectedRecords) {
        const t = r.timestamp;
        const startSample = Math.floor(t * config.sampleRate);
        const blockSize = 1024;
        const timeData = new Float32Array(blockSize);
        const channelData = rendered.getChannelData(0); // Mono channel for feature extraction

        for (let s = 0; s < blockSize; s++) {
          const idx = startSample + s;
          timeData[s] = idx < channelData.length ? channelData[idx]! : 0;
        }

        // RMS
        let sumSq = 0;
        for (let s = 0; s < timeData.length; s++) {
          sumSq += timeData[s]! * timeData[s]!;
        }
        const rms = Math.sqrt(sumSq / timeData.length);

        // ZCR
        let crossings = 0;
        for (let s = 1; s < timeData.length; s++) {
          const prev = timeData[s - 1]!;
          const curr = timeData[s]!;
          if ((prev < 0 && curr >= 0) || (prev >= 0 && curr < 0)) {
            crossings++;
          }
        }
        const zcr = crossings / (timeData.length - 1);

        // Centroid & Flux
        const windowed = applyHannWindow(timeData);
        const { real, imag } = computeFFTSpectrum(windowed, 1);
        const magnitudes = getMagnitudeSpectrum(real, imag);
        const centroid = spectralCentroid(
          magnitudes,
          config.sampleRate,
          blockSize,
        );

        let flux = 0;
        if (prevMags && prevMags.length === magnitudes.length) {
          let diffSum = 0;
          for (let s = 0; s < magnitudes.length; s++) {
            const diff = magnitudes[s]! - prevMags[s]!;
            diffSum += diff * diff;
          }
          flux = Math.sqrt(diffSum) / magnitudes.length;
        }
        prevMags = magnitudes;

        r.features = {
          rms,
          spectralCentroid: centroid,
          spectralFlux: flux,
          zcr,
        };

        const logMode = config.logMode || 'standard';
        if (logMode === 'full' || logMode === 'research-extreme') {
          r.features.spectrum = Array.from(magnitudes).map(
            (val) => 20 * Math.log10(val + 1e-9),
          );
        }
        if (logMode === 'research-extreme') {
          r.audioChunk = Array.from(timeData);
        }
      }

      // Add stop record
      const lastT = config.durationSec;
      const lastRecord = {
        ...collectedRecords[collectedRecords.length - 1],
        timestamp: lastT,
        wallTime: new Date(startTimeMs + lastT * 1000).toISOString(),
        event: 'session-stop',
      };

      // Recompute features for lastRecord
      const startSample = Math.floor(lastT * config.sampleRate);
      const timeData = new Float32Array(1024);
      const channelData = rendered.getChannelData(0);
      for (let s = 0; s < 1024; s++) {
        const idx = startSample + s;
        timeData[s] = idx < channelData.length ? channelData[idx]! : 0;
      }
      let sumSq = 0;
      for (let s = 0; s < 1024; s++) sumSq += timeData[s]! * timeData[s]!;
      const rms = Math.sqrt(sumSq / 1024);
      let crossings = 0;
      for (let s = 1; s < 1024; s++) {
        const prev = timeData[s - 1]!;
        const curr = timeData[s]!;
        if ((prev < 0 && curr >= 0) || (prev >= 0 && curr < 0)) crossings++;
      }
      const zcr = crossings / 1023;
      const windowed = applyHannWindow(timeData);
      const { real, imag } = computeFFTSpectrum(windowed, 1);
      const magnitudes = getMagnitudeSpectrum(real, imag);
      const centroid = spectralCentroid(magnitudes, config.sampleRate, 1024);
      let flux = 0;
      if (prevMags && prevMags.length === magnitudes.length) {
        let diffSum = 0;
        for (let s = 0; s < magnitudes.length; s++) {
          const diff = magnitudes[s]! - prevMags[s]!;
          diffSum += diff * diff;
        }
        flux = Math.sqrt(diffSum) / magnitudes.length;
      }

      lastRecord.features = {
        rms,
        spectralCentroid: centroid,
        spectralFlux: flux,
        zcr,
      };
      if (config.logMode === 'full' || config.logMode === 'research-extreme') {
        lastRecord.features.spectrum = Array.from(magnitudes).map(
          (val) => 20 * Math.log10(val + 1e-9),
        );
      }
      if (config.logMode === 'research-extreme') {
        lastRecord.audioChunk = Array.from(timeData);
      }
      collectedRecords.push(lastRecord);

      // Format and write the datalog to file!
      const opts = {
        mode: (config.logMode || 'standard') as any,
        rateHz: config.logRate || 50,
        startTime: startTimeStr,
        endTime: new Date(startTimeMs + lastT * 1000).toISOString(),
        appVersion: '5.3.0',
        bridgeVersion: '1.0',
      };

      let logContent = '';
      if (config.logFormat === 'csv') {
        logContent = writeCSV(collectedRecords, opts);
      } else {
        logContent = writeJSONL(collectedRecords, opts);
      }

      if (typeof process !== 'undefined') {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const dir = path.dirname(config.logOut);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(config.logOut, logContent);
        console.log(
          `[datalog] Deterministic session log saved successfully to: ${config.logOut}`,
        );
      }
    }

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
