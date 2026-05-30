import { HARMONICS } from '@/types/audio';
import { partialShape } from '@/audio/engines/shape';
import { GrainCloud } from '@/audio/granular/GrainCloud';
import { SOURCES, resolveSource } from '@/audio/sources/registry';
import { loadSource } from '@/audio/sources/loader';
import type {
  AnnealEngine,
  AnnealEngineCapabilities,
  EngineParamDef,
  EngineParams,
  SharedParams,
} from '@/audio/engines/types';
import { resolveLatticeRatio } from '@/audio/tuning/resolver';

/** Longer crossfade than sine/FM to mask granular start-up jitter. */
const GRANULAR_CROSSFADE_MS = 800;
/** Autonomous positionCenter random-walk rate (per second) + tick cadence. */
const CENTER_DRIFT_PER_SEC = 0.1;
const CENTER_DRIFT_MS = 100;
/** Soft ceiling on total live grains; spread evenly across partials. */
const MAX_LIVE_GRAINS = 120;

interface GranularNumericParams {
  source: number | string;
  size: number;
  density: number;
  posJitter: number;
  pitchJitter: number;
  posCenter: number;
}

const DEFAULTS: GranularNumericParams = {
  source: 0,
  size: 120,
  density: 14,
  posJitter: 0.3,
  pitchJitter: 0,
  posCenter: 0.5,
};

const PARAM_DEFS: readonly EngineParamDef[] = [
  {
    key: 'source',
    label: 'Source',
    min: 0,
    max: SOURCES.length - 1,
    step: 1,
    default: 0,
    fmt: (v) => {
      const resolved = resolveSource(v);
      return resolved.label;
    },
  },
  {
    key: 'size',
    label: 'Grain',
    min: 30,
    max: 300,
    step: 1,
    default: DEFAULTS.size,
    fmt: (v) => `${v.toFixed(0)} ms`,
  },
  {
    key: 'density',
    label: 'Density',
    min: 4,
    max: 40,
    step: 1,
    default: DEFAULTS.density,
    fmt: (v) => `${v.toFixed(0)}/s`,
  },
  {
    key: 'posJitter',
    label: 'Jitter',
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULTS.posJitter,
    fmt: (v) => v.toFixed(2),
  },
  {
    key: 'pitchJitter',
    label: 'Pitch Jit',
    min: 0,
    max: 100,
    step: 1,
    default: DEFAULTS.pitchJitter,
    fmt: (v) => `${v.toFixed(0)}¢`,
  },
  {
    key: 'posCenter',
    label: 'Center',
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULTS.posCenter,
    fmt: (v) => v.toFixed(2),
  },
];

interface GranularPartial {
  readonly cloud: GrainCloud;
  readonly ratio: number;
  readonly index: number;
  /** Undetuned partial frequency (Hz). */
  freq: number;
  /** Static cents offset mapping this partial's pitch to the source. */
  pitchOffsetBase: number;
  /** Live drift detune (cents). */
  detune: number;
  /** Static per-partial gain. */
  gain: number;
}

/** Resolver for a source buffer, injectable for tests. */
export type SourceLoader = (
  ctx: AudioContext,
  sourceVal: string | number,
) => Promise<AudioBuffer>;

/**
 * Granular engine: N grain clouds over the harmonic lattice (one per partial),
 * all reading the same selected source buffer. Each partial's pitch maps to its
 * cloud's `pitchOffset` (cents relative to the source's reference pitch), so
 * grains play the source faster/slower to voice the harmonic. Drift detune flows
 * in through `setPartialDetune` exactly as for sine/FM. The grain texture params
 * (size, density, jitters, center) are shared across the bank; `positionCenter`
 * also drifts autonomously so a static patch still moves. Source loading is
 * lazy + async — clouds start once the buffer arrives, and the orchestrator's
 * bus fade masks the gap.
 */
export class GranularEngine implements AnnealEngine {
  readonly id = 'granular' as const;
  readonly capabilities: AnnealEngineCapabilities = {
    densityLockedWhilePlaying: true,
    params: PARAM_DEFS,
    crossfadeMs: GRANULAR_CROSSFADE_MS,
  };

  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private partials: GranularPartial[] = [];
  private shared: SharedParams | null = null;
  private params: GranularNumericParams = { ...DEFAULTS };
  private sourceVal: string | number = DEFAULTS.source;
  private sourceIndex: number = 0;
  private liveCenter = DEFAULTS.posCenter;
  private centerTimer: ReturnType<typeof setInterval> | null = null;
  private loadToken = 0;
  private stopped = false;

