/**
 * Chimera characterization probe — Build B (probe/analysis only).
 *
 * Offline, seeded, deterministic. Extends the Build-A conditional-GO probe:
 *   - two-population Sakaguchi integrator (runTwoPopulation),
 *   - the PRODUCTION fusion law copied VERBATIM from src/audio/fusion.ts,
 *   - the order parameter and centroid mapping from src/audio/{kuramoto,analysis},
 *   - persistence (fracLive + roleStability).
 *
 * Build B widens and deepens the measurement (no synthesis feature, no engine
 * wiring; production src/ is untouched):
 *   CP1  the (alpha, A, N) phase diagram — where persistent morphing chimeras live
 *   CP2  does N widen the basin? basin-fraction vs N in the best regime
 *   CP3  characterize the morph — periodic/chaotic, timescale law, shape
 *
 * Model (Abrams, Mirollo, Strogatz & Wiley 2008 — "Solvable model for chimera
 * states"). Two equal populations sigma = 1, 2 of N oscillators each, identical
 * natural frequency omega (= 0 in the rotating frame — the identical-omega
 * requirement). Intra-population coupling mu = (1+A)/2, inter-population coupling
 * nu = (1-A)/2 (so mu + nu = 1 and A = mu - nu is the coupling disparity), phase
 * lag alpha = pi/2 - beta:
 *
 *   dtheta_i^sigma/dt = omega
 *     + mu * R_sigma  * sin(Phi_sigma  - theta_i^sigma - alpha)
 *     + nu * R_sigma' * sin(Phi_sigma' - theta_i^sigma - alpha)
 *
 * where R_sigma e^{i Phi_sigma} = (1/N) sum_j e^{i theta_j^sigma} is the
 * per-population complex order parameter. This mean-field form is *exact* for
 * all-to-all coupling (sum_j sin(theta_j - theta_i - alpha) = N R sin(Phi -
 * theta_i - alpha)), so it is O(N) per step rather than O(N^2). Integrated with
 * RK4 at dt = 0.05 (1 model time unit := 1 s). The only stochasticity is the
 * mulberry32-seeded initial phase draw, so basin fractions are a clean,
 * reproducible function of the seed set.
 *
 * Run:  node examples/probes/chimera_probe.mjs
 */

// ---------------------------------------------------------------------------
// Verbatim production fusion law (src/audio/fusion.ts).
// ---------------------------------------------------------------------------
const FUSION_DEPTH = 1.0;
function partialCoherence(phase, psi) {
  return 0.5 * (1 + Math.cos(phase - psi));
}
function fusionMultiplier(phase, psi, amount, depth = FUSION_DEPTH) {
  if (amount === 0) return 1;
  const c = partialCoherence(phase, psi);
  const m = 1 + depth * amount * (c - 0.5);
  return m < 0 ? 0 : m;
}

// ---------------------------------------------------------------------------
// Verbatim mulberry32 PRNG (src/audio/analysis/__tests__/redistribution.test.ts).
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

// ---------------------------------------------------------------------------
// Probe constants. F0 / AMOUNT match the production fusion + redistribution
// suites (A3 fundamental, full fusion).
// ---------------------------------------------------------------------------
const F0 = 220; // A3
const AMOUNT = 1.0; // full fusion — maximal spectral redistribution
const DT = 0.05; // 20 Hz, matches the production drift loop step

const TAU = 2 * Math.PI;

// ---------------------------------------------------------------------------
// Order parameter of a contiguous block of `count` phases starting at `start`.
// Mirrors the complex order parameter in src/audio/kuramoto.ts.
// ---------------------------------------------------------------------------
function orderParam(phases, start, count) {
  let c = 0;
  let s = 0;
  for (let k = 0; k < count; k++) {
    const th = phases[start + k];
    c += Math.cos(th);
    s += Math.sin(th);
  }
  c /= count;
  s /= count;
  return { R: Math.sqrt(c * c + s * s), Phi: Math.atan2(s, c) };
}

