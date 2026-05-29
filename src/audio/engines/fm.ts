import { HARMONICS } from '@/types/audio';
import { partialShape } from '@/audio/engines/shape';
import type {
  AnnealEngine,
  AnnealEngineCapabilities,
  EngineParamDef,
  EngineParams,
  SharedParams,
} from '@/audio/engines/types';

/** Time-constant for smoothed detune ramps applied by the drift loop. */
const DETUNE_TC = 0.12;
/** Time-constant for smoothed root/spread frequency updates. */
const FREQ_TC = 0.3;
/** Time-constant for smoothed engine-param (ratio/index/feedback) updates. */
const PARAM_TC = 0.05;

/**
 * Self-feedback scale: at `feedback = 1`, the modulator's self-modulation
 * deviation reaches ~3× its own frequency — the harsh/near-noisy edge of
 * single-operator feedback — without runaway. `feedback = 0` is plain FM.
 */
const FEEDBACK_SCALE = 3;

interface FmParams {
  modRatio: number;
  modIndex: number;
  feedback: number;
}

/** Single source of truth for FM param defaults. */
const FM_DEFAULTS: FmParams = {
  modRatio: 1,
  modIndex: 2,
  feedback: 0,
};

const PARAM_DEFS: readonly EngineParamDef[] = [
  {
    key: 'modRatio',
    label: 'Ratio',
    min: 0.5,
    max: 4,
    step: 0.01,
    default: FM_DEFAULTS.modRatio,
    fmt: (v) => v.toFixed(2),
  },
  {
    key: 'modIndex',
    label: 'Index',
    min: 0,
    max: 10,
    step: 0.05,
    default: FM_DEFAULTS.modIndex,
    fmt: (v) => v.toFixed(2),
  },
  {
    key: 'feedback',
    label: 'Feedback',
    min: 0,
    max: 1,
    step: 0.01,
    default: FM_DEFAULTS.feedback,
    fmt: (v) => v.toFixed(2),
  },
];

interface FmVoice {
  readonly carrier: OscillatorNode;
  readonly modulator: OscillatorNode;
  readonly modGain: GainNode;
  readonly fbGain: GainNode;
  readonly g: GainNode;
  readonly lfo: OscillatorNode;
  readonly lfoGain: GainNode;
  readonly baseline: ConstantSourceNode;
  readonly ratio: number;
  /** Undetuned carrier fundamental (Hz); detune is applied separately. */
  carrierFreq: number;
  detune: number;
}

/**
 * Two-operator FM engine. Per partial: a sine carrier at the partial frequency,
 * modulated by a sine modulator at `carrier × modRatio` with depth
 * `modIndex × carrier` Hz, plus optional modulator self-feedback. Shares the
 * sine engine's baseline + LFO amplitude shape so engines sound consistent.
 */
export class FmEngine implements AnnealEngine {
  readonly id = 'fm' as const;
  readonly capabilities: AnnealEngineCapabilities = {
    densityLockedWhilePlaying: true,
    params: PARAM_DEFS,
  };

  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private voices: FmVoice[] = [];
  private shared: SharedParams | null = null;
  private params: FmParams = { ...FM_DEFAULTS };

  start(ctx: AudioContext, shared: SharedParams, engine: EngineParams): void {
    if (this.ctx)
      throw new Error('FmEngine.start called while already started');

    this.ctx = ctx;
    this.shared = { ...shared };
    this.params = { ...this.params, ...engine };

    const out = ctx.createGain();
    out.gain.value = 1;

    const { modRatio, modIndex, feedback } = this.params;

    this.voices = HARMONICS.slice(0, shared.density).map((ratio, i) => {
      const carrierFreq = shared.rootFreq * Math.pow(ratio, shared.spread);
      const modFreq = carrierFreq * modRatio;

      const carrier = ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.value = carrierFreq;

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

      const modulator = ctx.createOscillator();
      modulator.type = 'sine';
      modulator.frequency.value = modFreq;

      const modGain = ctx.createGain();
      modGain.gain.value = modIndex * carrierFreq;

      const fbGain = ctx.createGain();
      fbGain.gain.value = feedback * modFreq * FEEDBACK_SCALE;

      // modulator → depth → carrier.frequency (additive FM)
      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      // modulator → feedback → modulator.frequency (self-feedback)
      modulator.connect(fbGain);
      fbGain.connect(modulator.frequency);
      // carrier → amplitude → output
      carrier.connect(g);
      g.connect(out);

      carrier.start();
      modulator.start();
      lfo.start();
      baseline.start();

      return {
        carrier,
        modulator,
        modGain,
        fbGain,
        g,
        lfo,
        lfoGain,
        baseline,
        ratio,
        carrierFreq,
        detune: 0,
      };
    });

    this.out = out;
  }

