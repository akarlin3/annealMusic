# Chimera Characterization (Build B)

**Status:** probe/analysis only — no synthesis feature, no engine wiring. Production
`src/` is untouched; this is the science that tells Build A _where_ to put a chimera
synthesis mode and _how_ to seed its basin, and that supplies the core figures for a
DAFx/NIME write-up.

**Reproduce:** `node examples/probes/chimera_probe.mjs` (seeded, offline, deterministic,
~30 s total). All numbers below are from that run.

---

## 1. Model and method

Two equal populations σ = 1, 2 of `N` phase oscillators each, identical natural frequency
ω (taken = 0 in the rotating frame — the **identical-ω requirement**), coupled in the
two-population Sakaguchi / Abrams–Mirollo–Strogatz–Wiley form:

```
dθ_i^σ/dt = ω + μ·R_σ·sin(Φ_σ − θ_i^σ − α) + ν·R_σ'·sin(Φ_σ' − θ_i^σ − α)
```

with intra-population coupling **μ = (1+A)/2**, inter-population coupling **ν = (1−A)/2**
(so μ + ν = 1 and **A = μ − ν** is the _coupling disparity_), and phase lag **α = π/2 − β**.
`R_σ e^{iΦ_σ} = (1/N)·Σ_j e^{iθ_j^σ}` is the per-population complex order parameter. This
mean-field form is _exact_ for all-to-all coupling, so the integrator is O(N) per step;
it is advanced with RK4 at dt = 0.05 (1 model time unit := 1 s).

**What is measured.** The probe reuses the production primitives verbatim:

- the **fusion law** (`src/audio/fusion.ts`): `m_i = 1 + depth·amount·(c_i − ½)`,
  `c_i = ½(1 + cos(θ_i − ψ))`, depth = 1, amount = 1;
