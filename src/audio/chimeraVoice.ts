/**
 * Control-rate driver for the identical-ω chimera voice.
 *
 * Holds the (audio-thread-adjacent but pure-math) two-population phase state and
 * advances it one control step per call, returning the per-partial fusion gains
 * the orchestrator pushes to the chimera engine's partial bank. All randomness
 * is via the injected `rng`, so a seeded run is fully reproducible and a
 * `*.test.ts` can assert morph behavior offline (the orchestrator passes
 * `Math.random` in production).
 *
 * This module is the *engine* of the voice; `chimera.ts` is the pure math it
 * runs and `fusion.ts` is the gain law it reuses. The supervisor that keeps the
 * voice in the chimera basin over a long session lives here too (built on the
 * pure collapse-detector helpers in `chimera.ts`).
 */
import {
  chimeraFusionGains,
  chimeraStep,
  intensityToA,
  isChimeraAlive,
  orderParam,
  seedChimera,
  DEFAULT_BETA,
  type ChimeraParams,
  type OrderParam,
} from '@/audio/chimera';

/** Gentle, meditation/ambient-appropriate default intensity (A ≈ 0.44). */
export const DEFAULT_CHIMERA_INTENSITY = 0.2;

/** Oscillators per population. 64 ⇒ basin ~92% (see CHIMERA_CHARACTERIZATION). */
export const DEFAULT_NP = 64;

/**
 * Fusion reshaping depth-amount for the chimera morph. Fixed at full strength:
 * the morph *is* the voice, and `chimeraFusionGains` already gates the
 * incoherent band to ~unity via `R`, so this only sets how strongly the locked
 * band is reinforced. (The user-facing control is the basin↔morph `intensity`,
 * not this.)
 */
export const CHIMERA_AMOUNT = 1.0;

export interface ChimeraVoiceOptions {
  /** Number of partials in the bank to drive (the engine's partial count). */
  readonly partialCount: number;
  /** Randomness source (seed draws + re-perturbation). Injectable for tests. */
  readonly rng: () => number;
  /** Basin↔morph intensity 0..1 (default gentle ≈0.2). */
  readonly intensity?: number;
  /** Oscillators per population (default 64). */
  readonly Np?: number;
  /** Phase lag β (default 0.02). */
  readonly beta?: number;
}

/** Result of one control-rate tick. */
export interface ChimeraTick {
  /** Per-partial fusion gain multipliers for the bank. */
  readonly gains: number[];
  /** Population 1 order parameter. */
  readonly pop1: OrderParam;
  /** Population 2 order parameter. */
  readonly pop2: OrderParam;
}

export class ChimeraVoice {
  private phases: number[];
  private readonly Np: number;
  private readonly beta: number;
  private readonly rng: () => number;
  private partialCount: number;
  private A: number;

  constructor(opts: ChimeraVoiceOptions) {
    this.Np = opts.Np ?? DEFAULT_NP;
    this.beta = opts.beta ?? DEFAULT_BETA;
    this.rng = opts.rng;
    this.partialCount = Math.max(1, Math.floor(opts.partialCount));
    this.A = intensityToA(opts.intensity ?? DEFAULT_CHIMERA_INTENSITY);
    this.phases = seedChimera(this.Np, this.rng);
  }

  /** Update the basin↔morph intensity (0..1) live. */
  setIntensity(intensity: number): void {
    this.A = intensityToA(intensity);
  }

  /** Update the number of partials driven (clamped ≥ 1). */
  setPartialCount(count: number): void {
    this.partialCount = Math.max(1, Math.floor(count));
  }

  /** Current coupling disparity A (for tests/inspection). */
  get couplingDisparity(): number {
    return this.A;
  }

  private get params(): ChimeraParams {
    return { Np: this.Np, A: this.A, beta: this.beta };
  }

  /** Is the current state a live chimera (one pop locked, one incoherent)? */
  isAlive(): boolean {
    const pop1 = orderParam(this.phases, 0, this.Np);
    const pop2 = orderParam(this.phases, this.Np, this.Np);
    return isChimeraAlive(pop1, pop2);
  }

  /**
   * Advance the two-population system one control step (`dt` seconds) and return
   * the per-partial fusion gains. Pure-functional internally apart from the
   * voice's own phase state; carries no audio-thread nodes.
   */
  tick(dt: number): ChimeraTick {
    const step = chimeraStep(this.phases, this.params, dt);
    this.phases = step.phases;
    const global = orderParam(this.phases, 0, 2 * this.Np);
    const gains = chimeraFusionGains(
      step.pop1,
      step.pop2,
      global.Phi,
      this.partialCount,
      CHIMERA_AMOUNT,
    );
    return { gains, pop1: step.pop1, pop2: step.pop2 };
  }
}