  stop(fadeSeconds = 0): Promise<void> {
    const ctx = this.ctx;
    const out = this.out;
    const voices = this.voices;

    this.ctx = null;
    this.out = null;
    this.voices = [];
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

    voices.forEach((v) => {
      try {
        v.carrier.stop();
        v.modulator.stop();
        v.lfo.stop();
        v.baseline.stop();
      } catch {
        // already stopped
      }
    });

    return Promise.resolve();
  }

  getOutputNode(): AudioNode {
    if (!this.out) throw new Error('FmEngine has no output node (not started)');
    return this.out;
  }

  setSharedParams(partial: Partial<SharedParams>, targetTime?: number, instant?: boolean): void {
    if (!this.shared) return;
    this.shared = { ...this.shared, ...partial };
    const ctx = this.ctx;
    if (!ctx) return;

    if (partial.rootFreq !== undefined || partial.spread !== undefined) {
      const { rootFreq, spread } = this.shared;
      const t = ctx.currentTime;
      this.voices.forEach((v) => {
        const targetFreq = rootFreq * Math.pow(v.ratio, spread);
        if (instant) {
          v.carrier.frequency.cancelScheduledValues(targetTime ?? t);
          v.carrier.frequency.setValueAtTime(targetFreq, targetTime ?? t);
          v.carrierFreq = targetFreq;
          
          const { modRatio, modIndex, feedback } = this.params;
          const modFreq = targetFreq * modRatio;
          v.modulator.frequency.cancelScheduledValues(targetTime ?? t);
          v.modulator.frequency.setValueAtTime(modFreq, targetTime ?? t);
          v.modGain.gain.cancelScheduledValues(targetTime ?? t);
          v.modGain.gain.setValueAtTime(modIndex * targetFreq, targetTime ?? t);
          v.fbGain.gain.cancelScheduledValues(targetTime ?? t);
          v.fbGain.gain.setValueAtTime(feedback * modFreq * FEEDBACK_SCALE, targetTime ?? t);
        } else if (targetTime !== undefined) {
          const currentFreq = v.carrier.frequency.value;
          v.carrier.frequency.setValueAtTime(currentFreq, targetTime - 0.005);
          v.carrier.frequency.setTargetAtTime(targetFreq, targetTime, FREQ_TC);
          v.carrierFreq = targetFreq;
          
          const { modRatio, modIndex, feedback } = this.params;
          const modFreq = targetFreq * modRatio;
          v.modulator.frequency.setValueAtTime(v.modulator.frequency.value, targetTime - 0.005);
          v.modulator.frequency.setTargetAtTime(modFreq, targetTime, PARAM_TC);
          v.modGain.gain.setValueAtTime(v.modGain.gain.value, targetTime - 0.005);
          v.modGain.gain.setTargetAtTime(modIndex * targetFreq, targetTime, PARAM_TC);
          v.fbGain.gain.setValueAtTime(v.fbGain.gain.value, targetTime - 0.005);
          v.fbGain.gain.setTargetAtTime(feedback * modFreq * FEEDBACK_SCALE, targetTime, PARAM_TC);
        } else {
          v.carrierFreq = targetFreq;
          v.carrier.frequency.setTargetAtTime(targetFreq, t, FREQ_TC);
          this.retuneVoice(v, t);
        }
      });
    }
  }

  setEngineParams(partial: Partial<EngineParams>): void {
    this.params = { ...this.params, ...partial };
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.voices.forEach((v) => this.retuneVoice(v, t));
  }

  /** Recompute modulator frequency + depths from the current params/carrier. */
  private retuneVoice(v: FmVoice, t: number): void {
    const { modRatio, modIndex, feedback } = this.params;
    const modFreq = v.carrierFreq * modRatio;
    v.modulator.frequency.setTargetAtTime(modFreq, t, PARAM_TC);
    v.modGain.gain.setTargetAtTime(modIndex * v.carrierFreq, t, PARAM_TC);
    v.fbGain.gain.setTargetAtTime(
      feedback * modFreq * FEEDBACK_SCALE,
      t,
      PARAM_TC,
    );
  }

  setPartialDetune(index: number, cents: number): void {
    const v = this.voices[index];
    const ctx = this.ctx;
    if (!v || !ctx) return;
    v.detune = cents;
    const t = ctx.currentTime;
    try {
      // Detune carrier and modulator equally so the FM ratio is preserved.
      v.carrier.detune.setTargetAtTime(cents, t, DETUNE_TC);
      v.modulator.detune.setTargetAtTime(cents, t, DETUNE_TC);
    } catch {
      // node may be mid-teardown; ignore
    }
  }

  getPartialCount(): number {
    return this.voices.length;
  }

  getPartialFrequencies(): number[] {
    return this.voices.map((v) => v.carrier.frequency.value);
  }

  /** Diagnostic: current modulator frequencies (Hz). Used by tests. */
  getModulatorFrequencies(): number[] {
    return this.voices.map((v) => v.modulator.frequency.value);
  }

  getPartialOutputs(): AudioNode[] {
    return this.voices.map((v) => v.g);
  }
}