- the **order parameter** (`src/audio/kuramoto.ts`);
- the **spectral centroid** convention of `src/audio/analysis/spectrum.ts` (magnitude-
  weighted; reproduces that suite's 539 Hz reference).

The 2N oscillators map to a harmonic partial bank `f_i = F0·(i+1)` (F0 = 220 Hz, A3) with
the meditation-default `1/(i+1)` rolloff. The global mean field ψ drives the fusion
multipliers, and we track the **centroid(t)** trajectory. As the chimera self-organizes
which band locks, the coherent partials are reinforced and the centroid moves — **emergent
spectral redistribution** (the same mechanism as the structured-sync redistribution result,
but here the band split is _not imposed_ by a coupling profile; it emerges from the chimera).

**Initial condition.** The canonical chimera seed: population 1 starts as a tight
synchronized cluster (R₁ ≈ 1, ±0.25 rad jitter), population 2 starts incoherent. The seed
controls the draw, so **basin fraction = the fraction of seeds whose seeded chimera
_persists_ vs collapses to global sync** — exactly the state Build A would seed. (From
fully-random initial phases the spontaneous-formation basin is near-zero and _shrinks_ with
N; that is a different, much harder question and is not the shippable path.)

**Metrics.** A sample is "chimera-alive" when one population is locked (max R > 0.90) while
the other is genuinely incoherent (min R < 0.85). Per trajectory:

- **fracLive** — fraction of post-transient time the chimera is alive;
- **role-stability** — of the alive samples, the fraction in which the _same_ population
  stays the synchronized one (1.0 = roles never swap, 0.5 = the locked role flips evenly);
- **morph amplitude** — peak-to-peak centroid excursion (Hz).

A seed is "in basin" when fracLive ≥ 0.8. Basin fraction is over 12 seeds (CP1) / 24 seeds
(CP2). Granularity is therefore ±8% (CP1) / ±4% (CP2) — read the tables as trends, not to
the last percent.

---

## 2. CP1 — the (β, A, N) phase diagram

### Basin fraction (% of 12 seeds landing in a persistent chimera)

```
N=8     A=0.05  A=0.10  A=0.20  A=0.35  A=0.50
β=0.02     8%     25%     17%     25%     67%
β=0.05     8%     17%     17%     33%     67%
β=0.10     0%      0%     25%     17%     25%
β=0.15     0%      0%      0%      8%     25%
β=0.20     0%      0%      0%      8%      8%
β=0.30     0%      0%      0%      0%      0%

N=16    A=0.05  A=0.10  A=0.20  A=0.35  A=0.50
β=0.02    25%      8%      8%     58%     67%
β=0.05     0%     25%     17%     42%     75%
β=0.10     0%      8%     33%     25%     42%
β=0.15     0%      0%      8%      0%     17%
β=0.20     0%      0%      0%      0%      0%
β=0.30     0%      0%      0%      0%      0%

N=32    A=0.05  A=0.10  A=0.20  A=0.35  A=0.50
β=0.02    67%     33%     50%     67%     75%
β=0.05     0%     17%     25%     33%     67%
β=0.10     0%      0%     25%     17%     67%
β=0.15     0%      0%      8%      0%     33%
β=0.20     0%      0%      0%      0%     17%
β=0.30     0%      0%      0%      0%      0%

N=64    A=0.05  A=0.10  A=0.20  A=0.35  A=0.50
β=0.02    17%     67%     83%      8%     92%
β=0.05     0%      0%      8%     50%     92%
β=0.10     8%     25%     75%      0%     83%
β=0.15     0%      0%      0%      0%     17%
β=0.20     0%      0%      0%      0%      8%
β=0.30     0%      0%      0%      0%      0%
```

### Morph amplitude (mean peak-to-peak centroid Hz, in-basin seeds)

```
N=16    A=0.05  A=0.10  A=0.20  A=0.35  A=0.50
β=0.02    675     523     717     381     146
β=0.05      -     360     463     146     161
β=0.10      -     367     394     150     162
β=0.15      -       -     501       -     170

N=32    A=0.05  A=0.10  A=0.20  A=0.35  A=0.50
β=0.02    868     957    1004     976     377
β=0.05      -     565     786     527     285
β=0.10      -       -     769    1073     367
β=0.15      -       -     531       -     433
```

### Where chimeras live

- **Phase lag β is the gate.** Persistent chimeras require **small β (≤ 0.10), strongly at
  β = 0.02–0.05**. By β = 0.15 the basin is nearly empty; by β = 0.30 it is zero everywhere.
  (β = π/2 − α, so this is the near-maximal-lag corner of the Sakaguchi model.)
- **Coupling disparity A trades basin for morph.** Large A (0.35–0.50) gives the **widest,
  most reliable** basin and **rock-stable roles**, but a **smaller, slower** morph.
  Intermediate A (≈ 0.20) gives a **larger morph** (≈ 700–1000 Hz) but a smaller basin and,
  at large N, **role-instability** (the synced population identity wanders).
- **N widens the basin** (quantified in CP2).

### Top regimes (score = 0.5·basin + 0.3·morph_norm + 0.2·role)

```
  N     A   β    basin  fracLive  role  morphHz   cHz   score
 64  0.20  0.02   83%     0.83    0.55    1676   5270   0.826   <- biggest morph, roles SWAP
 64  0.50  0.02   92%     0.92    1.00     684   4867   0.781   <- best all-round
 64  0.50  0.05   92%     0.91    1.00     626   4860   0.770   <- best all-round
 64  0.20  0.10   75%     0.80    1.00    1006   5449   0.755
 64  0.50  0.10   83%     0.85    1.00     731   4879   0.747
 64  0.35  0.05   50%     0.72    0.99    1600   5498   0.734
 32  0.35  0.02   67%     0.80    0.80     976   3046   0.667
 32  0.50  0.02   75%     0.86    0.98     377   2806   0.638
```

**The Build-A target regime: A = 0.50, β ∈ [0.02, 0.05], N ≥ 32 (ideally 64).** This is the
only corner that combines a wide basin (75–92%), perfectly stable roles (1.00), and a real
(if slow) morph (~300–680 Hz centroid excursion, ~10–14% of the mean centroid). If a more
dramatic, faster morph is wanted, A ≈ 0.20 roughly _doubles_ the excursion (~800–1700 Hz)
but costs basin reliability and — at large N — role-stability. That is a knob, not a free
lunch.

---

## 3. CP2 — does N widen the basin?

Best regime from CP1 (A = 0.50, β = 0.05), basin fraction over **24 seeds**:

```
 N    basin   fracLive  role  morphHz
  8    63%      0.84     1.00     94
 16    63%      0.80     1.00    184
 24    83%      0.90     1.00    271
 32    92%      0.90     1.00    316
 48    88%      0.88     1.00    467
 64    88%      0.90     1.00    628
```

**Answer: more partials help substantially — but only up to a plateau, and the plateau is
not 100%.** The basin climbs from ~63% at N = 8–16 to **~90% at N ≥ 32**, then saturates in
the high-80s/low-90s (the N=32 92% vs N=48/64 88% wobble is within the ±4% seed noise — read
it as "≈ 90%, flat"). It does **not** approach 100%. Role-stability is a perfect 1.00
throughout, and morph amplitude grows monotonically with N (more partials → a wider harmonic
bank for the centroid to sweep).

**Build-A consequence — both, not either.** Going from N = 16 to N = 32 buys a real
reliability jump (63% → 90%) essentially for free, so **use N ≥ 32 partials per population**.
But because the basin plateaus below 100%, **N alone cannot guarantee a chimera** — Build A
**must still seed the chimera state** (one band clustered, one incoherent) rather than hope
it self-forms, and should be prepared to **detect collapse-to-sync and re-perturb** the
~10% of the time the seeded state slides into global sync.

---

## 4. CP3 — characterizing the morph

The morph (centroid(t)) is the novel, paper-worthy signal. Spectrum from the DFT of the
detrended, Hann-windowed centroid trajectory over a 240 s window (≥ 10 cycles), at N = 32,
β = 0.05.

### Periodic or chaotic? — **Periodic (a limit cycle), not chaotic.**

Spectral flatness (geo/arith mean of band power; ~0 = a single sharp peak, ~1 = broadband
noise) is **low everywhere — typically 0.03–0.18, and as low as 0.025**. The morph is a
clean limit cycle (or, in the most strongly-coupled corner, a near-static fixed point — see
below). There is **no broadband/chaotic signature** in the regimes that matter.

### Timescale — slow (tens of seconds), and _not_ a simple power law

Morph period vs coupling disparity A (β = 0.05, N = 32, first in-basin seed per A):

```
   A     period_s     flatness   morphHz
 0.10   ≥200 (stationary)  0.31     353
 0.15      25.3            0.34     534
 0.20      21.4            0.18     822
 0.25      78.9            0.15     963
 0.30      22.2            0.16     745
 0.40      51.9            0.03     492
 0.50      72.6            0.04     501
```

Morph period vs phase lag β (A = 0.50, N = 32):

```
   β     period_s
 0.02      40.4
 0.05      72.6
 0.10   ≥200 (stationary)
 0.15   ≥200 (stationary)
 0.20   ≥200 (stationary)
```

The breathing period is **O(20–70 s)** and does **not** follow a clean scaling law in A
(the single-seed-per-cell sampling makes the A-trend noisy; the honest summary is a
_non-monotonic_ relation with the **fastest breathing, ~20 s, at intermediate A ≈ 0.15–0.30**).
The controlling physics is **proximity to the chimera's stability boundary**: as the state
moves _deeper_ into the stable-chimera region (larger A, or larger β within the existence
window) the breathing **slows and ultimately freezes** into a **near-stationary chimera** —
a settled spectral offset rather than an oscillation. This is the same trade-off seen in
CP1/CP2: the most _robust_ regime (A = 0.50, β = 0.02–0.05) is also the most _static_.

> Note: the originating probe reported breathing of 7–17 s. This reconstructed/extended
> probe measures ~20–70 s in the persistent-chimera regimes. The qualitative picture (a slow
> periodic breathing whose period grows toward the stable-chimera interior) holds; the
> absolute timescale is regime- and mapping-dependent and is reported here as measured.

### Morph shape — asymmetric "relaxation" breathing, not a pure sine

At the breathing optimum (A = 0.20, β = 0.05, N = 32): **crest factor ≈ 3.2–3.7** (a pure
sine is 1.41) and **2nd-harmonic ratio ≈ 0.1–0.3** (a pure sine is 0). The centroid does not
swing sinusoidally; it executes an **asymmetric, relaxation-style breath** — a slower swell
toward one band and a faster return — which is musically a gradual brightening/darkening
with a recurring "snap," not a symmetric tremolo.

### Morph amplitude range

Across the persistent regimes the centroid excursion runs **~150 Hz (small-A / large-N
high-basin corner) to ~1700 Hz (A ≈ 0.20, N = 64)**, i.e. roughly **10–32% of the mean
centroid** (mean centroid ≈ 1.6 kHz at N = 16, ≈ 2.8–3.2 kHz at N = 32, ≈ 4.9–5.5 kHz at
N = 64). It is an audible, sustained, time-varying spectral redistribution — not a subtle
detune.

---

## 5. Honest abstract-style summary

> We characterize an emergent **time-varying spectral redistribution** that arises when a
> two-population Sakaguchi oscillator bank settles into a **chimera state**: one harmonic
> population phase-locks while the other remains incoherent, and the production
> synchronization→fusion law (coherence-weighted partial gains) converts that self-organized
> split into a slowly **breathing spectral centroid**. Unlike an LFO or an automated coupling
> profile, the morph is _not imposed_ — it emerges from the chimera's symmetry breaking and
> its limit-cycle breathing, making time-varying timbre a _consequence of the synchronization
> dynamics themselves_: a candidate synthesis primitive. We map where the phenomenon lives
> (a narrow corner: small phase lag β ≤ 0.10, with a basin/morph trade-off in the coupling
> disparity A), quantify its reliability (a **seeded** chimera persists in **~90% of seeds at
> N ≥ 32 partials per population**, climbing from ~63% at N = 16 but **plateauing below
> 100%**), and characterize the morph (a **periodic, non-chaotic** limit cycle of period
> **~20–70 s**, an **asymmetric relaxation breath** of crest ≈ 3, sweeping the centroid over
> **~10–32%** of its mean). The bounds are real and constrain the synthesis design:
> the phenomenon **requires identical natural frequencies**, lives **only at near-maximal
> lag**, must be **explicitly seeded** (it does not reliably self-form, and the basin never
> reaches 100%), and presents a genuine **basin↔morph trade-off** — the most reliable,
> role-stable regime (A = 0.50) breathes slowly toward a near-_stationary_ offset, while the
> largest, fastest morph (A ≈ 0.20) costs basin width and role-stability.

---

## 6. Recommendation for Build A

1. **Target regime:** A = 0.50, β ∈ [0.02, 0.05], **N ≥ 32** partials per population (use 64
   if the partial budget allows — wider basin headroom and a larger morph bank). This gives
   ~90% basin, role-stability 1.00, and a ~300–680 Hz centroid morph.
2. **Basin strategy — seed _and_ supervise, do not rely on N.** N ≥ 32 is necessary (it
   takes the basin from ~63% to ~90%) but **not sufficient**: the basin plateaus below 100%,
   so Build A must **seed the chimera** (cluster one band, leave the other incoherent) and
   **detect collapse-to-global-sync** (both R → 1) to **re-perturb** the failing minority of
   onsets. Spontaneous formation from incoherence is not a viable path (its basin is
   near-zero and shrinks with N).
3. **Expose the basin↔morph trade-off as a control.** Mapping a single "intensity" knob from
   A ≈ 0.50 (reliable, slow, near-stationary, role-stable) toward A ≈ 0.20 (dramatic ~800+ Hz
   breathing, ~20 s period, but lower basin and wandering roles) gives a musically meaningful
   axis — at the cost of reliability the player can dial in deliberately.
4. **Set expectations on timescale and shape.** The morph is _slow_ (tens of seconds) and an
   _asymmetric_ breath, not a fast symmetric tremolo. That suits an ambient/meditation
   context; if a faster morph is required it is not available in the persistent-chimera
   regime and would need a different mechanism.
