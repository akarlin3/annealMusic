/**
 * Two-population Sakaguchi chimera core — the identical-ω synthesis voice's
 * control-rate engine.
 *
 * This is the **pure, deterministic** port of the verified Build-B probe
 * (`examples/probes/chimera_probe.mjs`, characterized in
 * `docs/CHIMERA_CHARACTERIZATION.md`). It carries no audio-thread state and
 * takes its randomness only through an injected `rng`, so the same seed →
 * the same trajectory, and a `*.test.ts` can assert morph behavior offline
 * (mirroring `kuramoto.ts` / `fusion.ts`). The probe stays as the offline
 * reference; this module is what the orchestrator runs.
 *
 * ## Model (Abrams, Mirollo, Strogatz & Wiley 2008)
 *
 * Two equal populations σ ∈ {1, 2} of `Np` oscillators each, identical natural
 * frequency ω (= 0 in the rotating frame — the **identical-ω requirement** that
 * makes this a separate voice from the spread-ω engine). Intra-population
 * coupling μ = (1+A)/2, inter-population coupling ν = (1−A)/2 (so μ + ν = 1 and
 * A = μ − ν is the coupling **disparity**), phase lag α = π/2 − β:
 *
 *   dθᵢ^σ/dt = ω
 *     + μ·R_σ ·sin(Φ_σ  − θᵢ^σ − α)
 *     + ν·R_σ'·sin(Φ_σ' − θᵢ^σ − α)
 *
 * where R_σ·e^{iΦ_σ} = (1/Np)·Σⱼ e^{iθⱼ^σ} is the per-population complex order
 * parameter. The mean-field form is *exact* for all-to-all coupling, so each
 * step is O(N) rather than O(N²). Integrated with RK4 at `dt`.
 *
 * ## Operating regime (verified, see CHIMERA_CHARACTERIZATION.md)
 *
 * - β ∈ [0.02, 0.05]; A ∈ [0.2, 0.5] (wider basin at larger A, larger morph at
 *   smaller A — the basin↔morph trade-off that the intensity control exposes).
 * - Np ≥ 32 (basin ~92% at Np=64, A=0.5, β=0.02).
 * - Chimeras must be **seeded**, not awaited: pop1 a tight synchronized cluster,
 *   pop2 incoherent. Even seeded, a minority of seeds collapse to global sync —
 *   the voice's supervisor detects that and re-perturbs (see `chimeraSplit`,
 *   `isChimeraAlive`, and the supervisor built on them).
 */

import { fusionMultiplier } from '@/audio/fusion';

/** Default phase lag β (α = π/2 − β). The probe's most reliable regime. */
export const DEFAULT_BETA = 0.02;

/** Half-width (rad) of the seeded synchronized cluster at t = 0. */
export const SEED_JITTER = 0.25;

/** A locked population has order parameter above this. */
export const SYNC_HI = 0.9;

/** An incoherent population has order parameter below this. */
export const INCOH_LO = 0.85;

const TAU = 2 * Math.PI;

/** Parameters of the two-population system. */
export interface ChimeraParams {
  /** Oscillators per population (≥ 32 for a reliable basin). */
  readonly Np: number;
  /** Coupling disparity A = μ − ν ∈ (0, 1). */
  readonly A: number;
  /** Phase lag β; α = π/2 − β. */
  readonly beta: number;
}

/** A population's complex order parameter: magnitude `R` and mean phase `Phi`. */
export interface OrderParam {
  readonly R: number;
  readonly Phi: number;
}

/**
 * Map the user-facing intensity (0..1) to the coupling disparity A, exposing the
 * **basin↔morph trade-off**: low intensity → A ≈ 0.5 (wide basin, gentle
 * breath), high intensity → A ≈ 0.2 (bigger, faster morph that needs more
 * supervision). Clamped to the verified-stable band A ∈ [0.2, 0.5].
 */
export function intensityToA(intensity: number): number {
  const t = intensity < 0 ? 0 : intensity > 1 ? 1 : intensity;
  return 0.5 - 0.3 * t;
}

