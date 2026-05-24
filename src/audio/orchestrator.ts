import { driftStep } from '@/audio/drift';
import { makeIR } from '@/audio/ir';
import { ENGINES, makeDefaultEngineParams } from '@/audio/engines/index';
import type { EngineFactory } from '@/audio/engines/index';
import type {
  AnnealEngine,
  EngineId,
  EngineParams,
  SharedParams,
} from '@/audio/engines/types';
import { HARMONICS, type DriftPartial, type GraphNodes } from '@/types/audio';

const FADE_IN_SECONDS = 3.0;
const FADE_OUT_TC = 0.6;
const TEARDOWN_MS = 2200;
const CROSSFADE_SECONDS = 0.6;
const CROSSFADE_MS = 600;
const DRIFT_INTERVAL_MS = 50;
const DRIFT_DT = 0.05;

/** Map brightness (0..1) to the lowpass cutoff frequency. */
function cutoffFor(brightness: number): number {
  return 200 * Math.pow(30, brightness);
}

interface WebkitWindow {
  webkitAudioContext?: typeof AudioContext;
}

function createAudioContext(): AudioContext {
  const Ctor =
    window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!Ctor) throw new Error('Web Audio API is not supported in this browser');
  return new Ctor();
}

/** An active engine plus the orchestrator-owned gain stage that fades it. */
interface Voice {
  readonly engine: AnnealEngine;
  readonly bus: GainNode;
}

/**
 * Owns the audio context, the shared post-fx chain, the drift loop, and engine
 * lifecycle + crossfade. Each engine routes through its own bus gain into the
 * shared post-fx filter; on an engine swap the orchestrator runs both engines
 * briefly in parallel and equal-gain crossfades between their buses. Drift is
 * engine-agnostic: the orchestrator keeps a pure detune state and pushes it to
 * the active engine via `setPartialDetune`. Knows nothing about React.
 */
export class Orchestrator {
  private shared: SharedParams;
  private engineId: EngineId;
  private engineParams: Partial<Record<EngineId, EngineParams>>;
  private readonly factories: Partial<Record<EngineId, EngineFactory>>;