// Mean-field derivative for both populations (omega = 0).
function deriv(phases, Np, mu, nu, alpha, out) {
  const op1 = orderParam(phases, 0, Np);
  const op2 = orderParam(phases, Np, Np);
  for (let i = 0; i < Np; i++) {
    const th = phases[i];
    out[i] =
      mu * op1.R * Math.sin(op1.Phi - th - alpha) +
      nu * op2.R * Math.sin(op2.Phi - th - alpha);
  }
  for (let i = Np; i < 2 * Np; i++) {
    const th = phases[i];
    out[i] =
      mu * op2.R * Math.sin(op2.Phi - th - alpha) +
      nu * op1.R * Math.sin(op1.Phi - th - alpha);
  }
}

// One RK4 step of the two-population mean-field system. Wraps phases to [0, 2pi).
function rk4Step(phases, dt, Np, mu, nu, alpha, scratch) {
  const n = phases.length;
  const { k1, k2, k3, k4, tmp } = scratch;
  deriv(phases, Np, mu, nu, alpha, k1);
  for (let i = 0; i < n; i++) tmp[i] = phases[i] + 0.5 * dt * k1[i];
  deriv(tmp, Np, mu, nu, alpha, k2);
  for (let i = 0; i < n; i++) tmp[i] = phases[i] + 0.5 * dt * k2[i];
  deriv(tmp, Np, mu, nu, alpha, k3);
  for (let i = 0; i < n; i++) tmp[i] = phases[i] + dt * k3[i];
  deriv(tmp, Np, mu, nu, alpha, k4);
  for (let i = 0; i < n; i++) {
    let v = phases[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    v = ((v % TAU) + TAU) % TAU;
    phases[i] = v;
  }
}

function makeScratch(n) {
  return {
    k1: new Float64Array(n),
    k2: new Float64Array(n),
    k3: new Float64Array(n),
    k4: new Float64Array(n),
    tmp: new Float64Array(n),
  };
}

// ---------------------------------------------------------------------------
// Centroid mapping. The 2N oscillators map to a harmonic partial bank
// f_i = F0 * (i+1) with the meditation-default 1/(i+1) rolloff voicing
// (identical to redistribution.test.ts). The PRODUCTION fusion multipliers
// reshape the gains against the GLOBAL mean field psi, and we take the
// magnitude-weighted spectral centroid — the analytic, leakage-free equivalent
// of src/audio/analysis/spectrum.ts spectralCentroid (it reproduces the
// suite's 539 Hz reference for N = 6). As the chimera self-organizes which
// band locks, the coherent partials are reinforced and the centroid moves:
// emergent spectral redistribution.
// ---------------------------------------------------------------------------
function centroidHz(phases, n) {
  const g = orderParam(phases, 0, n); // global mean field
  const psi = g.Phi;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const m = fusionMultiplier(phases[i], psi, AMOUNT);
    const base = 1 / (i + 1);
    const f = F0 * (i + 1);
    const gain = base * m;
    num += gain * f;
    den += gain;
  }
  return num / den;
}

// ---------------------------------------------------------------------------
// Run one two-population trajectory. Returns post-transient time series of the
// two order parameters and the centroid.
//
// Initial condition (`init`):
//   'seeded' (default) — the canonical chimera seed: population 1 starts as a
//     tight synchronized cluster (R1 ~ 1, small jitter) and population 2 starts
//     incoherent (uniform on the circle). This places the state near the chimera
//     manifold and the seed controls the specific incoherent draw + jitter, so
//     the basin fraction measures how ROBUSTLY a seeded chimera persists vs
//     collapses to global sync — exactly the state Build A would seed.
//   'random' — both populations uniform random (measures SPONTANEOUS chimera
//     formation from incoherence; a much smaller, N-shrinking basin).
// ---------------------------------------------------------------------------
const SEED_JITTER = 0.25; // rad, half-width of the synced cluster at t=0

