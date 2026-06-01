import type {
  AnnealEngine,
  AnnealEngineCapabilities,
  EngineParamDef,
  EngineParams,
  SharedParams,
} from '@/audio/engines/types';
import {
  isPhysicalSupported,
  registerPhysicalModules,
  type ModuleRegistrar,
  type SupportProbe,
  type WorkletNodeFactory,
  type PhysicalVoiceNode,
} from '@/audio/engines/physical';
import { resolveLatticeRatio } from '@/audio/tuning/resolver';

export const SUBDIVISIONS = [
  'Whole',
  'Half',
  'Quarter',
  'Eighth',
  'Sixteenth',
  'Triplet',
] as const;

export type PulseSubdivision = (typeof SUBDIVISIONS)[number];

export interface PulseNumericParams {
  density: number; // subdivision index (0..5)
  accent: number; // 0 or 1
  tone: number; // 0..1
  swing: number; // 0..1
  humanize: number; // 0..1
}

const DEFAULTS: PulseNumericParams = {
  density: 2, // Quarter
  accent: 1, // On
  tone: 0.5,
  swing: 0.0,
  humanize: 0.1,
};

const PARAM_DEFS: readonly EngineParamDef[] = [
  {
    key: 'density',
    label: 'Subdivision',
    min: 0,
    max: 5,
    step: 1,
    default: DEFAULTS.density,
    fmt: (v) =>
      SUBDIVISIONS[Math.max(0, Math.min(5, Math.round(v)))] ?? 'Quarter',
  },
  {
    key: 'accent',
    label: 'Accent',
    min: 0,
    max: 1,
    step: 1,
    default: DEFAULTS.accent,
    fmt: (v) => (Math.round(v) === 1 ? 'On' : 'Off'),
  },
  {
    key: 'tone',
    label: 'Tone',
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULTS.tone,
    fmt: (v) => v.toFixed(2),
  },
  {
    key: 'swing',
    label: 'Swing',
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULTS.swing,
    fmt: (v) => v.toFixed(2),
  },
  {
    key: 'humanize',
    label: 'Humanize',
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULTS.humanize,
    fmt: (v) => v.toFixed(2),
  },
];

export type PulseParam =
  | 'f0'
  | 'spread'
  | 'densityVal'
  | 'detune'
  | 'density'
  | 'accent'
  | 'tone'
  | 'swing'
  | 'humanize'
  | 'tempoSet'
  | 'tempoBpm';

export interface PulseVoiceNode {
  readonly node: AudioNode;
  setParam(
    name: PulseParam,
    value: number,
    targetTime?: number,
    instant?: boolean,
  ): void;
  post(message: unknown): void;
  dispose(): void;
}

