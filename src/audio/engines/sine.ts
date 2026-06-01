import { HARMONICS, type PartialVoice } from '@/types/audio';
import { partialShape } from '@/audio/engines/shape';
import type {
  AnnealEngine,
  AnnealEngineCapabilities,
  SharedParams,
} from '@/audio/engines/types';
import { resolveLatticeRatio } from '@/audio/tuning/resolver';

/** Time-constant for smoothed detune ramps applied by the drift loop. */
const DETUNE_TC = 0.12;
/** Time-constant for smoothed root/spread frequency updates. */
const FREQ_TC = 0.3;

/**
 * The original coupled sine bank, as an engine. Owns its oscillators and the
 * per-partial amplitude shape; routes every voice into a single output node.
 */
export class SineEngine implements AnnealEngine {
  readonly id = 'sine' as const;
  readonly capabilities: AnnealEngineCapabilities = {
    densityLockedWhilePlaying: true,
    params: [],
  };

  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private partials: PartialVoice[] = [];
  private shared: SharedParams | null = null;

  start(ctx: AudioContext, shared: SharedParams): void {
    if (this.ctx)
      throw new Error('SineEngine.start called while already started');

    this.ctx = ctx;
    this.shared = { ...shared };

    const out = ctx.createGain();
    out.gain.value = 1;

    const tuning = shared.tuning ?? { system: 'equal' };
    const customScale = shared.customScaleRatios;
    const customEq = shared.customEqRatio;

    this.partials = HARMONICS.slice(0, shared.density).map((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const latticeRatio = resolveLatticeRatio(
        tuning,
        i,
        shared.rootFreq,
        customScale,
        customEq,
      );
      osc.frequency.value =
        shared.rootFreq * Math.pow(latticeRatio, shared.spread);

      const g = ctx.createGain();
      g.gain.value = 0;

      const { baselineOffset, lfoGain: lfoDepth, lfoFreq } = partialShape(i);

      const baseline = ctx.createConstantSource();
      baseline.offset.value = baselineOffset;
      baseline.connect(g.gain);

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = lfoFreq;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = lfoDepth;
      lfo.connect(lfoGain).connect(g.gain);

      // Fusion gain sits after the baseline+LFO shape; unity until the drift
      // loop pushes synchronization-driven multipliers (behavior-preserving).
      const fusionGain = ctx.createGain();
      fusionGain.gain.value = 1;

      osc.connect(g).connect(fusionGain).connect(out);

      osc.start();
      lfo.start();
      baseline.start();

      return {
        osc,
        g,
        fusionGain,
        lfo,
        lfoGain,
        baseline,
        ratio,
        index: i,
        detune: 0,
      };
    });

    this.out = out;
  }

  stop(fadeSeconds = 0): Promise<void> {
    const ctx = this.ctx;
    const out = this.out;
    const partials = this.partials;

    this.ctx = null;
    this.out = null;
    this.partials = [];
    this.shared = null;

    if (!ctx || !out) return Promise.resolve();

    if (fadeSeconds > 0) {
      try {
        out.gain.cancelScheduledValues(ctx.currentTime);
        out.gain.setTargetAtTime(0, ctx.currentTime, fadeSeconds / 3);
      } catch {
        // node may be mid-teardown; ignore
      }
    }

    partials.forEach((part) => {
      try {
        part.osc.stop();
        part.lfo.stop();
        part.baseline.stop();
      } catch {
        // already stopped
      }
    });

    return Promise.resolve();
  }

  getOutputNode(): AudioNode {
    if (!this.out)
      throw new Error('SineEngine has no output node (not started)');
    return this.out;
  }

  setSharedParams(
    partial: Partial<SharedParams>,
    targetTime?: number,
    instant?: boolean,
  ): void {
    if (!this.shared) return;
    this.shared = { ...this.shared, ...partial };
    const ctx = this.ctx;
    if (!ctx) return;

    if (
      partial.rootFreq !== undefined ||
      partial.spread !== undefined ||
      partial.tuning !== undefined
    ) {
      const {
        rootFreq,
        spread,
        tuning: activeTuning,
        customScaleRatios,
        customEqRatio,
      } = this.shared;
      const tuning = activeTuning ?? { system: 'equal' };
      const t = ctx.currentTime;
      this.partials.forEach((part) => {
        const latticeRatio = resolveLatticeRatio(
          tuning,
          part.index,
          rootFreq,
          customScaleRatios,
          customEqRatio,
        );
        const targetFreq = rootFreq * Math.pow(latticeRatio, spread);
        if (instant) {
          part.osc.frequency.cancelScheduledValues(targetTime ?? t);
          part.osc.frequency.setValueAtTime(targetFreq, targetTime ?? t);
        } else if (targetTime !== undefined) {
          const currentFreq = part.osc.frequency.value;
          part.osc.frequency.setValueAtTime(currentFreq, targetTime - 0.005);
          part.osc.frequency.setTargetAtTime(targetFreq, targetTime, FREQ_TC);
        } else {
          part.osc.frequency.setTargetAtTime(targetFreq, t, FREQ_TC);
        }
      });
    }
  }

  setEngineParams(): void {
    // The sine engine has no engine-specific params.
  }

  setPartialDetune(index: number, cents: number): void {
    const part = this.partials[index];
    const ctx = this.ctx;
    if (!part || !ctx) return;
    part.detune = cents;
    try {
      part.osc.detune.setTargetAtTime(cents, ctx.currentTime, DETUNE_TC);
    } catch {
      // node may be mid-teardown; ignore
    }
  }

  setPartialFusionGains(multipliers: readonly number[]): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (let i = 0; i < this.partials.length; i++) {
      const part = this.partials[i];
      const m = multipliers[i];
      if (!part || m === undefined) continue;
      try {
        // Smooth with the same time-constant as detune so fusion is a gentle
        // shimmer, never a zipper-noise step.
        part.fusionGain.gain.setTargetAtTime(m, ctx.currentTime, DETUNE_TC);
      } catch {
        // node may be mid-teardown; ignore
      }
    }
  }

  getPartialCount(): number {
    return this.partials.length;
  }

  getPartialFrequencies(): number[] {
    return this.partials.map((p) => p.osc.frequency.value);
  }

  getPartialOutputs(): AudioNode[] {
    return this.partials.map((p) => p.fusionGain);
  }
}