  private ctx: AudioContext | null = null;
  private nodes: GraphNodes | null = null;
  private active: Voice | null = null;
  private outgoing: Voice | null = null;
  private swapTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSwap: EngineId | null = null;
  private driftState: DriftPartial[] = [];
  private driftTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    shared: SharedParams,
    engineId: EngineId = 'sine',
    engineParams: Partial<
      Record<EngineId, EngineParams>
    > = makeDefaultEngineParams(),
    factories: Partial<Record<EngineId, EngineFactory>> = ENGINES,
  ) {
    this.shared = { ...shared };
    this.engineId = engineId;
    this.engineParams = { ...engineParams };
    this.factories = factories;
  }

  isRunning(): boolean {
    return this.running;
  }

  getEngineId(): EngineId {
    return this.engineId;
  }

  getAnalyser(): AnalyserNode | null {
    return this.nodes?.analyser ?? null;
  }

  getPartialCount(): number {
    return this.active?.engine.getPartialCount() ?? 0;
  }

  getPartialFrequencies(): number[] {
    return this.active?.engine.getPartialFrequencies() ?? [];
  }

  private makeEngine(id: EngineId): AnnealEngine {
    const factory = this.factories[id];
    if (!factory) throw new Error(`unknown engine: ${id}`);
    return factory();
  }

  /** Build the post-fx chain, start the active engine, fade in, begin drift. */
  start(): void {
    if (this.running) return;

    const ctx = createAudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const p = this.shared;

    // The mix bus is static at unity; amplitude fades live on per-engine buses.
    const master = ctx.createGain();
    master.gain.value = 1;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoffFor(p.brightness);
    filter.Q.value = 0.6;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.85;

    const convolver = ctx.createConvolver();
    convolver.buffer = makeIR(ctx, 4.0, 2.4);
    const wetGain = ctx.createGain();
    wetGain.gain.value = p.space;
    const dryGain = ctx.createGain();
    dryGain.gain.value = 1 - p.space * 0.4;

    const masterVol = ctx.createGain();
    masterVol.gain.value = p.volume;

    filter.connect(dryGain).connect(master);
    filter.connect(convolver).connect(wetGain).connect(master);
    master.connect(masterVol).connect(analyser);
    analyser.connect(ctx.destination);

    this.ctx = ctx;
    this.nodes = {
      master,
      masterVol,
      filter,
      analyser,
      convolver,
      wetGain,
      dryGain,
    };

    // Build the first engine and fade its bus in over the long "bloom".
    const engine = this.makeEngine(this.engineId);
    engine.start(ctx, p, this.engineParams[this.engineId] ?? {});
    const bus = ctx.createGain();
    bus.gain.value = 0;
    engine.getOutputNode().connect(bus);
    bus.connect(filter);
    bus.gain.setValueAtTime(0, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(1.0, ctx.currentTime + FADE_IN_SECONDS);

    this.active = { engine, bus };
    this.running = true;

    this.seedDrift(engine.getPartialCount());
    this.startDrift();
  }

  /** Seed the orchestrator's pure drift state to match the engine's partials. */
  private seedDrift(count: number): void {
    this.driftState = Array.from({ length: count }, (_, i) => ({
      // `ratio` is carried for forward-compat; `driftStep` does not read it.
      ratio: HARMONICS[i] ?? 1,
      detune: 0,
    }));
  }

  private startDrift(): void {
    this.driftTimer = setInterval(() => {
      const engine = this.active?.engine;
      if (!engine || this.driftState.length === 0) return;
      const next = driftStep(
        this.driftState,
        { drift: this.shared.drift, coupling: this.shared.coupling },
        DRIFT_DT,
        Math.random,
      );
      this.driftState.forEach((part, i) => {
        const detune = next[i];
        if (detune === undefined) return;
        part.detune = detune;
        engine.setPartialDetune(i, detune);
      });
    }, DRIFT_INTERVAL_MS);
  }

  private stopDrift(): void {
    if (this.driftTimer !== null) clearInterval(this.driftTimer);
    this.driftTimer = null;
  }

  /** Fade out, stop the engine(s), and close the context. Resolves after teardown. */
  stop(): Promise<void> {
    const ctx = this.ctx;
    const voices = [this.active, this.outgoing].filter(
      (v): v is Voice => v !== null,
    );

    this.stopDrift();
    if (this.swapTimer !== null) clearTimeout(this.swapTimer);
    this.swapTimer = null;
    this.pendingSwap = null;
    this.running = false;
    this.ctx = null;
    this.nodes = null;
    this.active = null;
    this.outgoing = null;
    this.driftState = [];

    if (!ctx || voices.length === 0) return Promise.resolve();

    for (const v of voices) {
      try {
        v.bus.gain.cancelScheduledValues(ctx.currentTime);
        v.bus.gain.setTargetAtTime(0, ctx.currentTime, FADE_OUT_TC);
      } catch {
        // ignore scheduling errors during teardown
      }
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        for (const v of voices) void v.engine.stop(0);
        ctx
          .close()
          .catch(() => undefined)
          .finally(() => resolve());
      }, TEARDOWN_MS);
    });
  }

  /** Apply live shared-param updates: post-fx here, voice freqs to the engines. */
  setSharedParams(partial: Partial<SharedParams>): void {
    this.shared = { ...this.shared, ...partial };

    const ctx = this.ctx;
    const nodes = this.nodes;
    if (!ctx || !nodes) return;

    const t = ctx.currentTime;
    const p = this.shared;

    if (partial.brightness !== undefined) {
      nodes.filter.frequency.setTargetAtTime(cutoffFor(p.brightness), t, 0.25);
    }
    if (partial.space !== undefined) {
      nodes.wetGain.gain.setTargetAtTime(p.space, t, 0.3);
      nodes.dryGain.gain.setTargetAtTime(1 - p.space * 0.4, t, 0.3);
    }
    if (partial.volume !== undefined) {
      nodes.masterVol.gain.setTargetAtTime(p.volume, t, 0.2);
    }
    if (partial.rootFreq !== undefined || partial.spread !== undefined) {
      // Forward to both engines so a mid-crossfade engine doesn't jump in pitch.
      const voiceUpdate = { rootFreq: p.rootFreq, spread: p.spread };
      this.active?.engine.setSharedParams(voiceUpdate);
      this.outgoing?.engine.setSharedParams(voiceUpdate);
    }
  }

  /** Update the active engine's engine-specific params (and remember them). */
  setEngineParams(partial: Partial<EngineParams>): void {
    this.engineParams = {
      ...this.engineParams,
      [this.engineId]: { ...this.engineParams[this.engineId], ...partial },
    };
    this.active?.engine.setEngineParams(partial);
  }

  /**
   * Select the active engine. When stopped, this is remembered for the next
   * start. While running, swapping to a *different* engine crossfades; swapping
   * to the same engine is a no-op (no rebuild, no audible dip).
   */
  setEngine(id: EngineId): void {
    if (!this.running) {
      this.engineId = id;
      return;
    }
    if (this.active?.engine.id === id) {
      // Already (becoming) this engine — cancel any queued swap back away.
      this.pendingSwap = null;
      return;
    }
    this.crossfadeTo(id);
  }

  /** Build the incoming engine and equal-gain crossfade from the active one. */
  private crossfadeTo(id: EngineId): void {
    const ctx = this.ctx;
    const nodes = this.nodes;
    const active = this.active;
    if (!ctx || !nodes || !active) return;

    // A swap is already in flight: coalesce to the latest requested target.
    if (this.outgoing) {
      this.pendingSwap = id;
      return;
    }

    const engine = this.makeEngine(id);
    engine.start(ctx, this.shared, this.engineParams[id] ?? {});
    const bus = ctx.createGain();
    bus.gain.value = 0;
    engine.getOutputNode().connect(bus);
    bus.connect(nodes.filter);

    // Carry the current detune so the texture is continuous across the swap.
    // Density is shared + locked while playing, so partial counts always match.
    this.driftState.forEach((part, i) =>
      engine.setPartialDetune(i, part.detune),
    );

    const t0 = ctx.currentTime;
    active.bus.gain.cancelScheduledValues(t0);
    active.bus.gain.setValueAtTime(active.bus.gain.value, t0);
    active.bus.gain.linearRampToValueAtTime(0, t0 + CROSSFADE_SECONDS);
    bus.gain.setValueAtTime(0, t0);
    bus.gain.linearRampToValueAtTime(1, t0 + CROSSFADE_SECONDS);

    this.outgoing = active;
    this.active = { engine, bus };
    this.engineId = id;

    this.swapTimer = setTimeout(() => {
      this.swapTimer = null;
      const out = this.outgoing;
      this.outgoing = null;
      if (out) {
        void out.engine.stop(0.02);
        out.bus.disconnect();
      }
      const queued = this.pendingSwap;
      this.pendingSwap = null;
      if (queued && queued !== this.active?.engine.id) this.crossfadeTo(queued);
    }, CROSSFADE_MS);
  }
}
