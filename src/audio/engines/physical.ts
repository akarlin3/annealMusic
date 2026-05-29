import { HARMONICS } from '@/types/audio';
import { partialShape } from '@/audio/engines/shape';
import { PLATE_MODES } from '@/audio/engines/physical-dsp/plate';
import type {
  AnnealEngine,
  AnnealEngineCapabilities,
  EngineParamDef,
  EngineParams,
  SharedParams,
} from '@/audio/engines/types';

/** Sub-models, indexed so the value rides the numeric engine-param bag + URL. */
export const PHYSICAL_MODELS = ['string', 'tube', 'plate'] as const;
export type PhysicalModel = (typeof PHYSICAL_MODELS)[number];

const PROCESSOR_BY_MODEL: Record<PhysicalModel, string> = {
  string: 'string-processor',
  tube: 'tube-processor',
  plate: 'plate-processor',
};

/** Longer crossfade than sine/FM to mask resonator ring-up on a swap. */
const PHYSICAL_CROSSFADE_MS = 900;

/** Thrown when the platform can't run the physical engine (no AudioWorklet). */
export class PhysicalUnsupportedError extends Error {
  constructor() {
    super('Physical engine requires AudioWorklet, unavailable on this device');
    this.name = 'PhysicalUnsupportedError';
  }
}

interface PhysicalNumericParams {
  model: number;
  excitationLevel: number;
  damping: number;
  brightness: number;
  reed: number;
  inharm: number;
}

const DEFAULTS: PhysicalNumericParams = {
  model: 0,
  excitationLevel: 0.5,
  damping: 0.4,
  brightness: 0.5,
  reed: 0.5,
  inharm: 0.5,
};

function modelName(index: number): PhysicalModel {
  return (
    PHYSICAL_MODELS[Math.max(0, Math.min(2, Math.round(index)))] ?? 'string'
  );
}

const PARAM_DEFS: readonly EngineParamDef[] = [
  {
    key: 'model',
    label: 'Model',
    min: 0,
    max: PHYSICAL_MODELS.length - 1,
    step: 1,
    default: DEFAULTS.model,
    fmt: (v) => modelName(v),
  },
  {
    key: 'excitationLevel',
    label: 'Excite',
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULTS.excitationLevel,
    fmt: (v) => v.toFixed(2),
  },
  {
    key: 'damping',
    label: 'Damping',
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULTS.damping,
    fmt: (v) => v.toFixed(2),
  },
  {
    key: 'brightness',
    label: 'Brightness',
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULTS.brightness,
    fmt: (v) => v.toFixed(2),
  },
  {
    key: 'reed',
    label: 'Reed',
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULTS.reed,
    fmt: (v) => v.toFixed(2),
  },
  {
    key: 'inharm',
    label: 'Inharm',
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULTS.inharm,
    fmt: (v) => v.toFixed(2),
  },
];

/** AudioParam names exposed by every physical worklet processor. */
export type PhysicalParam =
  | 'f0'
  | 'excitation'
  | 'damping'
  | 'brightness'
  | 'detune'
  | 'reed'
  | 'inharm';

/**
 * One physical voice (a single AudioWorklet processor instance). Abstracted so
 * the engine is unit-testable with a mock factory — exactly as the granular
 * engine injects its source loader.
 */
export interface PhysicalVoiceNode {
  /** The underlying node, routed into the engine's output gain. */
  readonly node: AudioNode;
  /** Smoothly set a k-rate param (no-op if the processor lacks it). */
  setParam(name: PhysicalParam, value: number): void;
  /** Structural message to the processor (e.g. plate mode count). */
  post(message: unknown): void;
  /** Disconnect + tear down. */
  dispose(): void;
}

export type WorkletNodeFactory = (
  ctx: AudioContext,
  processor: string,
) => PhysicalVoiceNode;

export type ModuleRegistrar = (ctx: AudioContext) => Promise<void>;
export type SupportProbe = (ctx: AudioContext) => boolean;