const defaultFactory: WorkletNodeFactory = (
  ctx: AudioContext,
  processor: string,
): PhysicalVoiceNode => {
  const node = new AudioWorkletNode(ctx, processor, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  return {
    node,
    setParam(
      name: string,
      value: number,
      targetTime?: number,
      instant?: boolean,
    ) {
      const p = node.parameters.get(name);
      if (p) {
        if (instant) {
          p.cancelScheduledValues(targetTime ?? ctx.currentTime);
          p.setValueAtTime(value, targetTime ?? ctx.currentTime);
        } else {
          p.setTargetAtTime(value, targetTime ?? ctx.currentTime, 0.02);
        }
      }
    },
    post(message: unknown) {
      node.port.postMessage(message);
    },
    dispose() {
      try {
        node.disconnect();
      } catch {
        // already detached
      }
    },
  } as unknown as PhysicalVoiceNode;
};

export class PulseEngine implements AnnealEngine {
  readonly id = 'pulse' as const;
  readonly capabilities: AnnealEngineCapabilities = {
    densityLockedWhilePlaying: false,
    params: PARAM_DEFS,
  };

  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private voice: PhysicalVoiceNode | null = null;
  private shared: SharedParams | null = null;
  private params: PulseNumericParams = { ...DEFAULTS };
  private buildToken = 0;
  private stopped = false;
  private onError: ((error: Error) => void) | null = null;
  private tempoBpm: number | null = null;

  setErrorHandler(fn: (error: Error) => void): void {
    this.onError = fn;
  }

  constructor(
    private readonly factory: WorkletNodeFactory = defaultFactory,
    private readonly register: ModuleRegistrar = registerPhysicalModules,
    private readonly supported: SupportProbe = isPhysicalSupported,
  ) {}

  private get pulseVoice(): PulseVoiceNode | null {
    return this.voice as unknown as PulseVoiceNode | null;
  }

  start(ctx: AudioContext, shared: SharedParams, engine: EngineParams): void {
    if (this.ctx) {
      throw new Error('PulseEngine.start called while already started');
    }
    if (!this.supported(ctx)) {
      throw new Error('Pulse engine requires AudioWorklet support');
    }

    this.ctx = ctx;
    this.shared = { ...shared };
    const parsedEngine = engine as unknown as Partial<PulseNumericParams>;
    this.params = { ...DEFAULTS, ...parsedEngine };
    this.stopped = false;

    // Use current orchestrator piece tempo if available
    const tempoVal =
      (ctx as AudioContext & { _tempoBpm?: number })._tempoBpm ?? null;
    this.tempoBpm = tempoVal;

    const out = ctx.createGain();
    out.gain.value = 1.0;
    this.out = out;

    this.build();
  }

  private build(): void {
    const ctx = this.ctx;
    const out = this.out;
    if (!ctx || !out) return;

    const token = ++this.buildToken;
    const processor = 'pulse-processor';

    void this.register(ctx)
      .then(() => {
        if (this.stopped || token !== this.buildToken || !this.ctx) return;

        const voice = this.factory(ctx, processor);
        voice.node.connect(out);

        const pVoice = voice as unknown as PulseVoiceNode;

        // Apply parameters to the worklet node
        pVoice.setParam('f0', this.shared?.rootFreq ?? 110);
        pVoice.setParam('spread', this.shared?.spread ?? 1.0);
        pVoice.setParam('densityVal', this.shared?.density ?? 6);
        pVoice.setParam('detune', 0);

        // Set pulse-specific parameters
        pVoice.setParam('density', this.params.density);
        pVoice.setParam('accent', this.params.accent);
        pVoice.setParam('tone', this.params.tone);
        pVoice.setParam('swing', this.params.swing);
        pVoice.setParam('humanize', this.params.humanize);

        // Apply tempo
        const isTempoSet = this.tempoBpm !== null ? 1 : 0;
        const bpm = this.tempoBpm !== null ? this.tempoBpm : 60;
        pVoice.setParam('tempoSet', isTempoSet);
        pVoice.setParam('tempoBpm', bpm);

        this.voice = voice;
      })
      .catch((err: unknown) => {
        if (this.stopped || token !== this.buildToken) return;
        const error = err instanceof Error ? err : new Error(String(err));
        if (this.onError) this.onError(error);
        else console.error('[pulse] worklet load failed', error);
      });
  }

  stop(fadeSeconds = 0): Promise<void> {
    this.stopped = true;
    const out = this.out;
    const ctx = this.ctx;

    if (out && ctx && fadeSeconds > 0) {
      try {
        out.gain.cancelScheduledValues(ctx.currentTime);
        out.gain.setTargetAtTime(0, ctx.currentTime, fadeSeconds / 3);
      } catch {
        // ignore mid-teardown issues
      }
    }

    this.voice?.dispose();
    this.voice = null;
    this.ctx = null;
    this.out = null;
    this.shared = null;
    return Promise.resolve();
  }

  getOutputNode(): AudioNode {
    if (!this.out) {
      throw new Error('PulseEngine has no output node (not started)');
    }
    return this.out;
  }

  setSharedParams(
    partial: Partial<SharedParams>,
    targetTime?: number,
    instant?: boolean,
  ): void {
    if (!this.shared) return;
    this.shared = { ...this.shared, ...partial };
    if (!this.pulseVoice) return;

    if (partial.rootFreq !== undefined) {
      this.pulseVoice.setParam('f0', partial.rootFreq, targetTime, instant);
    }
    if (partial.spread !== undefined) {
      this.pulseVoice.setParam('spread', partial.spread, targetTime, instant);
    }
    if (partial.density !== undefined) {
      this.pulseVoice.setParam(
        'densityVal',
        partial.density,
        targetTime,
        instant,
      );
    }
  }

  setEngineParams(partial: Partial<EngineParams>): void {
    const parsedPartial = partial as unknown as Partial<PulseNumericParams>;
    this.params = {
      ...this.params,
      ...parsedPartial,
    };
    if (!this.pulseVoice) return;

    if (partial.density !== undefined) {
      this.pulseVoice.setParam('density', Number(partial.density));
    }
    if (partial.accent !== undefined) {
      this.pulseVoice.setParam('accent', Number(partial.accent));
    }
    if (partial.tone !== undefined) {
      this.pulseVoice.setParam('tone', Number(partial.tone));
    }
    if (partial.swing !== undefined) {
      this.pulseVoice.setParam('swing', Number(partial.swing));
    }
    if (partial.humanize !== undefined) {
      this.pulseVoice.setParam('humanize', Number(partial.humanize));
    }
  }

  setPartialDetune(index: number, cents: number): void {
    // Pulse engine modulates detune globally or on partial index 0 for simplicity
    if (index === 0 && this.pulseVoice) {
      this.pulseVoice.setParam('detune', cents);
    }
  }

  setPartialFusionGains(multipliers: readonly number[]): void {
    // Thin wrapper: forward the multipliers computed by the pure fusion core
    // (audio/fusion.ts) to the worklet, which only applies them. No fusion math
    // lives in the worklet (heuristic-drift rule).
    this.pulseVoice?.post({
      type: 'fusionGains',
      gains: Array.from(multipliers),
    });
  }

  getPartialCount(): number {
    return this.shared?.density ?? 6;
  }

  getPartialFrequencies(): number[] {
    if (!this.shared) return [];
    const { rootFreq, spread, density } = this.shared;
    const tuning = this.shared.tuning ?? { system: 'equal' };
    const customScale = this.shared.customScaleRatios;
    const customEq = this.shared.customEqRatio;

    return Array.from({ length: density }, (_, i) => {
      const latticeRatio = resolveLatticeRatio(
        tuning,
        i,
        rootFreq,
        customScale,
        customEq,
      );
      return rootFreq * Math.pow(latticeRatio, spread);
    });
  }

  /** Setter to update piece tempo dynamically on the engine */
  setTempo(bpm: number | null): void {
    this.tempoBpm = bpm;
    if (!this.pulseVoice) return;
    const isTempoSet = bpm !== null ? 1 : 0;
    const bpmVal = bpm !== null ? bpm : 60;
    this.pulseVoice.setParam('tempoSet', isTempoSet);
    this.pulseVoice.setParam('tempoBpm', bpmVal);
  }
}
