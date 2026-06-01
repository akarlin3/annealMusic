#!/usr/bin/env node
/**
 * Chimera Probe — Sakaguchi phase-lag + (near-)identical frequencies
 * ==================================================================
 *
 * A standalone, seeded, OFFLINE numerical probe. NOT a product feature.
 * Nothing here is wired into fusion.ts, the audio engine, or the UI. The
 * deliverable is a number + a GO/NO-GO verdict (see docs/CHIMERA_PROBE.md).
 *
 * Question: with the two ingredients the chimera literature requires — a
 * phase-lag term α (Sakaguchi–Kuramoto) and a near-identical natural-frequency
 * population — does a chimera state FORM and PERSIST at the small partial counts
 * annealMusic uses (N ≈ 8–16 partials), and is its coherence TIME-VARYING under
 * a static control (the one thing engineered per-band coupling cannot produce)?
 *
 * Model (Abrams, Mirollo, Strogatz & Wiley, PRL 101, 084103 (2008) —
 * "Solvable Model for Chimera States of Coupled Oscillators"). Two equal
 * populations A,B of phase oscillators with identical ω. Using the per-population
 * complex order parameter Rσ·e^{iΦσ} = (1/Nσ)·Σ_{j∈σ} e^{iθ_j}, the drift reduces
 * to a mean-field form (O(N) per step):
 *
 *   dθ_i^σ/dt = ω_i + μ·R_σ·sin(Φ_σ − θ_i^σ − α) + ν·R_{σ'}·sin(Φ_{σ'} − θ_i^σ − α)
 *
 * with strong intra-coupling μ and weak inter-coupling ν (μ > ν). Following
 * Abrams: μ = (1+A)/2, ν = (1−A)/2, and a phase lag β = π/2 − α. Chimeras live
 * near α ≈ π/2 (small β) and small-to-moderate coupling disparity A.
 *
 * Centroid mapping reuses the PRODUCTION fusion law verbatim (src/audio/fusion.ts)
 * so the answer lands in the Hz that matter:
 *   c_i = ½·(1 + cos(θ_i − Φ_pop(i)))            (partialCoherence)
 *   m_i = 1 + depth·amount·(c_i − ½)             (fusionMultiplier)
 *   centroid = Σ f_i g_i m_i / Σ g_i m_i         (gain-weighted partial centroid)
 * The analytic gain-weighted centroid equals the FFT spectral centroid used in
 * redistribution.test.ts to within rounding for a well-separated harmonic bank
 * (cross-checked: N=6, f0=220, g_i=1/(i+1) → 538.8 Hz, matching the test's 539).
 */

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — copied from the repo for offline parity.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TWO_PI = Math.PI * 2;

// ---------------------------------------------------------------------------
// Production fusion law (copied from src/audio/fusion.ts — DO NOT edit there).
// ---------------------------------------------------------------------------
const FUSION_DEPTH = 1.0;
const partialCoherence = (phase, psi) => 0.5 * (1 + Math.cos(phase - psi));
function fusionMultiplier(phase, psi, amount, depth = FUSION_DEPTH) {
  if (amount === 0) return 1;
  const m = 1 + depth * amount * (partialCoherence(phase, psi) - 0.5);
  return m < 0 ? 0 : m;
}

// ---------------------------------------------------------------------------
// Per-population complex order parameter R·e^{iΦ}.
// ---------------------------------------------------------------------------
function orderParameter(phases) {
  let c = 0;
  let s = 0;
  for (const t of phases) {
    c += Math.cos(t);
    s += Math.sin(t);
  }
  const n = phases.length;
  const mc = c / n;
  const ms = s / n;
  let psi = Math.atan2(ms, mc);
  if (psi < 0) psi += TWO_PI;
  return { r: Math.hypot(mc, ms), psi };
}