function runTwoPopulation({
  Np,
  A,
  beta,
  seed,
  transient,
  analyze,
  dt = DT,
  init = 'seeded',
}) {
  const mu = (1 + A) / 2;
  const nu = (1 - A) / 2;
  const alpha = Math.PI / 2 - beta;
  const n = 2 * Np;
  const rng = mulberry32(seed);
  const phases = new Float64Array(n);
  if (init === 'random') {
    for (let i = 0; i < n; i++) phases[i] = rng() * TAU;
  } else {
    // Population 1: synchronized cluster about a random anchor phase.
    const anchor = rng() * TAU;
    for (let i = 0; i < Np; i++) {
      phases[i] = anchor + SEED_JITTER * (rng() - 0.5);
      phases[i] = ((phases[i] % TAU) + TAU) % TAU;
    }
    // Population 2: incoherent.
    for (let i = Np; i < n; i++) phases[i] = rng() * TAU;
  }
  const scratch = makeScratch(n);

  const nTrans = Math.round(transient / dt);
  const nAna = Math.round(analyze / dt);
  for (let s = 0; s < nTrans; s++) rk4Step(phases, dt, Np, mu, nu, alpha, scratch);

  const R1 = new Float64Array(nAna);
  const R2 = new Float64Array(nAna);
  const C = new Float64Array(nAna);
  for (let s = 0; s < nAna; s++) {
    rk4Step(phases, dt, Np, mu, nu, alpha, scratch);
    R1[s] = orderParam(phases, 0, Np).R;
    R2[s] = orderParam(phases, Np, Np).R;
    C[s] = centroidHz(phases, n);
  }
  return { R1, R2, C, dt };
}

// ---------------------------------------------------------------------------
// Persistence + morph metrics for one trajectory.
//   alive(t): one population locked (max R > 0.90) while the other is genuinely
//             incoherent (min R < 0.85) — i.e. a chimera, not global sync and
//             not mutual incoherence.
//   fracLive: fraction of post-transient time the chimera is alive.
//   roleStability: of the alive samples, the fraction in which the SAME
//             population stays the synchronized one (1.0 = roles never swap,
//             0.5 = the locked role flips evenly).
//   morphAmp: peak-to-peak centroid excursion (Hz) over the window.
// ---------------------------------------------------------------------------
const SYNC_HI = 0.9;
const INCOH_LO = 0.85;

function analyzeRun(run) {
  const { R1, R2, C } = run;
  const n = R1.length;
  let live = 0;
  let plus = 0;
  let minus = 0;
  for (let k = 0; k < n; k++) {
    const hi = Math.max(R1[k], R2[k]);
    const lo = Math.min(R1[k], R2[k]);
    if (hi > SYNC_HI && lo < INCOH_LO) {
      live++;
      if (R1[k] > R2[k]) plus++;
      else minus++;
    }
  }
  const fracLive = live / n;
  const roleStability = live > 0 ? Math.max(plus, minus) / live : 0;

  let mn = Infinity;
  let mx = -Infinity;
  let sum = 0;
  for (let k = 0; k < n; k++) {
    const c = C[k];
    if (c < mn) mn = c;
    if (c > mx) mx = c;
    sum += c;
  }
  const morphMean = sum / n;
  const morphAmp = mx - mn;
  return { fracLive, roleStability, morphAmp, morphMean, mn, mx };
}

const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

// ---------------------------------------------------------------------------
// Aggregate one (Np, A, beta) cell over a set of seeds.
//   basinFrac: fraction of seeds that land in a PERSISTENT chimera
//              (fracLive >= IN_BASIN), vs collapse to sync / incoherence.
// In-basin seeds also report mean role-stability and mean morph amplitude.
// ---------------------------------------------------------------------------
const IN_BASIN = 0.8;

