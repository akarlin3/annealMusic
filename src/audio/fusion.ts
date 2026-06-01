/**
 * Synchronization-driven spectral fusion.
 *
 * The Kuramoto order parameter `r` already pulls partial *pitches* together
 * (detune contraction, see `drift.ts`). Fusion extends that coupling to
 * *timbre*: as the partial oscillators synchronize, their amplitudes are
 * reshaped by how well each partial's phase aligns with the collective mean
 * field, so the spectrum itself fuses — coherent partials reinforce into a
 * brighter, more unified tone, while incoherent ones stay diffuse and
 * shimmering.
 *
 * This is the single source of truth for the fusion math. Both the main-thread
 * engines (via the orchestrator drift loop) and the worklets consume the
 * scalars produced here; the worklets never re-derive the math (heuristic-drift
 * rule: one bank, many appliers).
 *
 * ## Model
 *
 * Each partial `i` has a phase `θ_i` and the bank has a collective mean phase
 * `ψ` (psi) — both produced by `kuramotoStep`. The per-partial **coherence** is
 *
 *     c_i = ½·(1 + cos(θ_i − ψ))  ∈ [0, 1]
 *
 * (1 when perfectly aligned with the mean field, 0 when anti-aligned). The
 * fusion **gain multiplier** for partial `i` is
 *
 *     m_i = 1 + depth · amount · (c_i − ½)
 *
 * where `amount ∈ [0,1]` is the user-facing `fusion_amount` and `depth` is a
 * fixed reshaping strength.
 *
 * ## Limits
 *
 * - **amount = 0 (bypass):** every `m_i = 1` exactly → fusion is behavior-
 *   preserving; existing gains and tests are untouched.
 * - **r → 1 (locked):** every `θ_i → ψ` so `c_i → 1`, and *all* partials are
 *   reinforced uniformly by `(1 + ½·depth·amount)` — the bank sums coherently
 *   (amplitudes add ~linearly), the audible "fused" tone.
 * - **r → 0 (incoherent):** the `c_i` scatter, reinforcing the partials that
 *   happen to align and attenuating the opposed ones — a diffuse, shimmering
 *   spectrum whose net energy stays near baseline.
 *
 * ## Mean-field identity (why this is principled and measurable)
 *
 * Because `r·e^{iψ} = (1/N)·Σ e^{iθ_j}`, projecting onto the mean phase gives
 *
 *     (1/N)·Σ cos(θ_i − ψ) = r,
 *
 * so the **bank-average multiplier is exactly** `1 + ½·depth·amount·r`. The net
 * coherent reinforcement is therefore directly proportional to the order
 * parameter `r` — the phase-locked summation prediction, expressed as a gain
 * law and provable with the FFT harness (total harmonic energy ∝ Σ m_i²,
 * monotone in `r` and `amount`).
 */

/** Default reshaping strength. Chosen so the worst-case attenuation at
 *  `amount = 1` is a 50% cut (m_i ≥ 0.5) and the boost is +50% — audible but
 *  musical, never silencing a partial. */
export const FUSION_DEPTH = 1.0;

/**
 * Per-partial coherence with the mean field: `½·(1 + cos(θ − ψ))` ∈ [0,1].
 */
export function partialCoherence(phase: number, psi: number): number {
  return 0.5 * (1 + Math.cos(phase - psi));
}

/**
 * Fusion gain multiplier for a single partial. Returns exactly `1` when
 * `amount === 0`. Clamped to be non-negative for safety (it is already > 0 for
 * any `depth·amount ≤ 2`).
 */
export function fusionMultiplier(
  phase: number,
  psi: number,
  amount: number,
  depth = FUSION_DEPTH,
): number {
  if (amount === 0) return 1;
  const c = partialCoherence(phase, psi);
  const m = 1 + depth * amount * (c - 0.5);
  return m < 0 ? 0 : m;
}

/**
 * Fusion gain multipliers for every partial. Pure; allocates a fresh array and
 * does not mutate its inputs. At `amount === 0` every entry is exactly `1`.
 */
export function fusionMultipliers(
  phases: readonly number[],
  psi: number,
  amount: number,
  depth = FUSION_DEPTH,
): number[] {
  return phases.map((p) => fusionMultiplier(p, psi, amount, depth));
}

/**
 * Apply fusion to a set of base partial gains: `g_i' = g_i · m_i`.
 *
 * `baseGains` and `phases` are matched by index; extra phases are ignored and
 * missing phases leave the corresponding gain untouched (multiplier 1). At
 * `amount === 0` the output equals `baseGains` within floating-point rounding,
 * which is the behavior-preserving-at-zero guarantee.
 */
export function applyFusion(
  baseGains: readonly number[],
  phases: readonly number[],
  psi: number,
  amount: number,
  depth = FUSION_DEPTH,
): number[] {
  return baseGains.map((g, i) => {
    const phase = phases[i];
    if (phase === undefined) return g;
    return g * fusionMultiplier(phase, psi, amount, depth);
  });
}