// ---------------------------------------------------------------------------
// Two-population Sakaguchi–Kuramoto integrator (Euler–Maruyama, mean-field form).
//
// nPerPop   oscillators per population (total partials = 2·nPerPop)
// A         coupling disparity → μ=(1+A)/2 (intra), ν=(1−A)/2 (inter)
// alpha     Sakaguchi phase lag; chimeras near α≈π/2
// omega     scalar natural frequency shared by all (identical-ω); jitter via omegaJitter
// noise     uniform phase-noise amplitude (engine-style: σ·(rng−0.5)·√dt); 0 = clean
// dt, steps integration step and count
// settle    steps to discard before measuring (transient)
// seed      RNG seed (deterministic)
//
// Returns the time series of (R_A, R_B) over the *measurement* window plus the
// final phases, so the caller can map coherence → centroid over time.
// ---------------------------------------------------------------------------
function runTwoPopulation({
  nPerPop,
  A,
  alpha,
  omega = 0,
  omegaJitter = 0,
  noise = 0,
  dt = 0.05,
  steps = 9000,
  settle = 3000,
  seed = 1,
}) {
  const rng = mulberry32(seed);
  const mu = (1 + A) / 2; // intra-population (strong)
  const nu = (1 - A) / 2; // inter-population (weak)

  // Natural frequencies: identical ω, optional tiny symmetric jitter.
  const omegaA = [];
  const omegaB = [];
  for (let i = 0; i < nPerPop; i++) {
    omegaA.push(omega + omegaJitter * (rng() - 0.5) * 2);
    omegaB.push(omega + omegaJitter * (rng() - 0.5) * 2);
  }

  // Initial conditions chosen to land in the chimera basin: population A starts
  // coherent (tight cluster near 0), population B starts fully incoherent. This
  // is the standard seeding used to *find* the chimera; if it collapses to global
  // sync or global incoherence, that is itself the (negative) measurement.
  let thA = Array.from({ length: nPerPop }, () => 0.1 * (rng() - 0.5));
  let thB = Array.from({ length: nPerPop }, () => rng() * TWO_PI);

  const noiseScale = noise * Math.sqrt(dt);
  const rA_series = [];
  const rB_series = [];
  let finalThA = thA;
  let finalThB = thB;

  for (let step = 0; step < steps; step++) {
    const opA = orderParameter(thA);
    const opB = orderParameter(thB);

    const nextA = new Array(nPerPop);
    const nextB = new Array(nPerPop);

    for (let i = 0; i < nPerPop; i++) {
      // Population A feels strong coupling to A's field, weak to B's.
      const driftA =
        omegaA[i] +
        mu * opA.r * Math.sin(opA.psi - thA[i] - alpha) +
        nu * opB.r * Math.sin(opB.psi - thA[i] - alpha);
      const nA = noiseScale * (rng() - 0.5);
      let tA = thA[i] + driftA * dt + nA;
      nextA[i] = ((tA % TWO_PI) + TWO_PI) % TWO_PI;
    }
    for (let i = 0; i < nPerPop; i++) {
      const driftB =
        omegaB[i] +
        mu * opB.r * Math.sin(opB.psi - thB[i] - alpha) +
        nu * opA.r * Math.sin(opA.psi - thB[i] - alpha);
      const nB = noiseScale * (rng() - 0.5);
      let tB = thB[i] + driftB * dt + nB;
      nextB[i] = ((tB % TWO_PI) + TWO_PI) % TWO_PI;
    }

    thA = nextA;
    thB = nextB;

    if (step >= settle) {
      rA_series.push(opA.r);
      rB_series.push(opB.r);
    }
  }
  finalThA = thA;
  finalThB = thB;

  return { rA_series, rB_series, finalThA, finalThB, dt };
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const std = (xs) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const range = (xs) => Math.max(...xs) - Math.min(...xs);

/**
 * Persistence of the chimera split over the measurement window. At each frame
 * one population is the "locked" one (higher R) and the other the "incoherent"
 * one (lower R). A frame counts as a live chimera when the locked R exceeds
 * R_HI and the incoherent R stays below R_LO — i.e. a clear, sustained
 * asymmetry that is neither global sync (both high) nor global incoherence
 * (both low). Returns the fraction of frames that qualify, plus a flag for
 * whether the *identity* of the locked population stayed stable (no role swaps),
 * which distinguishes a genuine standing chimera from drifting/wandering.
 */
function persistence(rA_series, rB_series, R_HI = 0.9, R_LO = 0.85) {
  let live = 0;
  let aHigherCount = 0;
  const n = rA_series.length;
  for (let i = 0; i < n; i++) {
    const a = rA_series[i];
    const b = rB_series[i];
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    if (hi > R_HI && lo < R_LO) live++;
    if (a > b) aHigherCount++;
  }
  const fracLive = live / n;
  const roleStability = Math.max(aHigherCount, n - aHigherCount) / n; // 1 = never swaps
  return { fracLive, roleStability };
}

/**
 * Centroid (Hz) of a harmonic partial bank reshaped by the production fusion
 * law, given the two populations' phases and mean phases. Population B is the
 * LOW band (partials 0..n−1), population A the HIGH band (partials n..2n−1), so
 * a coherence asymmetry between the populations redistributes spectral energy
 * and moves the centroid — exactly the redistribution.test.ts mechanism, but
 * driven by the chimera split instead of an engineered coupling profile.
 */
const F0 = 220; // A3, same fundamental as the fusion / redistribution suites
const AMOUNT = 1.0; // full fusion → maximal redistribution
function centroidHz(thB, psiB, thA, psiA) {
  const n = thA.length;
  let num = 0;
  let den = 0;
  // Low band = population B (indices 0..n-1)
  for (let i = 0; i < n; i++) {
    const partialIdx = i; // 0-based
    const f = F0 * (partialIdx + 1);
    const g = 1 / (partialIdx + 1);
    const m = fusionMultiplier(thB[i], psiB, AMOUNT);
    num += f * g * m;
    den += g * m;
  }
  // High band = population A (indices n..2n-1)
  for (let i = 0; i < n; i++) {
    const partialIdx = n + i;
    const f = F0 * (partialIdx + 1);
    const g = 1 / (partialIdx + 1);
    const m = fusionMultiplier(thA[i], psiA, AMOUNT);
    num += f * g * m;
    den += g * m;
  }
  return num / den;
}

/** Baseline (un-fused, amount=0 ⇒ all m_i=1) centroid of the 2n harmonic bank. */
function baselineCentroidHz(nPerPop) {
  const N = 2 * nPerPop;
  let num = 0;
  let den = 0;
  for (let i = 0; i < N; i++) {
    num += F0 * (i + 1) * (1 / (i + 1));
    den += 1 / (i + 1);
  }
  return num / den;
}

/**
 * Full per-frame centroid trajectory over the measurement window. To get a
 * faithful time series we must keep the per-frame phases — so we re-run the
 * integrator and sample the centroid at every measured frame. (Cheap: O(N) per
 * step.) Returns the centroid series in Hz under a STATIC control.
 */
function centroidTrajectory(cfg) {
  const rng = mulberry32(cfg.seed);
  const { nPerPop, A, alpha } = cfg;
  const omega = cfg.omega ?? 0;
  const omegaJitter = cfg.omegaJitter ?? 0;
  const noise = cfg.noise ?? 0;
  const dt = cfg.dt ?? 0.05;
  const steps = cfg.steps ?? 9000;
  const settle = cfg.settle ?? 3000;
  const mu = (1 + A) / 2;
  const nu = (1 - A) / 2;

  const omegaA = [];
  const omegaB = [];
  for (let i = 0; i < nPerPop; i++) {
    omegaA.push(omega + omegaJitter * (rng() - 0.5) * 2);
    omegaB.push(omega + omegaJitter * (rng() - 0.5) * 2);
  }
  let thA = Array.from({ length: nPerPop }, () => 0.1 * (rng() - 0.5));
  let thB = Array.from({ length: nPerPop }, () => rng() * TWO_PI);
  const noiseScale = noise * Math.sqrt(dt);

  const centroids = [];
  for (let step = 0; step < steps; step++) {
    const opA = orderParameter(thA);
    const opB = orderParameter(thB);
    const nextA = new Array(nPerPop);
    const nextB = new Array(nPerPop);
    for (let i = 0; i < nPerPop; i++) {
      const driftA =
        omegaA[i] +
        mu * opA.r * Math.sin(opA.psi - thA[i] - alpha) +
        nu * opB.r * Math.sin(opB.psi - thA[i] - alpha);
      let tA = thA[i] + driftA * dt + noiseScale * (rng() - 0.5);
      nextA[i] = ((tA % TWO_PI) + TWO_PI) % TWO_PI;
    }
    for (let i = 0; i < nPerPop; i++) {
      const driftB =
        omegaB[i] +
        mu * opB.r * Math.sin(opB.psi - thB[i] - alpha) +
        nu * opA.r * Math.sin(opA.psi - thB[i] - alpha);
      let tB = thB[i] + driftB * dt + noiseScale * (rng() - 0.5);
      nextB[i] = ((tB % TWO_PI) + TWO_PI) % TWO_PI;
    }
    thA = nextA;
    thB = nextB;
    if (step >= settle) {
      centroids.push(centroidHz(thB, opB.psi, thA, opA.psi));
    }
  }
  return centroids;
}

// ---------------------------------------------------------------------------
// Experiments
// ---------------------------------------------------------------------------
function summarizeRun(cfg) {
  const { rA_series, rB_series } = runTwoPopulation(cfg);
  // Per-frame locked / incoherent populations.
  const locked = [];
  const incoh = [];
  for (let i = 0; i < rA_series.length; i++) {
    locked.push(Math.max(rA_series[i], rB_series[i]));
    incoh.push(Math.min(rA_series[i], rB_series[i]));
  }
  const { fracLive, roleStability } = persistence(rA_series, rB_series);
  const cents = centroidTrajectory(cfg);
  return {
    rLockMean: mean(locked),
    rIncohMean: mean(incoh),
    rIncohStd: std(incoh),
    rIncohRange: range(incoh),
    fracLive,
    roleStability,
    centMean: mean(cents),
    centStd: std(cents),
    centRange: range(cents),
    cents,
  };
}

function fmt(x, d = 3) {
  return Number.isFinite(x) ? x.toFixed(d) : String(x);
}

/**
 * Dominant morph timescale of a centroid trajectory, in model time units
 * (= seconds of audio, since the engine drift loop runs at dt=0.05 ↔ 20 Hz, so
 * one model time unit ≈ 1 s). Estimated from the mean spacing between upward
 * mean-crossings of the de-meaned signal (one period = two crossings). Returns
 * NaN if the signal is essentially flat (no crossings).
 */
function morphPeriod(series, dt) {
  const m = mean(series);
  const dev = series.map((x) => x - m);
  const crossings = [];
  for (let i = 1; i < dev.length; i++) {
    if (dev[i - 1] <= 0 && dev[i] > 0) crossings.push(i);
  }
  if (crossings.length < 2) return NaN;
  let gaps = 0;
  for (let i = 1; i < crossings.length; i++) gaps += crossings[i] - crossings[i - 1];
  const meanGapSteps = gaps / (crossings.length - 1);
  return meanGapSteps * dt; // one period ≈ one up-crossing-to-up-crossing gap
}

/** std of the first / middle / last third of a series (transient vs sustained). */
function thirdsStd(series) {
  const k = Math.floor(series.length / 3);
  return [std(series.slice(0, k)), std(series.slice(k, 2 * k)), std(series.slice(2 * k))];
}

function header(title) {
  console.log('\n' + '='.repeat(72));
  console.log(title);
  console.log('='.repeat(72));
}

// Aggregate over seeds.
function aggregate(baseCfg, seeds) {
  const rows = seeds.map((seed) => summarizeRun({ ...baseCfg, seed }));
  const agg = (key) => rows.map((r) => r[key]);
  return {
    rLockMean: mean(agg('rLockMean')),
    rIncohMean: mean(agg('rIncohMean')),
    rIncohStd: mean(agg('rIncohStd')),
    fracLiveMean: mean(agg('fracLive')),
    fracLiveMin: Math.min(...agg('fracLive')),
    fracLiveMax: Math.max(...agg('fracLive')),
    roleStability: mean(agg('roleStability')),
    centMean: mean(agg('centMean')),
    centStdMean: mean(agg('centStd')), // typical within-run morph (std)
    centRangeMean: mean(agg('centRange')), // typical within-run morph (peak-peak)
    centRangeMax: Math.max(...agg('centRange')),
    baseline: baselineCentroidHz(baseCfg.nPerPop),
    rows,
  };
}

function printAgg(label, a) {
  console.log(`\n[${label}]`);
  console.log(
    `  R_locked (mean)      = ${fmt(a.rLockMean)}   R_incoherent (mean) = ${fmt(a.rIncohMean)}   (split = ${fmt(a.rLockMean - a.rIncohMean)})`,
  );
  console.log(
    `  R_incoherent std     = ${fmt(a.rIncohStd)}   (within-run breathing of the incoherent population)`,
  );
  console.log(
    `  persistence fracLive = ${fmt(a.fracLiveMean)}  [min ${fmt(a.fracLiveMin)}, max ${fmt(a.fracLiveMax)}]   role-stability = ${fmt(a.roleStability)}`,
  );
  console.log(
    `  centroid: baseline   = ${fmt(a.baseline, 1)} Hz   mean = ${fmt(a.centMean, 1)} Hz   static shift = ${fmt(a.centMean - a.baseline, 1)} Hz`,
  );
  console.log(
    `  centroid TIME-VARY   = std ${fmt(a.centStdMean, 1)} Hz, peak-peak ${fmt(a.centRangeMean, 1)} Hz (mean over seeds), max-run peak-peak ${fmt(a.centRangeMax, 1)} Hz`,
  );
}

// ===========================================================================
// MAIN
// ===========================================================================
const ALPHA = (beta) => Math.PI / 2 - beta;
const SEEDS = (k) => Array.from({ length: k }, (_, i) => 1000 + i);

header('CHIMERA PROBE — Sakaguchi two-population, identical ω');
console.log(
  'Model: Abrams et al. PRL 101, 084103 (2008). μ=(1+A)/2 intra, ν=(1−A)/2 inter, β=π/2−α.',
);
console.log(
  'Centroid via production fusion law (src/audio/fusion.ts); engineered per-band reference ≈ +38 / −21 Hz (redistribution.test.ts).',
);

// --- 1. METHOD VALIDATION: large N must reproduce a known chimera -----------
header('1. METHOD VALIDATION — large N, chimera regime (α=π/2−0.05, A=0.2)');
console.log(
  'Expect: one population locks (R≈1), the other stays partially coherent (R<1) and persists.',
);
for (const nPerPop of [128, 64]) {
  const cfg = {
    nPerPop,
    A: 0.2,
    alpha: ALPHA(0.05),
    omega: 0,
    noise: 0,
    dt: 0.05,
    steps: 20000, // long run: 1000 model-time-units → true persistence, not metastability
    settle: 4000,
  };
  const a = aggregate(cfg, SEEDS(8));
  printAgg(`N_total=${2 * nPerPop} (n=${nPerPop}/pop), clean, LONG (1000 t-units)`, a);
}

// --- 1b. α sweep at large N: locate the chimera regime ----------------------
header('1b. α SWEEP at large N (n=64/pop, A=0.2) — where does the chimera live?');
for (const beta of [0.0, 0.05, 0.1, 0.15, 0.25, 0.5]) {
  const cfg = {
    nPerPop: 64,
    A: 0.2,
    alpha: ALPHA(beta),
    omega: 0,
    noise: 0,
    dt: 0.05,
    steps: 7000,
    settle: 3000,
  };
  const a = aggregate(cfg, SEEDS(4));
  console.log(
    `  β=${fmt(beta, 2)} (α=${fmt(ALPHA(beta), 3)}): R_lock=${fmt(a.rLockMean)} R_incoh=${fmt(a.rIncohMean)} split=${fmt(a.rLockMean - a.rIncohMean)} persist=${fmt(a.fracLiveMean)}`,
  );
}

// --- 2. MUSICAL REGIME: N≈8–16 total partials -------------------------------
header('2. MUSICAL REGIME — small N (the actual annealMusic partial counts)');
console.log(
  'N_total=16 (n=8/pop) and N_total=8 (n=4/pop). 24 seeds each. Clean + small-noise.',
);

const musicalConfigs = [
  { label: 'N_total=16, clean', nPerPop: 8, noise: 0 },
  { label: 'N_total=16, noise=0.02', nPerPop: 8, noise: 0.02 },
  { label: 'N_total=16, ω-jitter=0.02', nPerPop: 8, noise: 0, omegaJitter: 0.02 },
  { label: 'N_total=8,  clean', nPerPop: 4, noise: 0 },
  { label: 'N_total=8,  noise=0.02', nPerPop: 4, noise: 0.02 },
];
const musicalResults = {};
for (const mc of musicalConfigs) {
  const cfg = {
    nPerPop: mc.nPerPop,
    A: 0.2,
    alpha: ALPHA(0.1),
    omega: 0,
    omegaJitter: mc.omegaJitter ?? 0,
    noise: mc.noise,
    dt: 0.05,
    steps: 9000,
    settle: 3000,
  };
  const a = aggregate(cfg, SEEDS(24));
  printAgg(mc.label, a);
  musicalResults[mc.label] = a;
}

// --- 2b. small-N α sweep: is there ANY regime that opens at musical N? -------
header('2b. MUSICAL-N α SWEEP (N_total=16, A=0.2, 12 seeds) — any persistent split?');
for (const beta of [0.05, 0.1, 0.15, 0.25]) {
  for (const A of [0.1, 0.2, 0.35]) {
    const cfg = {
      nPerPop: 8,
      A,
      alpha: ALPHA(beta),
      omega: 0,
      noise: 0,
      dt: 0.05,
      steps: 7000,
      settle: 3000,
    };
    const a = aggregate(cfg, SEEDS(12));
    console.log(
      `  β=${fmt(beta, 2)} A=${fmt(A, 2)}: R_lock=${fmt(a.rLockMean)} R_incoh=${fmt(a.rIncohMean)} split=${fmt(a.rLockMean - a.rIncohMean)} persist=${fmt(a.fracLiveMean)} role-stab=${fmt(a.roleStability)} cent±=${fmt(a.centRangeMean, 1)}Hz`,
    );
  }
}

// --- 3. LONG-DURATION PERSISTENCE + MORPH TIMESCALE at musical N ------------
header(
  '3. LONG-DURATION PERSISTENCE & MORPH TIMESCALE (best musical regime: N_total=16, A=0.2, β=0.05)',
);
console.log(
  'Run = 60000 steps (3000 model-time-units ≈ 50 min audio at 20 Hz). Static control throughout.',
);
console.log(
  'thirdsStd: centroid std in [first | middle | last] third — sustained morph if the last third is still high.',
);
{
  const longSeeds = SEEDS(12);
  let persistVals = [];
  let centRangeVals = [];
  let thirdsLast = [];
  let periods = [];
  let collapsedCount = 0;
  for (const seed of longSeeds) {
    const cfg = {
      nPerPop: 8,
      A: 0.2,
      alpha: ALPHA(0.05),
      omega: 0,
      noise: 0,
      dt: 0.05,
      steps: 60000,
      settle: 6000,
      seed,
    };
    const { rA_series, rB_series } = runTwoPopulation(cfg);
    const { fracLive, roleStability } = persistence(rA_series, rB_series);
    const incoh = rA_series.map((a, i) => Math.min(a, rB_series[i]));
    const cents = centroidTrajectory(cfg);
    const t3 = thirdsStd(cents);
    const p = morphPeriod(cents, cfg.dt);
    persistVals.push(fracLive);
    centRangeVals.push(range(cents));
    thirdsLast.push(t3[2]);
    if (Number.isFinite(p)) periods.push(p);
    // "Collapsed" = the split essentially vanished (incoherent pop locked up).
    if (mean(incoh) > 0.95) collapsedCount++;
    console.log(
      `  seed ${seed}: persist=${fmt(fracLive)} role-stab=${fmt(roleStability)} R_incoh=${fmt(mean(incoh))} ` +
        `cent peak-peak=${fmt(range(cents), 1)}Hz thirdsStd=[${t3.map((x) => fmt(x, 1)).join(' | ')}]Hz period≈${fmt(p, 1)}s`,
    );
  }
  console.log(
    `\n  SUMMARY (12 seeds, 3000 t-units each): mean persist=${fmt(mean(persistVals))}, ` +
      `mean cent peak-peak=${fmt(mean(centRangeVals), 1)}Hz, ` +
      `last-third std (sustained morph)=${fmt(mean(thirdsLast), 1)}Hz, ` +
      `morph period≈${periods.length ? fmt(mean(periods), 1) : 'n/a'}s, ` +
      `collapsed-to-sync seeds=${collapsedCount}/${longSeeds.length}.`,
  );
}

header('DONE — see docs/CHIMERA_PROBE.md for the verdict.');