function runCell({ Np, A, beta, seeds, seed0, transient, analyze }) {
  let inBasin = 0;
  let fracLiveSum = 0;
  const roleIn = [];
  const morphIn = [];
  const morphMeanIn = [];
  for (let s = 0; s < seeds; s++) {
    const run = runTwoPopulation({
      Np,
      A,
      beta,
      seed: seed0 + s,
      transient,
      analyze,
    });
    const m = analyzeRun(run);
    fracLiveSum += m.fracLive;
    if (m.fracLive >= IN_BASIN) {
      inBasin++;
      roleIn.push(m.roleStability);
      morphIn.push(m.morphAmp);
      morphMeanIn.push(m.morphMean);
    }
  }
  return {
    basinFrac: inBasin / seeds,
    meanFracLive: fracLiveSum / seeds,
    meanRole: roleIn.length ? mean(roleIn) : 0,
    meanMorph: morphIn.length ? mean(morphIn) : 0,
    meanMorphCentroid: morphMeanIn.length ? mean(morphMeanIn) : 0,
    nInBasin: inBasin,
  };
}

// ---------------------------------------------------------------------------
// Morph spectrum (CP3). Detrend + Hann window the centroid trajectory, then a
// direct DFT over the breathing band (periods 3..60 s). Reports the dominant
// peak (period), the band spectral flatness (geo/arith mean of power; ~0 peaky
// limit-cycle, ~1 broadband/chaotic), the harmonic ratio (power at 2*peak vs
// peak — sawtooth/bursts carry harmonics, a sine does not) and the crest factor
// of the detrended signal (intermittent bursts spike the crest).
// ---------------------------------------------------------------------------
function morphSpectrum(C, dt) {
  const n = C.length;
  const mu = mean(Array.from(C));
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const w = 0.5 * (1 - Math.cos((TAU * i) / (n - 1))); // Hann
    x[i] = (C[i] - mu) * w;
  }
  const fmin = 1 / 200;
  const fmax = 1 / 3;
  const bins = 600;
  let peakPow = 0;
  let peakFreq = 0;
  const freqs = new Float64Array(bins);
  const pows = new Float64Array(bins);
  for (let b = 0; b < bins; b++) {
    const f = fmin + ((fmax - fmin) * b) / (bins - 1);
    const w = TAU * f * dt;
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      re += x[i] * Math.cos(w * i);
      im += x[i] * Math.sin(w * i);
    }
    const p = re * re + im * im;
    freqs[b] = f;
    pows[b] = p;
    if (p > peakPow) {
      peakPow = p;
      peakFreq = f;
    }
  }
  // spectral flatness over the band
  let logSum = 0;
  let arithSum = 0;
  let eps = 1e-30;
  for (let b = 0; b < bins; b++) {
    logSum += Math.log(pows[b] + eps);
    arithSum += pows[b] + eps;
  }
  const flatness = Math.exp(logSum / bins) / (arithSum / bins);
  // fraction of band power in the dominant peak's neighborhood (+/-3 bins)
  let peakBand = 0;
  let total = 0;
  let pb = 0;
  for (let b = 0; b < bins; b++) {
    if (freqs[b] === peakFreq) pb = b;
  }
  for (let b = 0; b < bins; b++) {
    total += pows[b];
    if (Math.abs(b - pb) <= 3) peakBand += pows[b];
  }
  const peakConcentration = peakBand / total;
  // harmonic ratio: power near 2*peakFreq vs at peak
  let h2 = 0;
  const f2 = 2 * peakFreq;
  if (f2 <= fmax) {
    const w = TAU * f2 * dt;
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      re += x[i] * Math.cos(w * i);
      im += x[i] * Math.sin(w * i);
    }
    h2 = re * re + im * im;
  }
  const harmonicRatio = peakPow > 0 ? h2 / peakPow : 0;
  // crest factor of detrended (unwindowed) signal
  let mx = 0;
  let sq = 0;
  for (let i = 0; i < n; i++) {
    const d = C[i] - mu;
    if (Math.abs(d) > mx) mx = Math.abs(d);
    sq += d * d;
  }
  const rms = Math.sqrt(sq / n);
  const crest = rms > 0 ? mx / rms : 0;
  // The dominant peak sitting at the lowest analyzed bin means the oscillation
  // is slower than the window resolves: the chimera has settled to a near-static
  // spectral offset rather than breathing on a fast limit cycle.
  const stationary = pb <= 1;
  return {
    peakPeriod: 1 / peakFreq,
    peakFreq,
    flatness,
    peakConcentration,
    harmonicRatio,
    crest,
    stationary,
  };
}

