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
    fmt: (v) => SUBDIVISIONS[Math.max(0, Math.min(5, Math.round(v)))] ?? 'Quarter',
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

const defaultFactory: WorkletNodeFactory = (ctx, processor) => {
  const node = new AudioWorkletNode(ctx, processor, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  return {
    node,
    setParam(name, value, targetTime, instant) {
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
    post(message) {
      node.port.postMessage(message);
    },
    dispose() {
      try {
        node.disconnect();
      } catch {
        // already detached
      }
    },
  };
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

  start(ctx: AudioContext, shared: SharedParams, engine: EngineParams): void {
    if (this.ctx) {
      throw new Error('PulseEngine.start called while already started');
    }
    if (!this.supported(ctx)) {
      throw new Error('Pulse engine requires AudioWorklet support');
    }

    this.ctx = ctx;
    this.shared = { ...shared };
    this.params = { ...DEFAULTS, ...(engine as any) };
    this.stopped = false;

    // Use current orchestrator piece tempo if available
    const tempoVal = (ctx as any)._tempoBpm !== undefined ? (ctx as any)._tempoBpm : null;
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

        // Apply parameters to the worklet node
        (voice as any).setParam('f0', this.shared?.rootFreq ?? 110);
        (voice as any).setParam('spread', this.shared?.spread ?? 1.0);
        (voice as any).setParam('densityVal', this.shared?.density ?? 6);
        (voice as any).setParam('detune', 0);

        // Set pulse-specific parameters
        (voice as any).setParam('density', this.params.density);
        (voice as any).setParam('accent', this.params.accent);
        (voice as any).setParam('tone', this.params.tone);
        (voice as any).setParam('swing', this.params.swing);
        (voice as any).setParam('humanize', this.params.humanize);

        // Apply tempo
        const isTempoSet = this.tempoBpm !== null ? 1 : 0;
        const bpm = this.tempoBpm !== null ? this.tempoBpm : 60;
        (voice as any).setParam('tempoSet', isTempoSet);
        (voice as any).setParam('tempoBpm', bpm);

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

  setSharedParams(partial: Partial<SharedParams>, targetTime?: number, instant?: boolean): void {
    if (!this.shared) return;
    this.shared = { ...this.shared, ...partial };
    if (!this.voice) return;

    if (partial.rootFreq !== undefined) {
      (this.voice as any).setParam('f0', partial.rootFreq, targetTime, instant);
    }
    if (partial.spread !== undefined) {
      (this.voice as any).setParam('spread', partial.spread, targetTime, instant);
    }
    if (partial.density !== undefined) {
      (this.voice as any).setParam('densityVal', partial.density, targetTime, instant);
    }
  }

  setEngineParams(partial: Partial<EngineParams>): void {
    this.params = {
      ...this.params,
      ...(partial as any),
    };
    if (!this.voice) return;

    if (partial.density !== undefined) {
      (this.voice as any).setParam('density', Number(partial.density));
    }
    if (partial.accent !== undefined) {
      (this.voice as any).setParam('accent', Number(partial.accent));
    }
    if (partial.tone !== undefined) {
      (this.voice as any).setParam('tone', Number(partial.tone));
    }
    if (partial.swing !== undefined) {
      (this.voice as any).setParam('swing', Number(partial.swing));
    }
    if (partial.humanize !== undefined) {
      (this.voice as any).setParam('humanize', Number(partial.humanize));
    }
  }

  setPartialDetune(index: number, cents: number): void {
    // Pulse engine modulates detune globally or on partial index 0 for simplicity
    if (index === 0 && this.voice) {
      (this.voice as any).setParam('detune', cents);
    }
  }

  getPartialCount(): number {
    return this.shared?.density ?? 6;
  }

  getPartialFrequencies(): number[] {
    if (!this.shared) return [];
    const { rootFreq, spread, density } = this.shared;
    const HARMONICS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5];
    return HARMONICS.slice(0, density).map((ratio) =>
      rootFreq * Math.pow(ratio, spread)
    );
  }

  /** Setter to update piece tempo dynamically on the engine */
  setTempo(bpm: number | null): void {
    this.tempoBpm = bpm;
    if (!this.voice) return;
    const isTempoSet = bpm !== null ? 1 : 0;
    const bpmVal = bpm !== null ? bpm : 60;
    (this.voice as any).setParam('tempoSet', isTempoSet);
    (this.voice as any).setParam('tempoBpm', bpmVal);
  }
}
