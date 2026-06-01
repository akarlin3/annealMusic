# Chimera Probe — Verdict

**Status: probe only.** Nothing here is wired into `fusion.ts`, the audio engine, or
the UI. No synthesis mode was added. The deliverable is a number and a go/no-go
recommendation; the _next_ step is a separate decision to be made on these numbers.

- **Probe:** [`examples/probes/chimera_probe.mjs`](../examples/probes/chimera_probe.mjs) —
  standalone, seeded (mulberry32), offline, pure Node (`node examples/probes/chimera_probe.mjs`,
  ~23 s).
- **Production `kuramoto.ts`: untouched.** A two-population, phase-lagged, mean-field
  integrator is structurally different from the single-population `kuramotoStep`, and a
  backward-compatible `alpha` param would not have provided the two-population coupling
  anyway — so a clean standalone probe was the honest choice. The probe copies
  mulberry32, the order-parameter math, and the **production fusion law verbatim**
  (`c_i = ½(1+cos(θ_i−Φ)); m_i = 1 + depth·amount·(c_i−½)`) so the centroid lands in the
  same Hz the instrument uses. All 21 existing `kuramoto` / `fusion` / `redistribution`
  tests stay green.

---

## TL;DR — **GO (conditional)**

At musical N (= 16 partials), with the two literature ingredients — a Sakaguchi phase
lag **α = π/2 − 0.05** and an **identical-ω** population, split into a strong-intra /
weak-inter two-population coupling (**A = 0.2**, i.e. μ = 0.6 intra, ν = 0.4 inter) — a
chimera **forms, and when it forms it persists for the entire 3 000-time-unit run
(≈ 50 min of audio) as a true attractor, not a transient.** Its incoherent population
**breathes**, producing a **self-morphing spectral centroid of ~100–345 Hz peak-to-peak
on a ~7–17 s period under a completely static control** — several times the engineered
per-band shift (+44 / −13 Hz, span ≈ 58 Hz, from `redistribution.test.ts`), and crucially
**time-varying**, which engineered per-band coupling provably cannot produce.

The "conditional" has two honest strings attached, both of which are inputs to the
_separate_ build decision, not part of this probe:

1. **Bistable basin (~50%).** At N = 16 the chimera coexists with global sync. ~6/12
   random initial conditions fall into the chimera basin; the other ~6/12 collapse to
   full sync (no split, no morph). A build would need to seed/detect-and-reperturb into
   the chimera basin, or accept intermittency.
2. **Identical-ω tension.** The effect requires (near-)identical natural frequencies,
   which collapses the frequency structure the rest of annealMusic relies on. So even
   this positive implies a **separate synthesis mode**, not an extension of the current
   engine. (Explicitly out of scope here; noted for the build decision.)

---

## Method validation — does the probe reproduce a known chimera at large N? **YES.**

Abrams, Mirollo, Strogatz & Wiley, _PRL_ **101**, 084103 (2008) — two populations,
identical ω, `μ=(1+A)/2` intra, `ν=(1−A)/2` inter, phase lag `β = π/2 − α`. Mean-field
reduction `dθ_i^σ = ω + μ R_σ sin(Φ_σ−θ_i^σ−α) + ν R_{σ'} sin(Φ_{σ'}−θ_i^σ−α)` (O(N)/step).

Long run (1 000 time units), A = 0.2, β = 0.05, n = 64 per population:

| metric                                                         | value    |
| -------------------------------------------------------------- | -------- |
| R_locked (coherent population)                                 | **1.00** |
| R_incoherent                                                   | **0.65** |
| split (R_lock − R_incoh)                                       | **0.35** |
| persistence (fraction of window with a clean asymmetric split) | **0.87** |
| role-stability (locked population never swaps)                 | **0.95** |

One population locks (R ≈ 1), the other stays partially coherent (R ≈ 0.65) and the
split **persists** with a stable role assignment. That is a textbook chimera — the
method finds one where one is known to exist.

The α-sweep locates the regime cleanly (n = 64, A = 0.2): the chimera lives at **β ≈ 0.0–0.05**
(split 0.21–0.25, persistence 0.51–0.71) and is gone by **β ≥ 0.15** (collapses to global
sync). β = 0.05 is the operating point used below.

---

## Musical regime — N ≈ 8–16 partials