interface PhysicalPartial {
  readonly ratio: number;
  freq: number;
  detune: number;
  gain: number;
  node: PhysicalVoiceNode | null;
}

// ---- default (real-worklet) wiring --------------------------------------

/**
 * The pre-bundled, self-contained worklet script (built by
 * `vite.worklet.config.ts`, served from `public/worklets/`). One `addModule`
 * registers all three processors; it is a classic worklet script (no module
 * imports), so it loads in every browser.
 */
const WORKLET_URL = `${import.meta.env.BASE_URL}worklets/physical.js`;

const moduleLoaded = new WeakMap<AudioContext, Promise<void>>();

export const isPhysicalSupported: SupportProbe = (ctx) =>
  typeof ctx.audioWorklet?.addModule === 'function' &&
  typeof AudioWorkletNode === 'function';

/** Lazily register the processor bundle on first physical select. */
export const registerPhysicalModules: ModuleRegistrar = (ctx) => {
  let loaded = moduleLoaded.get(ctx);
  if (!loaded) {
    loaded = ctx.audioWorklet.addModule(WORKLET_URL);
    moduleLoaded.set(ctx, loaded);
  }
  return loaded;
};

const defaultFactory: WorkletNodeFactory = (ctx, processor) => {
  const node = new AudioWorkletNode(ctx, processor, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  return {
    node,
    setParam(name, value) {
      const p = node.parameters.get(name);
      if (p) p.setTargetAtTime(value, ctx.currentTime, 0.05);
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

/**
 * Physical-modeling engine: one AudioWorklet processor per partial over the
 * harmonic lattice, running string / tube / plate digital-waveguide & modal DSP.
 * Continuous (noise) excitation, so it sustains for ambient use. Worklet modules
 * register lazily on first select; if the platform lacks AudioWorklet, `start`
 * throws `PhysicalUnsupportedError` so the orchestrator can refuse the swap.
 *
 * Node creation is async (worklet modules must register first), so — exactly
 * like the granular engine's lazy source load — partial *metadata* (count,
 * frequencies, detune) is available synchronously while the audio nodes attach
 * once registration resolves, under cover of the orchestrator's bus fade.
 */
export class PhysicalEngine implements AnnealEngine {
  readonly id = 'physical' as const;
  readonly capabilities: AnnealEngineCapabilities = {
    densityLockedWhilePlaying: true,
    params: PARAM_DEFS,
    crossfadeMs: PHYSICAL_CROSSFADE_MS,
  };

  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private partials: PhysicalPartial[] = [];
  private shared: SharedParams | null = null;
  private params: PhysicalNumericParams = { ...DEFAULTS };
  private model: PhysicalModel = 'string';
  private buildToken = 0;
  private stopped = false;
  private onError: ((error: Error) => void) | null = null;

  setErrorHandler(fn: (error: Error) => void): void {
    this.onError = fn;
  }

  constructor(
    private readonly factory: WorkletNodeFactory = defaultFactory,
    private readonly register: ModuleRegistrar = registerPhysicalModules,
    private readonly supported: SupportProbe = isPhysicalSupported,
  ) {}

  start(ctx: AudioContext, shared: SharedParams, engine: EngineParams): void {
    if (this.ctx)
      throw new Error('PhysicalEngine.start called while already started');
    if (!this.supported(ctx)) throw new PhysicalUnsupportedError();

    this.ctx = ctx;
    this.shared = { ...shared };
    this.params = { ...DEFAULTS, ...engine };
    this.model = modelName(this.params.model);
    this.stopped = false;

    const out = ctx.createGain();
    out.gain.value = 1;
    this.out = out;

    this.partials = HARMONICS.slice(0, shared.density).map((ratio, i) => ({
      ratio,
      freq: shared.rootFreq * Math.pow(ratio, shared.spread),
      detune: 0,
      gain: partialShape(i).baselineOffset,
      node: null,
    }));

    this.build();
  }

  /** (Re)create the worklet voice nodes for the current model. */
  private build(): void {
    const ctx = this.ctx;
    const out = this.out;
    if (!ctx || !out) return;
    const token = ++this.buildToken;
    const processor = PROCESSOR_BY_MODEL[this.model];

    void this.register(ctx)
      .then(() => {
        if (this.stopped || token !== this.buildToken || !this.ctx) return;
        for (const p of this.partials) {
          const voice = this.factory(ctx, processor);
          voice.node.connect(out);
          voice.setParam('f0', p.freq);
          voice.setParam(
            'excitation',
            this.params.excitationLevel * p.gain * 4,
          );
          voice.setParam('damping', this.params.damping);
          voice.setParam('brightness', this.params.brightness);
          voice.setParam('detune', p.detune);
          voice.setParam('reed', this.params.reed);
          voice.setParam('inharm', this.params.inharm);
          if (this.model === 'plate') voice.post({ modes: PLATE_MODES });
          p.node = voice;
        }
      })
      .catch((err: unknown) => {
        // Surface, never swallow: the orchestrator's error hook shows a toast.
        if (this.stopped || token !== this.buildToken) return;
        const error = err instanceof Error ? err : new Error(String(err));
        if (this.onError) this.onError(error);
        else console.error('[physical] worklet load failed', error);
      });
  }

  /** Tear down all current voice nodes (model swap / stop). */
  private teardownVoices(): void {
    for (const p of this.partials) {
      p.node?.dispose();
      p.node = null;
    }
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
        // node may be mid-teardown; ignore
      }
    }

    this.teardownVoices();
    this.partials = [];
    this.ctx = null;
    this.out = null;
    this.shared = null;
    return Promise.resolve();
  }

  getOutputNode(): AudioNode {
    if (!this.out)
      throw new Error('PhysicalEngine has no output node (not started)');
    return this.out;
  }

  setSharedParams(partial: Partial<SharedParams>): void {
    if (!this.shared) return;
    this.shared = { ...this.shared, ...partial };
    if (partial.rootFreq === undefined && partial.spread === undefined) return;
    const { rootFreq, spread } = this.shared;
    for (const p of this.partials) {
      p.freq = rootFreq * Math.pow(p.ratio, spread);
      p.node?.setParam('f0', p.freq);
    }
  }

  setEngineParams(partial: Partial<EngineParams>): void {
    this.params = {
      ...this.params,
      ...(partial as Partial<PhysicalNumericParams>),
    };

    // Model swap: rebuild every voice on the new processor.
    if (partial.model !== undefined) {
      const modelVal =
        typeof partial.model === 'string'
          ? parseFloat(partial.model)
          : partial.model;
      const next = modelName(modelVal);
      if (next !== this.model) {
        this.model = next;
        this.teardownVoices();
        this.build();
        return;
      }
    }

    if (partial.excitationLevel !== undefined) {
      for (const p of this.partials)
        p.node?.setParam(
          'excitation',
          this.params.excitationLevel * p.gain * 4,
        );
    }
    if (partial.damping !== undefined)
      for (const p of this.partials)
        p.node?.setParam('damping', this.params.damping);
    if (partial.brightness !== undefined)
      for (const p of this.partials)
        p.node?.setParam('brightness', this.params.brightness);
    if (partial.reed !== undefined)
      for (const p of this.partials) p.node?.setParam('reed', this.params.reed);
    if (partial.inharm !== undefined)
      for (const p of this.partials)
        p.node?.setParam('inharm', this.params.inharm);
  }

  setPartialDetune(index: number, cents: number): void {
    const p = this.partials[index];
    if (!p) return;
    p.detune = cents;
    p.node?.setParam('detune', cents);
  }

  getPartialCount(): number {
    return this.partials.length;
  }

  getPartialFrequencies(): number[] {
    return this.partials.map((p) => p.freq);
  }

  /** Diagnostics for tests. */
  getModel(): PhysicalModel {
    return this.model;
  }
}