  constructor(
    private readonly loadFn: SourceLoader = loadSource,
    private readonly random: () => number = Math.random,
  ) {}

  start(ctx: AudioContext, shared: SharedParams, engine: EngineParams): void {
    if (this.ctx)
      throw new Error('GranularEngine.start called while already started');

    this.ctx = ctx;
    this.shared = { ...shared };
    this.params = { ...DEFAULTS, ...engine };
    this.sourceVal = this.params.source ?? DEFAULTS.source;

    const resolved = resolveSource(this.sourceVal);
    if (resolved.type === 'bundled') {
      const def = SOURCES.find((s) => s.id === resolved.id);
      this.sourceIndex = def ? def.index : 0;
    } else {
      this.sourceIndex = -1;
    }

    this.liveCenter = this.params.posCenter;
    this.stopped = false;

    const out = ctx.createGain();
    out.gain.value = 1;
    this.out = out;

    const tuning = shared.tuning ?? { system: 'equal' };
    const customScale = shared.customScaleRatios;
    const customEq = shared.customEqRatio;

    this.partials = HARMONICS.slice(0, shared.density).map((ratio, i) => {
      const cloud = new GrainCloud(ctx, this.random);
      cloud.getOutputNode().connect(out);
      const latticeRatio = resolveLatticeRatio(
        tuning,
        i,
        shared.rootFreq,
        customScale,
        customEq,
      );
      const freq = shared.rootFreq * Math.pow(latticeRatio, shared.spread);
      const { baselineOffset } = partialShape(i);
      return {
        cloud,
        ratio,
        index: i,
        freq,
        pitchOffsetBase: this.pitchOffsetFor(freq, this.sourceVal),
        detune: 0,
        gain: baselineOffset,
      };
    });

    this.loadAndStart(this.sourceVal);
    this.startCenterDrift();
  }

  /** Map a partial frequency to cents relative to the source reference pitch. */
  private pitchOffsetFor(freq: number, sourceVal: string | number): number {
    const resolved = resolveSource(sourceVal);
    const def =
      resolved.type === 'bundled'
        ? SOURCES.find((s) => s.id === resolved.id)
        : undefined;
    const ref = def?.fundamentalHz ?? this.shared?.rootFreq ?? freq;
    if (ref <= 0 || freq <= 0) return 0;
    return 1200 * Math.log2(freq / ref);
  }

  /** Per-cloud grain ceiling so the bank stays under the soft total. */
  private maxGrainsPerCloud(): number {
    return Math.max(
      4,
      Math.floor(MAX_LIVE_GRAINS / Math.max(1, this.partials.length)),
    );
  }

  /** Lazily load the source and (re)start every cloud on the resolved buffer. */
  private loadAndStart(sourceVal: string | number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const token = ++this.loadToken;
    void this.loadFn(ctx, sourceVal)
      .then((buffer) => {
        // A newer load (or a stop) superseded this one — discard.
        if (this.stopped || token !== this.loadToken || !this.ctx) return;
        const maxGrains = this.maxGrainsPerCloud();
        for (const p of this.partials) {
          if (p.cloud.isRunning()) {
            p.cloud.setParams({ source: buffer });
          } else {
            p.cloud.start({
              source: buffer,
              sizeMs: this.params.size,
              density: this.params.density,
              positionJitter: this.params.posJitter,
              pitchJitter: this.params.pitchJitter,
              positionCenter: this.liveCenter,
              pitchOffset: p.pitchOffsetBase + p.detune,
              gain: p.gain,
              maxGrains,
            });
          }
        }
      })
      .catch(() => {
        // Load failed — stay silent on the previous buffer (if any). The UI
        // surfaces the error; the field never stutters or crashes.
      });
  }

  private startCenterDrift(): void {
    if (this.centerTimer !== null) return;
    const dt = CENTER_DRIFT_MS / 1000;
    this.centerTimer = setInterval(() => {
      const step = (this.random() * 2 - 1) * CENTER_DRIFT_PER_SEC * dt;
      this.liveCenter = Math.max(0, Math.min(1, this.liveCenter + step));
      for (const p of this.partials) {
        if (p.cloud.isRunning()) {
          p.cloud.setParams({ positionCenter: this.liveCenter });
        }
      }
    }, CENTER_DRIFT_MS);
  }