const periodStr = (sp) =>
  sp.stationary ? `>=${(1 / sp.peakFreq).toFixed(0)}(stat)` : sp.peakPeriod.toFixed(1);

// ===========================================================================
// Reporting helpers
// ===========================================================================
function bar(v, lo, hi, width = 10) {
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  const filled = Math.round(t * width);
  return '#'.repeat(filled) + '.'.repeat(width - filled);
}
const pad = (s, w) => String(s).padStart(w);

// ===========================================================================
// Main
// ===========================================================================
function cp1() {
  console.log('\n================= CP1: (beta, A, N) PHASE DIAGRAM =================');
  const BETAS = [0.02, 0.05, 0.1, 0.15, 0.2, 0.3];
  const AS = [0.05, 0.1, 0.2, 0.35, 0.5];
  const NS = [8, 16, 32, 64];
  const SEEDS = 12;
  const TRANSIENT = 12;
  const ANALYZE = 28;
  const results = [];

  for (const Np of NS) {
    console.log(`\n--- N_per_pop = ${Np}  (basin fraction %, ${SEEDS} seeds) ---`);
    console.log(
      'beta\\A   ' + AS.map((a) => pad('A=' + a.toFixed(2), 9)).join(''),
    );
    for (const beta of BETAS) {
      const row = [];
      for (const A of AS) {
        const cell = runCell({
          Np,
          A,
          beta,
          seeds: SEEDS,
          seed0: 1000,
          transient: TRANSIENT,
          analyze: ANALYZE,
        });
        results.push({ Np, A, beta, ...cell });
        row.push(cell);
      }
      console.log(
        pad(beta.toFixed(2), 6) +
          '   ' +
          row.map((c) => pad((c.basinFrac * 100).toFixed(0) + '%', 9)).join(''),
      );
    }
  }

  // Morph amplitude heatmap for the most useful N (16 and 32)
  for (const Np of [16, 32]) {
    console.log(
      `\n--- N_per_pop = ${Np}  (mean morph amplitude Hz, in-basin seeds) ---`,
    );
    console.log(
      'beta\\A   ' + AS.map((a) => pad('A=' + a.toFixed(2), 9)).join(''),
    );
    for (const beta of BETAS) {
      const row = AS.map(
        (A) => results.find((r) => r.Np === Np && r.A === A && r.beta === beta).meanMorph,
      );
      console.log(
        pad(beta.toFixed(2), 6) +
          '   ' +
          row.map((m) => pad(m ? m.toFixed(0) : '-', 9)).join(''),
      );
    }
  }

  // Rank cells by a combined score: high basin, large morph, stable role.
  // Normalize morph across the grid.
  const maxMorph = Math.max(...results.map((r) => r.meanMorph), 1);
  const scored = results
    .filter((r) => r.basinFrac > 0)
    .map((r) => ({
      ...r,
      score:
        r.basinFrac * 0.5 +
        (r.meanMorph / maxMorph) * 0.3 +
        r.meanRole * 0.2,
    }))
    .sort((a, b) => b.score - a.score);

  console.log('\n--- Top regimes (score = .5*basin + .3*morph_norm + .2*role) ---');
  console.log(
    pad('N', 4) +
      pad('A', 7) +
      pad('beta', 7) +
      pad('basin', 8) +
      pad('fracLive', 10) +
      pad('role', 7) +
      pad('morphHz', 9) +
      pad('cHz', 7) +
      pad('score', 8),
  );
  for (const r of scored.slice(0, 12)) {
    console.log(
      pad(r.Np, 4) +
        pad(r.A.toFixed(2), 7) +
        pad(r.beta.toFixed(2), 7) +
        pad((r.basinFrac * 100).toFixed(0) + '%', 8) +
        pad(r.meanFracLive.toFixed(2), 10) +
        pad(r.meanRole.toFixed(2), 7) +
        pad(r.meanMorph.toFixed(0), 9) +
        pad(r.meanMorphCentroid.toFixed(0), 7) +
        pad(r.score.toFixed(3), 8),
    );
  }
  return { results, scored };
}