/**
 * Complex order parameter of a contiguous block of `count` phases starting at
 * `start`. Mirrors the order parameter in `kuramoto.ts` (and the probe).
 */
export function orderParam(
  phases: readonly number[] | Float64Array,
  start: number,
  count: number,
): OrderParam {
  let c = 0;
  let s = 0;
  for (let k = 0; k < count; k++) {
    const th = phases[start + k]!;
    c += Math.cos(th);
    s += Math.sin(th);
  }
  c /= count;
  s /= count;
  return { R: Math.sqrt(c * c + s * s), Phi: Math.atan2(s, c) };
}

/**
 * The canonical chimera seed: population 1 a tight synchronized cluster about a
 * random anchor phase (R₁ ≈ 1, ±`jitter` rad), population 2 incoherent (uniform
 * on the circle). This places the state near the chimera manifold — the state
 * Build A seeds rather than awaits. Deterministic under the injected `rng`; the
 * rng is consumed in the same order as the probe (anchor, Np jitter draws, Np
 * incoherent draws) so the two reproduce identical trajectories from one seed.
 */
export function seedChimera(
  Np: number,
  rng: () => number,
  jitter = SEED_JITTER,
): number[] {
  const n = 2 * Np;
  const phases = new Array<number>(n);
  const anchor = rng() * TAU;
  for (let i = 0; i < Np; i++) {
    phases[i] = wrap(anchor + jitter * (rng() - 0.5));
  }
  for (let i = Np; i < n; i++) {
    phases[i] = rng() * TAU;
  }
  return phases;
}

/** Wrap a phase to [0, 2π). */
function wrap(v: number): number {
  return ((v % TAU) + TAU) % TAU;
}

/** Mean-field derivative for both populations (ω = 0) into `out`. */
function deriv(
  phases: readonly number[] | Float64Array,
  Np: number,
  mu: number,
  nu: number,
  alpha: number,
  out: Float64Array,
): void {
  const op1 = orderParam(phases, 0, Np);
  const op2 = orderParam(phases, Np, Np);
  for (let i = 0; i < Np; i++) {
    const th = phases[i]!;
    out[i] =
      mu * op1.R * Math.sin(op1.Phi - th - alpha) +
      nu * op2.R * Math.sin(op2.Phi - th - alpha);
  }
  for (let i = Np; i < 2 * Np; i++) {
    const th = phases[i]!;
    out[i] =
      mu * op2.R * Math.sin(op2.Phi - th - alpha) +
      nu * op1.R * Math.sin(op1.Phi - th - alpha);
  }
}

/** Result of advancing the two-population system by one control step. */
export interface ChimeraStep {
  /** Phases after the step, wrapped to [0, 2π). */
  readonly phases: number[];
  /** Order parameter of population 1. */
  readonly pop1: OrderParam;
  /** Order parameter of population 2. */
  readonly pop2: OrderParam;
}

interface ChimeraScratch {
  readonly k1: Float64Array;
  readonly k2: Float64Array;
  readonly k3: Float64Array;
  readonly k4: Float64Array;
  readonly tmp: Float64Array;
}

let globalScratch: ChimeraScratch | null = null;

/**
 * Get or re-allocate the scratch buffers of size `n`.
 * Reuses the same buffers if `n` matches the previous size to eliminate GC overhead.
 */
function getScratchBuffers(n: number): ChimeraScratch {
  if (!globalScratch || globalScratch.k1.length !== n) {
    globalScratch = {
      k1: new Float64Array(n),
      k2: new Float64Array(n),
      k3: new Float64Array(n),
      k4: new Float64Array(n),
      tmp: new Float64Array(n),
    };
  }
  return globalScratch;
}

/**
 * Advance the two-population mean-field system by one RK4 step. **Pure** — does
 * not mutate `phases`; returns a fresh array plus both populations' order
 * parameters (which the voice maps to fusion gains). RK4 carries no randomness,
 * so this is fully deterministic given its inputs.
 */
