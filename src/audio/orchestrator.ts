/* eslint-disable @typescript-eslint/no-explicit-any */
import { driftStep } from '@/audio/drift';
import { fusionMultipliers } from '@/audio/fusion';
import { makeIR } from '@/audio/ir';
import { midiOutput } from '@/midi/outputController';
import { clampSharedParamsForDrone } from '@/drone/ModeConstraints';
import {
  ENGINES,
  engineCapabilities,
  makeDefaultEngineParams,
} from '@/audio/engines/index';
import type { EngineFactory } from '@/audio/engines/index';
import type {
  AnnealEngine,
  EngineId,
  EngineParams,
  SharedParams,
} from '@/audio/engines/types';
import { ArcRunner } from '@/session/ArcRunner';
import { getArcById } from '@/session/arcs';
import type { SessionState } from '@/session/types';
import { InputVoice } from '@/input/InputVoice';
import type { ConnectResult } from '@/input/types';
import { LoopSlot } from '@/loop/LoopSlot';
import {
  SLOT_IDS,
  makeDefaultLoopConfig,
  type GrainParams,
  type LoopConfigMap,
  type SlotId,
  type SlotState,
} from '@/loop/types';
import { HARMONICS, type DriftPartial, type GraphNodes } from '@/types/audio';

const FADE_IN_SECONDS = 3.0;
const FADE_OUT_TC = 0.6;
const TEARDOWN_MS = 2200;
const CROSSFADE_MS = 600;
const DRIFT_INTERVAL_MS = 50;
const DRIFT_DT = 0.05;
const ARC_TICK_MS = 50;
const ARC_END_FADE_SECONDS = 4.0;
const ARC_END_FADE_MS = 4000;
/** Normalizes mean detune (cents) to −1..1 for loop drift coupling. */
const LOOP_DRIFT_NORM = 60;

/** Options for starting a session: open jam, or a scripted arc. */
export type StartSessionOptions =
  | { mode: 'open' }
  | { mode: 'arc'; arcId: string; durationSec: number };

/** Live arc progress for the UI (null when no arc is running/ending). */
export interface ArcProgress {
  progress: number;
  segmentIndex: number;
  remainingSec: number;
}