function cp2(best) {
  console.log('\n================= CP2: DOES N WIDEN THE BASIN? =================');
  const { A, beta } = best;
  console.log(`Best regime from CP1: A=${A}, beta=${beta}`);
  const NS = [8, 16, 24, 32, 48, 64];
  const SEEDS = 24;
  const TRANSIENT = 12;
  const ANALYZE = 28;
  const curve = [];
  console.log(
    pad('N', 5) +
      pad('basin%', 9) +
      pad('fracLive', 11) +
      pad('role', 8) +
      pad('morphHz', 9) +
      '   basin',
  );
  for (const Np of NS) {
    const cell = runCell({
      Np,
      A,
      beta,
      seeds: SEEDS,
      seed0: 5000,
      transient: TRANSIENT,
      analyze: ANALYZE,
    });
    curve.push({ Np, ...cell });
    console.log(
      pad(Np, 5) +
        pad((cell.basinFrac * 100).toFixed(0) + '%', 9) +
        pad(cell.meanFracLive.toFixed(2), 11) +
        pad(cell.meanRole.toFixed(2), 8) +
        pad(cell.meanMorph.toFixed(0), 9) +
        '   ' +
        bar(cell.basinFrac, 0, 1, 20),
    );
  }
  return curve;
}

function cp3(best) {
  console.log('\n================= CP3: MORPH CHARACTERIZATION =================');
  const { beta, Np } = best;
  const TRANSIENT = 20;
  const ANALYZE = 240; // long window for spectral resolution (>=10 breathing cycles)

  // ---- Timescale relation: breathing period vs coupling disparity A --------
  // (fixed beta, N). The first in-basin seed per A is characterized over a long
  // window. Stationary = peak below the resolvable band (settled offset).
  console.log(`Fixed beta=${beta}, N=${Np}; 240 s windows.`);
  console.log('\n--- Timescale relation: morph period vs coupling disparity A ---');
  console.log(
    pad('A', 7) + pad('period_s', 13) + pad('flatness', 10) + pad('morphHz', 9),
  );
  const aPts = [];
  for (const Av of [0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5]) {
    const seed = firstBasinSeed({ Np, A: Av, beta, transient: TRANSIENT });
    if (seed === null) {
      console.log(pad(Av.toFixed(2), 7) + pad('(no chimera)', 13));
      continue;
    }
    const run = runTwoPopulation({ Np, A: Av, beta, seed, transient: TRANSIENT, analyze: ANALYZE });
    const sp = morphSpectrum(run.C, run.dt);
    const m = analyzeRun(run);
    aPts.push({ A: Av, sp, morph: m.morphAmp });
    console.log(
      pad(Av.toFixed(2), 7) +
        pad(periodStr(sp), 13) +
        pad(sp.flatness.toFixed(3), 10) +
        pad(m.morphAmp.toFixed(0), 9),
    );
  }

  // ---- Timescale relation: morph period vs phase lag beta ------------------
  console.log('\n--- Timescale relation: morph period vs phase lag beta ---');
  console.log(pad('beta', 7) + pad('period_s', 13) + pad('flatness', 10));
  for (const bv of [0.02, 0.05, 0.1, 0.15, 0.2]) {
    const seed = firstBasinSeed({ Np, A: best.A, beta: bv, transient: TRANSIENT });
    if (seed === null) {
      console.log(pad(bv.toFixed(2), 7) + pad('(no chimera)', 13));
      continue;
    }
    const run = runTwoPopulation({ Np, A: best.A, beta: bv, seed, transient: TRANSIENT, analyze: ANALYZE });
    const sp = morphSpectrum(run.C, run.dt);
    console.log(pad(bv.toFixed(2), 7) + pad(periodStr(sp), 13) + pad(sp.flatness.toFixed(3), 10));
  }

  // ---- Detailed morph SHAPE characterization at the breathing optimum ------
  // Pick the A with the fastest finite (non-stationary) breathing — the regime
  // whose morph is the cleanest limit cycle — and characterize several seeds.
  const breathing = aPts
    .filter((p) => !p.sp.stationary)
    .sort((a, b) => a.sp.peakPeriod - b.sp.peakPeriod)[0];
  const Abr = breathing ? breathing.A : best.A;
  console.log(`\n--- Morph shape at the breathing optimum (A=${Abr}, beta=${beta}, N=${Np}) ---`);
  console.log(
    pad('seed', 6) +
      pad('period_s', 13) +
      pad('flatness', 10) +
      pad('harm2/1', 9) +
      pad('crest', 8) +
      pad('morphHz', 9),
  );
  const specs = [];
  let found = 0;
  for (let s = 0; s < 40 && found < 5; s++) {
    const probe = runTwoPopulation({ Np, A: Abr, beta, seed: 9000 + s, transient: TRANSIENT, analyze: 28 });
    if (analyzeRun(probe).fracLive < IN_BASIN) continue;
    found++;
    const run = runTwoPopulation({ Np, A: Abr, beta, seed: 9000 + s, transient: TRANSIENT, analyze: ANALYZE });
    const sp = morphSpectrum(run.C, run.dt);
    const m = analyzeRun(run);
    specs.push(sp);
    console.log(
      pad(9000 + s, 6) +
        pad(periodStr(sp), 13) +
        pad(sp.flatness.toFixed(3), 10) +
        pad(sp.harmonicRatio.toFixed(2), 9) +
        pad(sp.crest.toFixed(2), 8) +
        pad(m.morphAmp.toFixed(0), 9),
    );
  }
  console.log(
    '\nInterpretation: flatness ~0 => sharp spectral peak => periodic limit cycle' +
      ' (chaotic would be broadband, flatness -> 1).\n' +
      'crest ~1.4 & harm2/1 ~0 => pure sine; higher crest / nonzero harm2/1 => asymmetric,' +
      ' relaxation-style breathing.',
  );
  return { aPts, specs, Abr };
}

