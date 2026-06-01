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

/**
 * Supervisor: how long (seconds) the state must be continuously *not* a live
 * chimera before it's declared collapsed and re-perturbed. Long enough to ride
 * through the breathing dips (which momentarily push the incoherent population's
 * order parameter up) without false-triggering.
 */
export const COLLAPSE_HOLD_S = 2.0;

/**
 * Supervisor: after a re-perturbation, suppress further re-perturbations for
 * this long so the freshly re-seeded chimera's transient can settle before it's
 * judged again.
 */
export const REPERTURB_COOLDOWN_S = 3.0;

/**
 * Maximum change in any partial's emitted gain per control tick. The morph
 * itself is slow (tens of seconds) so this never blunts it, but it turns a
 * re-perturbation's gain step into a smooth ~0.5 s glide — the voice guarantees
 * its own bounded slew (the engine's `setTargetAtTime` smooths further), so
 * re-perturbations are inaudible-or-musical, never a click.
 */
export const MAX_GAIN_SLEW = 0.05;

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
  /** Per-partial fusion gain multipliers for the bank (slew-limited). */
  readonly gains: number[];
  /** Population 1 order parameter. */
  readonly pop1: OrderParam;
  /** Population 2 order parameter. */
  readonly pop2: OrderParam;
  /** Whether this state is a live chimera (one pop locked, one incoherent). */
  readonly alive: boolean;
  /** Whether the supervisor re-perturbed (re-seeded) on this tick. */
  readonly reperturbed: boolean;
}

export class ChimeraVoice {
  private phases: number[];
  private readonly Np: number;
  private readonly beta: number;
  private readonly rng: () => number;
  private partialCount: number;
  private A: number;

  // Supervisor state.
  private timeSinceAlive = 0;
  private cooldown = 0;
  private reperturbations = 0;

  // Slew-limited emitted gains (null until the first tick sets the baseline).
  private outGains: number[] | null = null;

  constructor(opts: ChimeraVoiceOptions) {
    this.Np = opts.Np ?? DEFAULT_NP;
    this.beta = opts.beta ?? DEFAULT_BETA;
    this.rng = opts.rng;
    this.partialCount = Math.max(1, Math.floor(opts.partialCount));
    this.A = intensityToA(opts.intensity ?? DEFAULT_CHIMERA_INTENSITY);
    this.phases = seedChimera(this.Np, this.rng);
  }

  /** Total re-perturbations the supervisor has performed (for tests/telemetry). */
  get reperturbationCount(): number {
    return this.reperturbations;
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
   * Advance the two-population system one control step (`dt` seconds), run the
   * supervisor, and return the per-partial fusion gains. Pure-functional
   * internally apart from the voice's own state; carries no audio-thread nodes.
   *
   * The supervisor is what makes this an instrument rather than a demo: even a
   * seeded chimera collapses to global sync on a fraction of seeds, and faster
   * at high intensity. Each tick it watches for collapse (not a live chimera,
   * sustained past `COLLAPSE_HOLD_S`) and re-perturbs by re-seeding the canonical
   * chimera — pop1 a fresh synchronized cluster, pop2 incoherent — which drops
   * the state back into the basin. The re-seed's gain step is bounded by the
   * output slew limiter, so it reads as a gentle timbral shift, not a click.
   */
  tick(dt: number): ChimeraTick {
    const step = chimeraStep(this.phases, this.params, dt);
    this.phases = step.phases;
    let pop1 = step.pop1;
    let pop2 = step.pop2;

    // --- Supervisor: collapse detection → re-perturbation -------------------
    const alive = isChimeraAlive(pop1, pop2);
    this.timeSinceAlive = alive ? 0 : this.timeSinceAlive + dt;
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);

    let reperturbed = false;
    if (this.timeSinceAlive >= COLLAPSE_HOLD_S && this.cooldown === 0) {
      // Re-seed the canonical chimera (re-cluster pop1, re-scatter pop2). This
      // recovers from any failure mode — global sync or mutual incoherence.
      this.phases = seedChimera(this.Np, this.rng);
      pop1 = orderParam(this.phases, 0, this.Np);
      pop2 = orderParam(this.phases, this.Np, this.Np);
      this.timeSinceAlive = 0;
      this.cooldown = REPERTURB_COOLDOWN_S;
      this.reperturbations++;
      reperturbed = true;
    }

    // --- Map coherence → gains, then slew-limit the emitted gains -----------
    const global = orderParam(this.phases, 0, 2 * this.Np);
    const target = chimeraFusionGains(
      pop1,
      pop2,
      global.Phi,
      this.partialCount,
      CHIMERA_AMOUNT,
    );
    const gains = this.slewTowards(target);

    return { gains, pop1, pop2, alive, reperturbed };
  }

  /**
   * Move the emitted gains toward `target`, clamping each partial's change to
   * `MAX_GAIN_SLEW` per tick. The first call (or a partial-count change) snaps
   * to the target so there's no startup fade.
   */
  private slewTowards(target: readonly number[]): number[] {
    if (!this.outGains || this.outGains.length !== target.length) {
      this.outGains = [...target];
      return [...this.outGains];
    }
    for (let i = 0; i < target.length; i++) {
      const cur = this.outGains[i]!;
      const delta = target[i]! - cur;
      const step =
        delta > MAX_GAIN_SLEW
          ? MAX_GAIN_SLEW
          : delta < -MAX_GAIN_SLEW
            ? -MAX_GAIN_SLEW
            : delta;
      this.outGains[i] = cur + step;
    }
    return [...this.outGains];
  }
}