/** Map brightness (0..1) to the lowpass cutoff frequency. */
export function cutoffFor(brightness: number): number {
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
  private mode: 'sketch' | 'drone' = 'sketch';

  private ctx: AudioContext | null = null;
  private nodes: GraphNodes | null = null;
  private active: Voice | null = null;
  private outgoing: Voice | null = null;
  private swapTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSwap: EngineId | null = null;
  private driftState: DriftPartial[] = [];
  private driftTimer: ReturnType<typeof setInterval> | null = null;
  private currentR = 0;
  /** True while fusion is actively reshaping gains, so we can reset to unity
   *  exactly once when fusion is turned back off. */
  private fusionEngaged = false;
  private running = false;
  private tempoBpm: number | null = null;
  private playStartAudioTime = 0;

  // Live input voice (mic / line-in), independent of the session lifecycle.
  private inputVoice: InputVoice | null = null;

  // Loop pedal: 3 slots summing into a shared loop bus, independent of session.
  private loopConfig: LoopConfigMap;
  private loopSlots: Record<SlotId, LoopSlot> | null = null;

  // Session state machine + arc.
  private sessionState: SessionState = 'idle';
  private readonly listeners = new Set<(s: SessionState) => void>();
  private arcRunner: ArcRunner | null = null;
  private arcTimer: ReturnType<typeof setInterval> | null = null;
  private arcEndTimer: ReturnType<typeof setTimeout> | null = null;
  private arcT0 = 0;
  private arcDurationSec = 0;
  private arcProgress = { progress: 0, segmentIndex: 0 };
  private applyArcParams: ((p: Partial<SharedParams>) => void) | null = null;

  /** Sink for engine errors (e.g. physical worklet unsupported/failed). */
  private onEngineError: ((error: Error) => void) | null = null;

  constructor(
    shared: SharedParams,
    engineId: EngineId = 'sine',
    engineParams: Partial<
      Record<EngineId, EngineParams>
    > = makeDefaultEngineParams(),
    factories: Partial<Record<EngineId, EngineFactory>> = ENGINES,
    loopConfig: LoopConfigMap = makeDefaultLoopConfig(),
  ) {
    this.shared = { ...shared };
    this.engineId = engineId;
    this.engineParams = { ...engineParams };
    this.factories = factories;
    this.loopConfig = loopConfig;
  }

  setMode(mode: 'sketch' | 'drone'): void {
    this.mode = mode;
    if (mode === 'drone') {
      const clamped = clampSharedParamsForDrone(this.shared);
      this.setSharedParams(clamped);
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  setTempoBpm(bpm: number | null): void {
    this.tempoBpm = bpm;
    if (this.ctx) {
      (this.ctx as any)._tempoBpm = bpm;
    }
    midiOutput.setPieceTempo(bpm);
    if (this.active?.engine && 'setTempo' in this.active.engine) {
      (this.active.engine as any).setTempo(bpm);
    }
    if (this.outgoing?.engine && 'setTempo' in this.outgoing.engine) {
      (this.outgoing.engine as any).setTempo(bpm);
    }
  }

  /** Register a sink for engine errors (React wires this to a toast). */
  setEngineErrorHandler(fn: (error: Error) => void): void {
    this.onEngineError = fn;
  }

  private makeEngineWithErrors(id: EngineId): AnnealEngine {
    const engine = this.makeEngine(id);
    engine.setErrorHandler?.((error) => this.onEngineError?.(error));
    return engine;
  }

  getSessionState(): SessionState {
    return this.sessionState;
  }

  /** Subscribe to session-state changes. Returns an unsubscribe function. */
  subscribe(fn: (s: SessionState) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Live arc progress, or null when no arc is running or ending. */
  getArcProgress(): ArcProgress | null {
    if (
      this.sessionState !== 'playing-patch' &&
      this.sessionState !== 'stopping'
    ) {
      return null;
    }
    if (this.arcDurationSec <= 0) return null;
    return {
      progress: this.arcProgress.progress,
      segmentIndex: this.arcProgress.segmentIndex,
      remainingSec: Math.max(
        0,
        this.arcDurationSec * (1 - this.arcProgress.progress),
      ),
    };
  }

  getEngineId(): EngineId {
    return this.engineId;
  }

  getAnalyser(): AnalyserNode | null {
    return this.nodes?.analyser ?? null;
  }

  /**
   * A tap on the post-fx master output (post-volume), for realtime recording.
   * This is exactly "what the user hears" — engine(s), live input, and loops all
   * sum through here. Returns null until the audio core exists. The caller owns
   * disconnecting whatever it attaches to the returned node.
   */
  getRecordingTap(): { ctx: AudioContext; node: AudioNode } | null {
    if (!this.ctx || !this.nodes) return null;
    return { ctx: this.ctx, node: this.nodes.masterVol };
  }

  getPartialCount(): number {
    return this.active?.engine.getPartialCount() ?? 0;
  }

  /**
   * v6.2: suspend the audio context so a lesson audio clip can play through the
   * user's speakers without the live engine fighting it. Returns true only if
   * this call actually suspended a running context, so the caller knows whether
   * a later {@link resumeAudio} should restore it (it must not resume a context
   * the user had already paused). Idempotent and safe before the core exists.
   */
  async suspendAudio(): Promise<boolean> {
    if (this.ctx && this.ctx.state === 'running') {
      await this.ctx.suspend();
      return true;
    }
    return false;
  }

  /** Resume a context this orchestrator previously suspended. Idempotent. */
  async resumeAudio(): Promise<boolean> {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
      return true;
    }
    return false;
  }

  /**
   * Current audio clock in seconds, or 0 before the context exists. Used by the
   * breath overlay so its cycle is driven by `AudioContext.currentTime` (which
   * keeps advancing while a tab is backgrounded) rather than wall-clock/RAF.
   */
  getAudioTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  getPartialFrequencies(): number[] {
    return this.active?.engine.getPartialFrequencies() ?? [];
  }

  getOrderParameter(): number {
    return this.currentR;
  }

  /** The live input voice, or null when input has never been connected. */
  getInputVoice(): InputVoice | null {
    return this.inputVoice;
  }

  getActiveEngine(): AnnealEngine | null {
    return this.active?.engine ?? null;
  }

  getActiveVoiceBus(): GainNode | null {
    return this.active?.bus ?? null;
  }

  getNodes(): GraphNodes | null {
    return this.nodes;
  }

  getSharedParams(): SharedParams {
    return { ...this.shared };
  }

  getEngineParams(): Record<string, any> {
    return this.engineParams[this.engineId] ?? {};
  }

  getPartialDetunes(): number[] {
    return this.driftState.map((d) => d.detune);
  }

  /**
   * Connect (or switch device on) the live input. Builds the audio core if
   * needed, routes the input voice into the shared post-fx, and ensures the
   * drift loop runs so the input filter breathes even before a session starts.
   * Independent of session state — input survives Begin/Settle and engine swaps.
   */
  async connectInput(deviceId?: string): Promise<ConnectResult> {
    const { ctx, nodes } = this.ensureCore();
    const firstTime = this.inputVoice === null;
    const voice = this.inputVoice ?? new InputVoice(ctx);
    if (firstTime) {
      this.inputVoice = voice;
      voice.getOutputNode().connect(nodes.filter);
    }

    try {
      const result = await voice.connect(deviceId);
      if (this.driftState.length === 0) {
        this.seedDrift(
          this.active?.engine.getPartialCount() ?? this.shared.density,
        );
      }
      this.startDrift();
      return result;
    } catch (err) {
      // A failed first connect leaves no audible input; drop it so a retry is clean.
      if (firstTime && !voice.isConnected()) {
        try {
          voice.getOutputNode().disconnect();
        } catch {
          // already detached
        }
        this.inputVoice = null;
        this.teardownCore();
      }
      throw err;
    }
  }

  /** Disconnect the live input; closes the core if no session is running. */
  async disconnectInput(): Promise<void> {
    const voice = this.inputVoice;
    if (!voice) return;
    this.inputVoice = null;
    try {
      voice.getOutputNode().disconnect();
    } catch {
      // already detached
    }
    await voice.disconnect();
    if (!this.running) this.teardownCore();
  }

  private makeEngine(id: EngineId): AnnealEngine {
    const factory = this.factories[id];
    if (!factory) throw new Error(`unknown engine: ${id}`);
    return factory();
  }

  /**
   * Build (once) the long-lived audio core: the `AudioContext` + shared post-fx
   * chain. Decoupled from the session lifecycle so the live input can feed the
   * same post-fx before any engine runs and survive session stop (the input must
   * share the engine's context — nodes can't connect across contexts).
   */
  private ensureCore(): { ctx: AudioContext; nodes: GraphNodes } {
    if (this.ctx && this.nodes) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return { ctx: this.ctx, nodes: this.nodes };
    }

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
    this.ensureLoopSlots(ctx, this.nodes);
    return { ctx, nodes: this.nodes };
  }

  /** Build the loop bus + 3 slots once, routing the bus into the post-fx chain. */
  private ensureLoopSlots(ctx: AudioContext, nodes: GraphNodes): void {
    if (this.loopSlots) return;
    // Three 60s buffers can reach ~70 MB; warn (don't crash) on low-memory hints.
    const deviceMemory = (navigator as { deviceMemory?: number }).deviceMemory;
    if (typeof deviceMemory === 'number' && deviceMemory <= 2) {
      console.warn(
        `[loop] low device memory (~${deviceMemory} GB): long loop captures may be constrained`,
      );
    }
    const loopBus = ctx.createGain();
    loopBus.gain.value = 1;
    loopBus.connect(nodes.filter);
    this.loopSlots = {
      A: new LoopSlot('A', ctx, loopBus, this.loopConfig.A),
      B: new LoopSlot('B', ctx, loopBus, this.loopConfig.B),
      C: new LoopSlot('C', ctx, loopBus, this.loopConfig.C),
    };
  }

  /** True when any loop slot holds a buffer or is mid-capture/arm. */
  private loopsActive(): boolean {
    if (!this.loopSlots) return false;
    return SLOT_IDS.some((id) => {
      const s = this.loopSlots?.[id].getState();
      return s !== undefined && s !== 'empty';
    });
  }

  /** Close + drop the audio core. Only safe when no engine, input, or loop is live. */
  private teardownCore(): void {
    if (
      this.running ||
      (this.inputVoice?.isConnected() ?? false) ||
      this.loopsActive()
    ) {
      return;
    }
    this.stopDrift();
    this.driftState = [];
    if (this.loopSlots) {
      for (const id of SLOT_IDS) this.loopSlots[id].dispose();
    }
    this.loopSlots = null;
    const ctx = this.ctx;
    this.ctx = null;
    this.nodes = null;
    if (ctx) void ctx.close().catch(() => undefined);
  }

  /**
   * Build the audio core (if needed), start the active engine, fade in, begin
   * drift. Returns false if the engine can't start on this device (e.g. physical
   * with no AudioWorklet) so the caller can avoid entering a running state.
   */
  start(): boolean {
    if (this.running) return true;

    const { ctx, nodes } = this.ensureCore();
    const p = this.shared;

    this.playStartAudioTime = ctx.currentTime;
    (ctx as any)._tempoBpm = this.tempoBpm;
    midiOutput.setPieceTempo(this.tempoBpm);

    // Build the first engine and fade its bus in over the long "bloom".
    const engine = this.makeEngineWithErrors(this.engineId);
    try {
      if ('setTempo' in engine) {
        (engine as any).setTempo(this.tempoBpm);
      }
      engine.start(ctx, p, this.engineParams[this.engineId] ?? {});
    } catch (err) {
      // An engine that can't run on this device (e.g. physical with no
      // AudioWorklet) must not leave a half-built session. Surface + abort.
      this.onEngineError?.(err instanceof Error ? err : new Error(String(err)));
      this.teardownCore();
      return false;
    }
    const bus = ctx.createGain();
    bus.gain.value = 0;
    engine.getOutputNode().connect(bus);
    bus.connect(nodes.filter);
    bus.gain.setValueAtTime(0, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(1.0, ctx.currentTime + FADE_IN_SECONDS);

    this.active = { engine, bus };
    this.running = true;

    this.seedDrift(engine.getPartialCount());
    this.startDrift();
    return true;
  }

  /** Seed the orchestrator's pure drift state to match the engine's partials. */
  private seedDrift(count: number): void {
    const spread = 0.5;
    this.driftState = Array.from({ length: count }, (_, i) => {
      const phase = Math.random() * Math.PI * 2;
      const naturalFreq =
        count <= 1 ? 0 : spread * (-1 + (2 * i) / (count - 1));
      return {
        ratio: HARMONICS[i] ?? 1,
        detune: 0,
        phase,
        naturalFreq,
      };
    });
  }

  private startDrift(): void {
    if (this.driftTimer !== null) return;
    this.driftTimer = setInterval(() => {
      if (this.driftState.length === 0) return;
      const engine = this.active?.engine;
      const { detunes, phases, r, psi } = driftStep(
        this.driftState,
        {
          drift: this.shared.drift,
          coupling: this.shared.coupling,
          // Structured-sync clustering bias. 0 (default) ⇒ homogeneous coupling,
          // so the drift/fusion path is unchanged; nonzero tilts the centroid via
          // the existing per-partial fusion gains (spectral redistribution).
          cluster: this.shared.cluster,
        },
        DRIFT_DT,
        Math.random,
      );
      this.currentR = r;
      let sum = 0;
      this.driftState.forEach((part, i) => {
        const detune = detunes[i];
        if (detune === undefined) return;
        part.detune = detune;
        part.phase = phases[i];
        // Fan out to the engine when a session is running; the same field also
        // modulates the input voice's filter (texture binding) even when not.
        engine?.setPartialDetune(i, detune);
        sum += detune;
      });

      // Synchronization-driven spectral fusion: couple the order parameter to
      // timbre by reshaping per-partial gains from each partial's coherence
      // with the mean field ψ. The pure core (audio/fusion.ts) is the single
      // source of truth; engines (and their worklets) only apply the scalars.
      // fusion = 0 ⇒ every multiplier is exactly 1 (bypassed, behavior-preserving).
      const fusionAmount = this.shared.fusion ?? 0;
      if (engine?.setPartialFusionGains) {
        if (fusionAmount > 0) {
          engine.setPartialFusionGains(
            fusionMultipliers(phases, psi, fusionAmount),
          );
          this.fusionEngaged = true;
        } else if (this.fusionEngaged) {
          // Fusion was just turned off — restore unity gains once.
          engine.setPartialFusionGains(phases.map(() => 1));
          this.fusionEngaged = false;
        }
      }
      const mean = sum / this.driftState.length;
      this.inputVoice?.setDriftModulation(mean);
      if (this.loopSlots) {
        const norm = Math.max(-1, Math.min(1, mean / LOOP_DRIFT_NORM));
        for (const id of SLOT_IDS) this.loopSlots[id].setDriftModulation(norm);
      }
    }, DRIFT_INTERVAL_MS);
  }

  private stopDrift(): void {
    if (this.driftTimer !== null) clearInterval(this.driftTimer);
    this.driftTimer = null;
  }

  /**
   * Fade out + stop the engine voices. If the live input is connected, the audio
   * core (context + post-fx + input) is kept alive and only the engine voices are
   * removed; otherwise the context is closed. Resolves after teardown.
   */
  stop(): Promise<void> {
    midiOutput.triggerStop();
    const ctx = this.ctx;
    const nodes = this.nodes;
    const voices = [this.active, this.outgoing].filter(
      (v): v is Voice => v !== null,
    );

    this.clearArcTick();
    if (this.arcEndTimer !== null) clearTimeout(this.arcEndTimer);
    this.arcEndTimer = null;
    this.arcRunner = null;
    this.applyArcParams = null;
    if (this.swapTimer !== null) clearTimeout(this.swapTimer);
    this.swapTimer = null;
    this.pendingSwap = null;
    this.running = false;
    this.active = null;
    this.outgoing = null;

    const keepCore =
      (this.inputVoice?.isConnected() ?? false) || this.loopsActive();

    if (!keepCore) {
      this.stopDrift();
      this.driftState = [];
      if (this.loopSlots) {
        for (const id of SLOT_IDS) this.loopSlots[id].dispose();
      }
      this.loopSlots = null;
      this.ctx = null;
      this.nodes = null;
    }

    if (!ctx || voices.length === 0) {
      if (!keepCore && ctx) void ctx.close().catch(() => undefined);
      return Promise.resolve();
    }

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
        for (const v of voices) {
          void v.engine.stop(0);
          try {
            v.bus.disconnect();
          } catch {
            // already detached
          }
        }
        if (keepCore) {
          // The arc-end fade may have ramped masterVol to 0; restore it so a
          // connected instrument keeps sounding through the kept-alive core.
          if (nodes) {
            try {
              nodes.masterVol.gain.cancelScheduledValues(ctx.currentTime);
              nodes.masterVol.gain.setValueAtTime(
                this.shared.volume,
                ctx.currentTime,
              );
            } catch {
              // ignore scheduling errors
            }
          }
          resolve();
        } else {
          ctx
            .close()
            .catch(() => undefined)
            .finally(() => resolve());
        }
      }, TEARDOWN_MS);
    });
  }

  /** Apply live shared-param updates: post-fx here, voice freqs to the engines. */
  setSharedParams(partial: Partial<SharedParams>, instant?: boolean): void {
    let update = { ...partial };
    if (this.mode === 'drone') {
      update = clampSharedParamsForDrone(update);
    }
    this.shared = { ...this.shared, ...update };

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
    if (
      partial.rootFreq !== undefined ||
      partial.spread !== undefined ||
      partial.tuning !== undefined ||
      partial.customScaleRatios !== undefined ||
      partial.customEqRatio !== undefined
    ) {
      // Forward to both engines so a mid-crossfade engine doesn't jump in pitch.
      const voiceUpdate = {
        rootFreq: p.rootFreq,
        spread: p.spread,
        tuning: p.tuning,
        customScaleRatios: p.customScaleRatios,
        customEqRatio: p.customEqRatio,
      };

      const gridLocked =
        this.mode !== 'drone' &&
        this.tempoBpm !== null &&
        this.tempoBpm > 0 &&
        (this.engineParams[this.engineId]?.grid_lock === 1 ||
          String(this.engineParams[this.engineId]?.grid_lock) === 'true');

      if (gridLocked && !instant) {
        const elapsed = ctx.currentTime - this.playStartAudioTime;
        const beatDuration = 60 / this.tempoBpm!;
        let targetTime =
          this.playStartAudioTime +
          Math.ceil(elapsed / beatDuration) * beatDuration;
        if (targetTime <= ctx.currentTime) {
          targetTime += beatDuration;
        }
        this.active?.engine.setSharedParams(voiceUpdate, targetTime, false);
        this.outgoing?.engine.setSharedParams(voiceUpdate, targetTime, false);
      } else {
        this.active?.engine.setSharedParams(voiceUpdate, undefined, instant);
        this.outgoing?.engine.setSharedParams(voiceUpdate, undefined, instant);
      }
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
    if (this.sessionState === 'playing-patch' && this.arcRunner) {
      console.warn('engine change ignored during arc');
      return;
    }

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

    const engine = this.makeEngineWithErrors(id);
    try {
      engine.start(ctx, this.shared, this.engineParams[id] ?? {});
    } catch (err) {
      // Incoming engine can't run here — keep the current one, surface the error.
      this.onEngineError?.(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    const bus = ctx.createGain();
    bus.gain.value = 0;
    engine.getOutputNode().connect(bus);
    bus.connect(nodes.filter);

    // Carry the current detune so the texture is continuous across the swap.
    // Density is shared + locked while playing, so partial counts always match.
    this.driftState.forEach((part, i) =>
      engine.setPartialDetune(i, part.detune),
    );

    // The incoming engine may request a longer crossfade (granular asks for
    // 800ms to mask grain start-up jitter); fall back to the default.
    const xfadeMs = engine.capabilities.crossfadeMs ?? CROSSFADE_MS;
    const xfadeSec = xfadeMs / 1000;

    const t0 = ctx.currentTime;
    active.bus.gain.cancelScheduledValues(t0);
    active.bus.gain.setValueAtTime(active.bus.gain.value, t0);
    active.bus.gain.linearRampToValueAtTime(0, t0 + xfadeSec);
    bus.gain.setValueAtTime(0, t0);
    bus.gain.linearRampToValueAtTime(1, t0 + xfadeSec);

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
    }, xfadeMs);
  }

  /**
   * Begin a session. `idle → starting → running-open | running-arc`. In arc
   * mode, `applyArcParams` is the writer the orchestrator calls each tick
   * (wired by React to the param store's `setMany`); kept injected so the
   * orchestrator stays store-agnostic. No-op (with a warning) unless idle.
   */
  startSession(
    opts: StartSessionOptions,
    applyArcParams?: (p: Partial<SharedParams>) => void,
  ): void {
    if (this.sessionState !== 'idle') {
      console.warn(`startSession ignored: session is '${this.sessionState}'`);
      return;
    }

    this.setState('starting');
    if (!this.start()) {
      // Engine refused to start (e.g. unsupported physical); back to idle.
      this.setState('idle');
      return;
    }

    midiOutput.triggerStart();

    if (this.mode === 'drone') {
      this.setState('playing-patch');
      return;
    }

    if (opts.mode === 'open') {
      this.setState('playing-patch');
      return;
    }

    const arc = getArcById(opts.arcId);
    if (!arc) {
      console.warn(`unknown arc '${opts.arcId}', running open`);
      this.setState('playing-patch');
      return;
    }

    const runner = new ArcRunner(
      arc,
      opts.durationSec,
      this.shared,
      engineCapabilities(this.engineId),
    );
    for (const w of runner.warnings) console.warn(`[arc:${arc.id}] ${w}`);

    this.arcRunner = runner;
    this.applyArcParams = applyArcParams ?? null;
    this.arcDurationSec = opts.durationSec;
    this.arcT0 = this.ctx?.currentTime ?? 0;
    this.arcProgress = { progress: 0, segmentIndex: 0 };
    this.setState('playing-patch');
    this.startArcTick();
  }

  /** Abort the session from any running state: `→ stopping → idle`. */
  stopSession(): Promise<void> {
    if (this.sessionState === 'idle' || this.sessionState === 'stopping') {
      return Promise.resolve();
    }
    this.setState('stopping');
    return this.stop().then(() => this.setState('idle'));
  }

  /** Full teardown for unmount: drop loops + input then close the core. */
  async dispose(): Promise<void> {
    if (this.loopSlots) {
      for (const id of SLOT_IDS) this.loopSlots[id].dispose();
      this.loopSlots = null;
    }
    const voice = this.inputVoice;
    this.inputVoice = null;
    if (voice) {
      try {
        voice.getOutputNode().disconnect();
      } catch {
        // already detached
      }
      await voice.disconnect();
    }
    await this.stop();
  }

  // --- loop pedal API ------------------------------------------------------

  /** Ensure the audio core + loop slots exist (requires a user gesture). */
  ensureLoops(): Record<SlotId, LoopSlot> {
    const { ctx, nodes } = this.ensureCore();
    this.ensureLoopSlots(ctx, nodes);
    // `ensureLoopSlots` is a no-op once built; the non-null assertion is safe.
    return this.loopSlots as Record<SlotId, LoopSlot>;
  }

  getLoopSlot(id: SlotId): LoopSlot | null {
    return this.loopSlots?.[id] ?? null;
  }

  getLoopState(id: SlotId): SlotState {
    return this.loopSlots?.[id].getState() ?? 'empty';
  }

  /**
   * Arm a slot for capture. Requires connected input — loops capture the live
   * voice's processed tap. No-op (with a warning) when input isn't connected.
   */
  armLoop(id: SlotId): void {
    const voice = this.inputVoice;
    if (!voice?.isConnected()) {
      console.warn('armLoop ignored: connect an input first');
      return;
    }
    const slots = this.ensureLoops();
    if (this.driftState.length === 0) this.seedDrift(this.shared.density);
    this.startDrift();
    slots[id].arm(voice.getCaptureTap());
  }

  /** Update a slot's grain params (live while frozen) and remember them. */
  setLoopGrain(id: SlotId, grain: GrainParams): void {
    this.loopConfig = {
      ...this.loopConfig,
      [id]: { ...this.loopConfig[id], grain },
    };
    this.loopSlots?.[id].setGrain(grain);
  }

  /** Toggle drift-coupling of grain wander for a slot. */
  setLoopDriftCoupled(id: SlotId, on: boolean): void {
    this.loopConfig = {
      ...this.loopConfig,
      [id]: { ...this.loopConfig[id], driftCoupled: on },
    };
    this.loopSlots?.[id].setDriftCoupled(on);
  }

  /**
   * Decode encoded audio bytes (a capture fetched from the backend) into an
   * `AudioBuffer` using the core context. Requires a user gesture to have built
   * the core (the load flow is user-initiated).
   */
  async decodeAudio(data: ArrayBuffer): Promise<AudioBuffer> {
    const { ctx } = this.ensureCore();
    return ctx.decodeAudioData(data);
  }

  /** Hydrate a loop slot from a decoded buffer (saved-patch capture rehydration). */
  loadLoopBuffer(id: SlotId, buffer: AudioBuffer): void {
    const slots = this.ensureLoops();
    slots[id].loadBuffer(buffer);
  }

  /** Drive the arc forward at 20 Hz, reading elapsed time off the audio clock. */
  private startArcTick(): void {
    this.arcTimer = setInterval(() => {
      const ctx = this.ctx;
      const runner = this.arcRunner;
      if (!ctx || !runner) return;

      const elapsed = ctx.currentTime - this.arcT0;
      const frame = runner.tick(elapsed);
      this.arcProgress = {
        progress: frame.progress,
        segmentIndex: frame.segmentIndex,
      };
      if (Object.keys(frame.params).length > 0) {
        this.applyArcParams?.(frame.params);
      }
      if (frame.done) this.completeArc();
    }, ARC_TICK_MS);
  }

  private clearArcTick(): void {
    if (this.arcTimer !== null) clearInterval(this.arcTimer);
    this.arcTimer = null;
  }

  /** Arc reached its end: fade master to 0 over 4 s, then tear down to idle. */
  private completeArc(): void {
    if (this.sessionState !== 'playing-patch' || !this.arcRunner) return;
    this.clearArcTick();
    this.setState('stopping');

    const ctx = this.ctx;
    const nodes = this.nodes;
    if (ctx && nodes) {
      try {
        nodes.masterVol.gain.cancelScheduledValues(ctx.currentTime);
        nodes.masterVol.gain.setValueAtTime(
          nodes.masterVol.gain.value,
          ctx.currentTime,
        );
        nodes.masterVol.gain.linearRampToValueAtTime(
          0,
          ctx.currentTime + ARC_END_FADE_SECONDS,
        );
      } catch {
        // node may be mid-teardown; ignore
      }
    }

    this.arcEndTimer = setTimeout(() => {
      this.arcEndTimer = null;
      void this.stop().then(() => this.setState('idle'));
    }, ARC_END_FADE_MS);
  }

  private setState(next: SessionState): void {
    if (next === this.sessionState) return;
    this.sessionState = next;
    for (const fn of this.listeners) fn(next);
  }
}