Best regime (β = 0.05, A = 0.2). **Long-duration test: 12 seeds × 3 000 time-units each
(≈ 50 min audio), static control throughout.** This is the make-or-break measurement: at
small N chimeras are usually metastable (form, then collapse). The result is sharply
**bimodal**:

| seed outcome      | count      | persistence            | R_incoh   | centroid peak-peak         | last-third std | morph period            |
| ----------------- | ---------- | ---------------------- | --------- | -------------------------- | -------------- | ----------------------- |
| **chimera forms** | **6 / 12** | **≈ 1.00 (whole run)** | 0.50–0.60 | **99–345 Hz** (mean ≈ 195) | 22–70 Hz       | **≈ 7–17 s** (mean ≈ 9) |
| collapses to sync | 6 / 12     | 0.00                   | ≈ 1.00    | 0 Hz                       | 0 Hz           | —                       |

The decisive details:

- **Form?** Yes — for ~half of random initial conditions, at N = 16.
- **Persist?** Yes, and **stronger than the small-N risk anticipated**: when it forms it
  is not metastable — it holds the split for the **entire 3 000-time-unit run**
  (persistence ≈ 1.0, role-stability = 1.0). It is an attractor, not a transient.
- **Time-varying?** Yes — the **last-third** centroid std stays high (22–70 Hz), so the
  morph is _sustained_, not a one-time settle. The incoherent population breathes at a
  finite-N rate of **~7–17 s per cycle** (model time unit ≈ 1 s of audio, since the drift
  loop runs at dt = 0.05 ↔ 20 Hz).

Smaller N is more marginal: N = 8 (4 per population) shows a weaker, more metastable split
(short-run persistence ≈ 0.41, peak-peak ≈ 51 Hz). N = 16 is the comfortable operating
point inside the musical range; N = 8 is the floor.

A tiny ω-jitter (0.02) at N = 16 _helps_ the chimera (persistence 0.69, peak-peak ≈ 237 Hz
mean) — the small heterogeneity keeps the incoherent population from locking up — but that
drifts toward "frequency spread," which is the existing model's territory, so the headline
result is reported for the clean **identical-ω** case.

---

## Implied centroid — static shift vs. time-varying morph

Reference (what we already have): engineered per-band coupling
(`redistribution.test.ts`) gives a **static** centroid shift of **+44.5 / −13.2 Hz
(span ≈ 58 Hz)** — and it never moves on its own.

| quantity                                           | chimera at N = 16 (formed seeds)                                                                                     | engineered per-band                   |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **static** shift (time-average)                    | comparable-to-larger when formed, but sign depends on which population locks; averaged over seeds it largely cancels | **+44 / −13 Hz, fixed**               |
| **time-varying** morph (peak-peak, static control) | **~100–345 Hz, ~7–17 s period, sustained**                                                                           | **0 Hz — impossible by construction** |

The static component is _not_ the story — on its own it merely duplicates (or noisily
under-performs) the per-band shift, which would be worthless. **The justifying result is
the time-varying morph:** a centroid that wanders 100–345 Hz on a ~10 s timescale, on its
own, under a frozen control. That is the one thing per-band coupling cannot do, and it is
several times larger than the static effect we already ship.

---

## Recommendation

**GO (conditional).** A persistent, self-morphing chimera exists at musical N and yields a
time-varying centroid (~100–345 Hz peak-peak, ~10 s period) well beyond the static
engineered shift — genuinely emergent-physics-as-synthesis, the most novel result the
chimera line could produce. A future _separate synthesis mode_ is justified **on these
numbers**.

- **Regime that works:** α = π/2 − 0.05 (β = 0.05); N_total = 16 (two populations of 8);
  coupling disparity A = 0.2 (μ = 0.6 intra, ν = 0.4 inter, ratio 1.5); identical ω
  (ω = 0); clean or with ≤ 0.02 noise/jitter.
- **Conditions the build must own (not the probe's call):** (1) the ~50% bistable basin —
  needs initial-condition seeding or collapse-detect-and-reperturb to keep the chimera
  alive; (2) identical-ω collapses the engine's frequency structure, so this is a
  **separate mode**, not an extension.

**Hard stop here.** No synthesis feature, no engine wiring — that decision is yours, on
the numbers above.