function firstBasinSeed({ Np, A, beta, transient }) {
  for (let s = 0; s < 40; s++) {
    const run = runTwoPopulation({ Np, A, beta, seed: 9000 + s, transient, analyze: 28 });
    if (analyzeRun(run).fracLive >= IN_BASIN) return 9000 + s;
  }
  return null;
}

function linfit(xs, ys) {
  const n = xs.length;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

// ===========================================================================
function main() {
  const t0 = Date.now();
  console.log('Chimera characterization probe (Build B) — seeded, offline, deterministic.');
  console.log(`F0=${F0} Hz, AMOUNT=${AMOUNT}, dt=${DT}, RK4 mean-field two-population Sakaguchi.`);

  const { scored } = cp1();
  // Pick the best regime: prefer the highest-score cell at a mid N (16 or 32)
  // so CP2 can sweep N around it.
  const best = scored.find((r) => r.Np === 16) || scored[0];
  const cp2curve = cp2(best);
  // For CP3 use a regime/N where chimeras are robust (use the CP1 winner's A/beta
  // at an N that gives a wide basin from CP2).
  const robustN = cp2curve.reduce((a, b) => (b.basinFrac >= a.basinFrac ? b : a)).Np;
  cp3({ A: best.A, beta: best.beta, Np: robustN });

  console.log(`\nTotal runtime: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

main();
