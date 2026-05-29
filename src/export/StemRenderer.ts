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
import type { Piece } from '@/piece/types';
import { interpolateState } from '@/piece/transitions';

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
  mode: 'open' | 'arc' | 'piece';
  piece?: Piece;
  arcId?: string;
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
  const resolvedStates = piece.segments.map((seg) => {
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
    } else {
      return {
        params: { ...defaults.params },
        engineId: defaults.engineId,
        engineParams: { ...defaults.engineParams },
      };
    }
  });

  for (let idx = 0; idx < piece.segments.length; idx++) {
    const seg = piece.segments[idx]!;
    const duration = seg.durationMs ?? 5000;
    if (
      seg.type === 'open' ||
      tMs < elapsed + duration ||
      idx === piece.segments.length - 1
    ) {
      if (seg.type === 'transition') {
        const prevIdx = idx - 1;
        const nextIdx = idx + 1;
        const prevState =
          prevIdx >= 0 ? resolvedStates[prevIdx]! : (defaults as any);
        const nextState =
          nextIdx < piece.segments.length
            ? resolvedStates[nextIdx]!
            : (defaults as any);
        const progress = duration > 0 ? (tMs - elapsed) / duration : 1.0;
        return interpolateState(
          prevState,
          nextState,
          Math.min(1.0, progress),
          seg.config.easing || 'linear',
        );
      } else {
        return resolvedStates[idx]!;
      }
    }
    elapsed += duration;
  }

  return resolvedStates[resolvedStates.length - 1]!;
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
  if (config.mode === 'piece') {
    stems = stems.filter((s) => s.id === 'master');
  }

  const totalStems = stems.length;

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
      masterVol.gain.value = config.params.volume;

      filter.connect(dry).connect(master);
      filter.connect(convolver).connect(wet).connect(master);
      master.connect(masterVol).connect(ctx.destination);

      stemOutputNode = filter;

      // End fade-out on masterVol so tail doesn't clip
      masterVol.gain.setValueAtTime(
        config.params.volume,
        Math.max(0, config.durationSec - FADE_OUT_SEC),
      );
      masterVol.gain.linearRampToValueAtTime(0, config.durationSec);

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
        } else if (config.mode === 'piece' && config.piece) {
          const resolved = resolvePieceStateAtTime(config.piece, t);
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
