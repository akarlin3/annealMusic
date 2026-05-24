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

/**
 * Owns the audio context, the shared post-fx chain, the drift loop, and the
 * active engine's lifecycle. Engines plug into a single point (their output
 * node routes into the post-fx filter); the orchestrator pushes per-partial
 * detune into the active engine so drift stays engine-agnostic. Knows nothing
 * about React.
 */
export class Orchestrator {
  private shared: SharedParams;
  private engineId: EngineId;
  private engineParams: Partial<Record<EngineId, EngineParams>>;
  private readonly factories: Partial<Record<EngineId, EngineFactory>>;

  private ctx: AudioContext | null = null;
  private nodes: GraphNodes | null = null;
  private engine: AnnealEngine | null = null;
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
    return this.engine?.getPartialCount() ?? 0;
  }

  getPartialFrequencies(): number[] {
    return this.engine?.getPartialFrequencies() ?? [];
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

    const master = ctx.createGain();
    master.gain.value = 0;

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

    const engine = this.makeEngine(this.engineId);
    engine.start(ctx, p, this.engineParams[this.engineId] ?? {});
    engine.getOutputNode().connect(filter);

    filter.connect(dryGain).connect(master);
    filter.connect(convolver).connect(wetGain).connect(master);
    master.connect(masterVol).connect(analyser);
    analyser.connect(ctx.destination);

    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(1.0, ctx.currentTime + FADE_IN_SECONDS);

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
    this.engine = engine;
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
      const engine = this.engine;
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

  /** Fade out, stop the engine, and close the context. Resolves after teardown. */
  stop(): Promise<void> {
    const ctx = this.ctx;
    const nodes = this.nodes;
    const engine = this.engine;

    this.stopDrift();
    this.running = false;
    this.ctx = null;
    this.nodes = null;
    this.engine = null;
    this.driftState = [];

    if (!ctx || !nodes || !engine) return Promise.resolve();

    try {
      nodes.master.gain.cancelScheduledValues(ctx.currentTime);
      nodes.master.gain.setTargetAtTime(0, ctx.currentTime, FADE_OUT_TC);
    } catch {
      // ignore scheduling errors during teardown
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        void engine.stop(0);
        ctx
          .close()
          .catch(() => undefined)
          .finally(() => resolve());
      }, TEARDOWN_MS);
    });
  }

  /** Apply live shared-param updates: post-fx here, voice freqs to the engine. */
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
      this.engine?.setSharedParams({
        rootFreq: p.rootFreq,
        spread: p.spread,
      });
    }
  }

  /** Update the active engine's engine-specific params (and remember them). */
  setEngineParams(partial: Partial<EngineParams>): void {
    this.engineParams = {
      ...this.engineParams,
      [this.engineId]: { ...this.engineParams[this.engineId], ...partial },
    };
    this.engine?.setEngineParams(partial);
  }

  /**
   * Select the active engine. When stopped, this is remembered for the next
   * start. While running, swapping to a *different* engine crossfades (CP2);
   * swapping to the same engine is a no-op (no rebuild, no audible dip).
   */
  setEngine(id: EngineId): void {
    this.engineId = id;
    if (!this.running) return;
    if (this.engine?.id === id) return;
    // Crossfade between distinct engines lands in CP2. With only `sine`
    // registered in CP1 this branch is unreachable.
  }
}