export function chimeraStep(
  phases: readonly number[] | Float64Array,
  params: ChimeraParams,
  dt: number,
): ChimeraStep {
  const { Np, A, beta } = params;
  const mu = (1 + A) / 2;
  const nu = (1 - A) / 2;
  const alpha = Math.PI / 2 - beta;
  const n = 2 * Np;

  const { k1, k2, k3, k4, tmp } = getScratchBuffers(n);

  deriv(phases, Np, mu, nu, alpha, k1);
  for (let i = 0; i < n; i++) tmp[i] = phases[i]! + 0.5 * dt * k1[i]!;
  deriv(tmp, Np, mu, nu, alpha, k2);
  for (let i = 0; i < n; i++) tmp[i] = phases[i]! + 0.5 * dt * k2[i]!;
  deriv(tmp, Np, mu, nu, alpha, k3);
  for (let i = 0; i < n; i++) tmp[i] = phases[i]! + dt * k3[i]!;
  deriv(tmp, Np, mu, nu, alpha, k4);

  const next = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const v =
      phases[i]! + (dt / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!);
    next[i] = wrap(v);
  }

  return {
    phases: next,
    pop1: orderParam(next, 0, Np),
    pop2: orderParam(next, Np, Np),
  };
}

/**
 * The chimera "split": the gap between the locked and incoherent populations'
 * order parameters, `max(R₁,R₂) − min(R₁,R₂)`. ~1 for a healthy chimera, → 0
 * when the populations merge (collapse to global sync or mutual incoherence).
 * Pure; the supervisor watches this over time.
 */
export function chimeraSplit(pop1: OrderParam, pop2: OrderParam): number {
  return Math.abs(pop1.R - pop2.R);
}

/**
 * Is the current state a live chimera — one population locked (`R > syncHi`)
 * while the other is genuinely incoherent (`R < incohLo`)? Pure predicate; the
 * supervisor's collapse detector is "not alive, sustained for T seconds".
 */
export function isChimeraAlive(
  pop1: OrderParam,
  pop2: OrderParam,
  syncHi = SYNC_HI,
  incohLo = INCOH_LO,
): boolean {
  const hi = Math.max(pop1.R, pop2.R);
  const lo = Math.min(pop1.R, pop2.R);
  return hi > syncHi && lo < incohLo;
}

/** Which population is the locked (synchronized) one: 1 or 2. */
export function lockedPopulation(pop1: OrderParam, pop2: OrderParam): 1 | 2 {
  return pop1.R >= pop2.R ? 1 : 2;
}

/**
 * Map the two populations' coherence onto per-partial fusion gains, **reusing
 * the production fusion law** (`fusion.ts` `fusionMultiplier`) rather than
 * duplicating it — this is the bridge from the chimera dynamics to the existing
 * partial-bank gain path.
 *
 * The partial bank is split in two: the low partials track population 1, the
 * high partials population 2 (pop 1 takes the extra partial for odd counts). For
 * a partial in population σ the multiplier is
 *
 *     m = fusionMultiplier(Φ_σ, ψ_global, amount · R_σ)
 *
 * i.e. the partial's coherence is taken against the *global* mean field, and the
 * population's order-parameter magnitude `R_σ` scales the reshaping amount. The
 * consequences are exactly the chimera's morph:
 *
 * - the **locked** population (R ≈ 1, Φ ≈ ψ_global, since it dominates the mean
 *   field) is reinforced → its band brightens;
 * - the **incoherent** population (R → 0) scales the amount → 0, so `m → 1` and
 *   its band stays at baseline regardless of its ill-defined phase (no
 *   zipper/noise from a wandering Φ);
 * - as the chimera breathes (R, Φ oscillate) and the locked role swaps, the
 *   reinforced band moves → the spectral centroid morphs on its own.
 *
 * Pure; deterministic in its inputs.
 */
export function chimeraFusionGains(
  pop1: OrderParam,
  pop2: OrderParam,
  globalPhi: number,
  partialCount: number,
  amount: number,
): number[] {
  const split = Math.ceil(partialCount / 2);
  const gains = new Array<number>(partialCount);
  for (let i = 0; i < partialCount; i++) {
    const pop = i < split ? pop1 : pop2;
    gains[i] = fusionMultiplier(pop.Phi, globalPhi, amount * pop.R);
  }
  return gains;
}
