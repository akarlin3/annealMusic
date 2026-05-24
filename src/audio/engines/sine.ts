import { HARMONICS, type PartialVoice } from '@/types/audio';
import { partialShape } from '@/audio/engines/shape';
import type {
  AnnealEngine,
  AnnealEngineCapabilities,
  SharedParams,
} from '@/audio/engines/types';

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

    this.partials = HARMONICS.slice(0, shared.density).map((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = shared.rootFreq * Math.pow(ratio, shared.spread);

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

      osc.connect(g).connect(out);

      osc.start();
      lfo.start();
      baseline.start();

      return { osc, g, lfo, lfoGain, baseline, ratio, detune: 0 };
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

  setSharedParams(partial: Partial<SharedParams>): void {
    if (!this.shared) return;
    this.shared = { ...this.shared, ...partial };
    const ctx = this.ctx;
    if (!ctx) return;

    if (partial.rootFreq !== undefined || partial.spread !== undefined) {
      const { rootFreq, spread } = this.shared;
      const t = ctx.currentTime;
      this.partials.forEach((part) => {
        part.osc.frequency.setTargetAtTime(
          rootFreq * Math.pow(part.ratio, spread),
          t,
          FREQ_TC,
        );
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

  getPartialCount(): number {
    return this.partials.length;
  }

  getPartialFrequencies(): number[] {
    return this.partials.map((p) => p.osc.frequency.value);
  }
}