  private stopCenterDrift(): void {
    if (this.centerTimer !== null) clearInterval(this.centerTimer);
    this.centerTimer = null;
  }

  stop(fadeSeconds = 0): Promise<void> {
    this.stopped = true;
    this.stopCenterDrift();
    const out = this.out;
    const ctx = this.ctx;
    const partials = this.partials;

    this.ctx = null;
    this.out = null;
    this.partials = [];
    this.shared = null;

    if (out && ctx && fadeSeconds > 0) {
      try {
        out.gain.cancelScheduledValues(ctx.currentTime);
        out.gain.setTargetAtTime(0, ctx.currentTime, fadeSeconds / 3);
      } catch {
        // node may be mid-teardown; ignore
      }
    }

    return Promise.all(partials.map((p) => p.cloud.stop(fadeSeconds))).then(
      () => undefined,
    );
  }

  getOutputNode(): AudioNode {
    if (!this.out)
      throw new Error('GranularEngine has no output node (not started)');
    return this.out;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setSharedParams(
    partial: Partial<SharedParams>,
    _targetTime?: number,
    _instant?: boolean,
  ): void {
    if (!this.shared) return;
    this.shared = { ...this.shared, ...partial };
    if (
      partial.rootFreq === undefined &&
      partial.spread === undefined &&
      partial.tuning === undefined
    )
      return;
    const {
      rootFreq,
      spread,
      tuning: activeTuning,
      customScaleRatios,
      customEqRatio,
    } = this.shared;
    const tuning = activeTuning ?? { system: 'equal' };
    for (const p of this.partials) {
      const latticeRatio = resolveLatticeRatio(
        tuning,
        p.index,
        rootFreq,
        customScaleRatios,
        customEqRatio,
      );
      p.freq = rootFreq * Math.pow(latticeRatio, spread);
      p.pitchOffsetBase = this.pitchOffsetFor(p.freq, this.sourceVal);
      p.cloud.setPitchOffset(p.pitchOffsetBase + p.detune);
    }
  }

  setEngineParams(partial: Partial<EngineParams>): void {
    this.params = {
      ...this.params,
      ...(partial as Partial<GranularNumericParams>),
    };

    if (partial.source !== undefined && partial.source !== this.sourceVal) {
      this.sourceVal = partial.source;
      const resolved = resolveSource(this.sourceVal);
      if (resolved.type === 'bundled') {
        const def = SOURCES.find((s) => s.id === resolved.id);
        this.sourceIndex = def ? def.index : 0;
      } else {
        this.sourceIndex = -1;
      }
      this.loadAndStart(this.sourceVal);
    }

    if (partial.posCenter !== undefined) {
      this.liveCenter = this.params.posCenter;
    }

    const cloudUpdate: Record<string, number> = {};
    if (partial.size !== undefined) cloudUpdate.sizeMs = this.params.size;
    if (partial.density !== undefined)
      cloudUpdate.density = this.params.density;
    if (partial.posJitter !== undefined)
      cloudUpdate.positionJitter = this.params.posJitter;
    if (partial.pitchJitter !== undefined)
      cloudUpdate.pitchJitter = this.params.pitchJitter;
    if (partial.posCenter !== undefined)
      cloudUpdate.positionCenter = this.params.posCenter;

    if (Object.keys(cloudUpdate).length > 0) {
      for (const p of this.partials) p.cloud.setParams(cloudUpdate);
    }
  }

  setPartialDetune(index: number, cents: number): void {
    const p = this.partials[index];
    if (!p) return;
    p.detune = cents;
    p.cloud.setPitchOffset(p.pitchOffsetBase + cents);
  }

  getPartialCount(): number {
    return this.partials.length;
  }

  getPartialFrequencies(): number[] {
    return this.partials.map((p) => p.freq);
  }

  /** Diagnostics for tests. */
  getSourceIndex(): number {
    return this.sourceIndex;
  }

  getPitchOffsets(): number[] {
    return this.partials.map((p) => p.pitchOffsetBase);
  }

  getPartialOutputs(): AudioNode[] {
    return this.partials.map((p) => p.cloud.getOutputNode());
  }
}

/** The soft total-grain ceiling, exposed for docs/tests. */
export const GRANULAR_MAX_LIVE_GRAINS = MAX_LIVE_GRAINS;
