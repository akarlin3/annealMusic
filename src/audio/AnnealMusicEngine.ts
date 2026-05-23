import { driftStep } from '@/audio/drift';
import { makeIR } from '@/audio/ir';
import { HARMONICS, type GraphNodes, type PartialVoice } from '@/types/audio';
import type { AnnealMusicParams } from '@/state/params';

const FADE_IN_SECONDS = 3.0;
const FADE_OUT_TC = 0.6;
const TEARDOWN_MS = 2200;
const DRIFT_INTERVAL_MS = 50;
const DRIFT_DT = 0.05;
const DETUNE_TC = 0.12;

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
 * Owns the Web Audio graph and its lifecycle. Framework-agnostic: knows
 * nothing about React. Mirrors the prototype's audio behavior exactly.
 */
export class AnnealMusicEngine {
  private params: AnnealMusicParams;
  private ctx: AudioContext | null = null;
  private nodes: GraphNodes | null = null;
  private partials: PartialVoice[] = [];
  private driftTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(params: AnnealMusicParams) {
    this.params = { ...params };
  }

  isRunning(): boolean {
    return this.running;
  }

  getAnalyser(): AnalyserNode | null {
    return this.nodes?.analyser ?? null;
  }

  /** Current oscillator frequency (Hz) of each sounding partial. */
  getPartialFrequencies(): number[] {
    return this.partials.map((p) => p.osc.frequency.value);
  }

  /** Build the graph, start sources, fade in, and begin the drift loop. */
  start(): void {
    if (this.running) return;

    const ctx = createAudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const p = this.params;

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

    const partials: PartialVoice[] = HARMONICS.slice(0, p.density).map(
      (ratio, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = p.rootFreq * Math.pow(ratio, p.spread);

        const g = ctx.createGain();
        g.gain.value = 0;

        const baseline = ctx.createConstantSource();
        baseline.offset.value = 0.32 / (i + 1);
        baseline.connect(g.gain);

        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.025 + Math.random() * 0.12;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.14 / (i + 1);
        lfo.connect(lfoGain).connect(g.gain);

        osc.connect(g).connect(filter);

        osc.start();
        lfo.start();
        baseline.start();

        return { osc, g, lfo, lfoGain, baseline, ratio, detune: 0 };
      },
    );

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
    this.partials = partials;
    this.running = true;

    this.startDrift();
  }

  private startDrift(): void {
    this.driftTimer = setInterval(() => {
      const ctx = this.ctx;
      if (!ctx || this.partials.length === 0) return;
      const next = driftStep(
        this.partials,
        { drift: this.params.drift, coupling: this.params.coupling },
        DRIFT_DT,
        Math.random,
      );
      this.partials.forEach((part, i) => {
        const detune = next[i];
        if (detune === undefined) return;
        part.detune = detune;
        try {
          part.osc.detune.setTargetAtTime(detune, ctx.currentTime, DETUNE_TC);
        } catch {
          // node may be mid-teardown; ignore
        }
      });
    }, DRIFT_INTERVAL_MS);
  }

  private stopDrift(): void {
    if (this.driftTimer !== null) clearInterval(this.driftTimer);
    this.driftTimer = null;
  }

  /** Fade out, stop sources, and close the context. Resolves after teardown. */
  stop(): Promise<void> {
    const ctx = this.ctx;
    const nodes = this.nodes;
    const partials = this.partials;

    this.stopDrift();
    this.running = false;
    this.ctx = null;
    this.nodes = null;
    this.partials = [];

    if (!ctx || !nodes) return Promise.resolve();

    try {
      nodes.master.gain.cancelScheduledValues(ctx.currentTime);
      nodes.master.gain.setTargetAtTime(0, ctx.currentTime, FADE_OUT_TC);
    } catch {
      // ignore scheduling errors during teardown
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        partials.forEach((part) => {
          try {
            part.osc.stop();
            part.lfo.stop();
            part.baseline.stop();
          } catch {
            // already stopped
          }
        });
        ctx
          .close()
          .catch(() => undefined)
          .finally(() => resolve());
      }, TEARDOWN_MS);
    });
  }

  /** Apply live parameter updates via smoothed ramps. */
  setParams(partial: Partial<AnnealMusicParams>): void {
    this.params = { ...this.params, ...partial };

    const ctx = this.ctx;
    const nodes = this.nodes;
    if (!ctx || !nodes) return;

    const t = ctx.currentTime;
    const p = this.params;

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
      this.partials.forEach((part) => {
        part.osc.frequency.setTargetAtTime(
          p.rootFreq * Math.pow(part.ratio, p.spread),
          t,
          0.3,
        );
      });
    }
  }
}
