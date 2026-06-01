/**
 * Client-side offline render of a saved patch (the v1.0 recommendation: no
 * server cost). Renders deterministically into an `OfflineAudioContext` at
 * faster-than-realtime, reusing the *real* engine DSP, the pure `driftStep`
 * math, the `ArcRunner`, and the reverb IR — so an offline render sounds like
 * the live session, just without a live performance.
 *
 * Drift and arc evolution are JS-driven, so we step them at audio-time
 * checkpoints via `OfflineAudioContext.suspend(t)` → mutate → `resume()`, the
 * standard way to script parameter automation in an offline render.
 *
 * Fallback chain (see docs/RECORDING.md): if the device lacks
 * `OfflineAudioContext` or AudioWorklet (physical patches), the caller falls
 * back to the v0.8 server render. This module owns only the client path.
 */
import { makeIR, setupConvolverBuffer } from '@/audio/ir';
import { cutoffFor } from '@/audio/orchestrator';
import { ENGINES } from '@/audio/engines/index';
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
import { engineCapabilities } from '@/audio/engines/index';
import { HARMONICS, type DriftPartial } from '@/types/audio';

const DRIFT_DT = 0.05;
const DRIFT_INTERVAL_SEC = 0.05;
const FADE_IN_SEC = 3.0;
const FADE_OUT_SEC = 4.0;

/** Default render length for open (non-arc) patches. */
export const DEFAULT_OPEN_RENDER_SEC = 5 * 60;

interface WebkitWindow {
  webkitAudioContext?: typeof AudioContext;
}

export interface OfflineRenderConfig {
  params: SharedParams;
  engineId: EngineId;
  engineParams: EngineParams;
  /** 'open' renders `durationSec`; 'arc' renders the arc to completion. */
  mode: 'open' | 'arc';
  arcId?: string;
  durationSec: number;
  sampleRate?: number;
}

export type OfflineContextFactory = (
  channels: number,
  frames: number,
  sampleRate: number,
) => OfflineAudioContext;

const defaultOfflineFactory: OfflineContextFactory = (ch, frames, sr) =>
  new OfflineAudioContext(ch, frames, sr);

/** True when this browser can render offline at all. */
export function isOfflineRenderSupported(): boolean {
  return typeof OfflineAudioContext !== 'undefined';
}

/**
 * Compute the audio-time checkpoints at which to advance drift/arc. Pure +
 * exported so the stepping cadence is unit-testable without a real render.
 */
export function driftCheckpoints(durationSec: number): number[] {
  const out: number[] = [];
  for (let t = DRIFT_INTERVAL_SEC; t < durationSec; t += DRIFT_INTERVAL_SEC) {
    out.push(Number(t.toFixed(4)));
  }
  return out;
}

/**
 * Render the patch to an `AudioBuffer`. Reuses the live engine + drift + IR, so
 * the output matches the live session's character (and an arc's envelope).
 */
export async function renderOffline(
  config: OfflineRenderConfig,
  factory: OfflineContextFactory = defaultOfflineFactory,
  engineFactories: Partial<Record<EngineId, EngineFactory>> = ENGINES,
): Promise<AudioBuffer> {
  let defaultSampleRate = 48000;
  if (typeof window !== 'undefined') {
    const Ctor =
      window.AudioContext ??
      (window as unknown as WebkitWindow).webkitAudioContext;
    if (Ctor) {
      try {
        const tempCtx = new Ctor();
        defaultSampleRate = tempCtx.sampleRate;
        void tempCtx.close();
      } catch {
        // ignore
      }
    }
  }
  const sampleRate = config.sampleRate ?? defaultSampleRate;
  const durationSec =
    config.mode === 'arc' ? config.durationSec : config.durationSec;
  const frames = Math.ceil(durationSec * sampleRate);
  const ctx = factory(2, frames, sampleRate);

  // Post-fx chain mirroring the live orchestrator (filter → dry/wet reverb).
  const master = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoffFor(config.params.brightness);
  filter.Q.value = 0.6;
  const convolver = ctx.createConvolver();
  await setupConvolverBuffer(
    ctx as unknown as BaseAudioContext,
    convolver,
    makeIR(ctx as unknown as AudioContext, 4.0, 2.4),
  );
  const wet = ctx.createGain();
  wet.gain.value = config.params.space;
  const dry = ctx.createGain();
  dry.gain.value = 1 - config.params.space * 0.4;
  const masterVol = ctx.createGain();
  masterVol.gain.value = config.params.volume;

  filter.connect(dry).connect(master);
  filter.connect(convolver).connect(wet).connect(master);
  master.connect(masterVol).connect(ctx.destination);

  // Engine voice + bus fade-in (the long "bloom").
  const make = engineFactories[config.engineId];
  if (!make) throw new Error(`unknown engine: ${config.engineId}`);
  const engine = make();
  engine.start(
    ctx as unknown as AudioContext,
    config.params,
    config.engineParams,
  );
  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0, 0);
  bus.gain.linearRampToValueAtTime(1, FADE_IN_SEC);
  engine.getOutputNode().connect(bus);
  bus.connect(filter);

  // End fade-out so the tail doesn't clip.
  masterVol.gain.setValueAtTime(
    config.params.volume,
    Math.max(0, durationSec - FADE_OUT_SEC),
  );
  masterVol.gain.linearRampToValueAtTime(0, durationSec);

  // Drift + arc state.
  const drift: DriftPartial[] = Array.from(
    { length: engine.getPartialCount() },
    (_, i) => ({ ratio: HARMONICS[i] ?? 1, detune: 0 }),
  );
  let arc: ArcRunner | null = null;
  if (config.mode === 'arc' && config.arcId) {
    const def = getArcById(config.arcId);
    if (def) {
      arc = new ArcRunner(
        def,
        durationSec,
        config.params,
        engineCapabilities(config.engineId),
      );
    }
  }
  const live: SharedParams = { ...config.params };

  // Schedule the drift/arc steps at audio-time checkpoints.
  for (const t of driftCheckpoints(durationSec)) {
    ctx.suspend(t).then(() => {
      const { detunes, phases, psi } = driftStep(
        drift,
        { drift: live.drift, coupling: live.coupling, cluster: live.cluster },
        DRIFT_DT,
        Math.random,
      );
      drift.forEach((p, i) => {
        const d = detunes[i];
        if (d === undefined) return;
        p.detune = d;
        p.phase = phases[i];
        engine.setPartialDetune(i, d);
      });
      const fusionAmount = live.fusion ?? 0;
      if (fusionAmount > 0) {
        engine.setPartialFusionGains?.(
          fusionMultipliers(phases, psi, fusionAmount),
        );
      }
      if (arc) {
        const frame = arc.tick(t);
        if (Object.keys(frame.params).length > 0) {
          Object.assign(live, frame.params);
          engine.setSharedParams(frame.params);
          filter.frequency.setValueAtTime(cutoffFor(live.brightness), t);
          wet.gain.setValueAtTime(live.space, t);
          dry.gain.setValueAtTime(1 - live.space * 0.4, t);
        }
      }
      void ctx.resume();
    });
  }

  const rendered = await ctx.startRendering();
  await engine.stop(0);
  return rendered;
}
