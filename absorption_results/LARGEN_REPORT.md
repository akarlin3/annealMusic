# Large-N absorption sweep — does the 3.2x prolongation asymptote survive?

**Question (guaranteed reviewer point).** The paper reports that the reduced order-parameter flow captures ~3.2x faster than the finite-N system dies, and that this prolongation is N-independent over N=4..64 (a 16x range). A reviewer will ask whether the plateau is asymptotic or whether tau_abs(N) collapses toward the reduced capture time (~43s) as finite-size fluctuations vanish. This sweep extends the A=0.5 absorption measurement another 16x, to N=256, 512, 1024, under the identical absorption-grade criterion and paired seeds.

**Verdict: PLATEAU SURVIVES.**

- tau_abs(N) across new N=[256, 512, 1024]: 126s, 124s, 123s (KM median); spread max/min = 1.02.
- prolongation tau_abs/tau_reduced across new N: 2.95x, 2.91x, 2.88x.
- full-range log-N rate of tau_abs (N=4..1024): c = -0.0151 per ln(N) (c~0 => flat, no drift toward the reduced timescale).
- zero/low censoring at t_max=2000s confirms the lifetimes are fully resolved, not truncated, at every N.

## Per-N table

| N | tau_abs KM (s) | prolongation | plateau vs N=64 | censored |
|---|----------------|--------------|------------------|----------|
| 4 | 126.7 | 2.97 | 1.00 | 0/200 |
| 8 | 143.3 | 3.36 | 1.13 | 0/200 |
| 16 | 132.6 | 3.11 | 1.04 | 0/200 |
| 24 | 125.9 | 2.95 | 0.99 | 0/200 |
| 32 | 130.2 | 3.05 | 1.03 | 0/200 |
| 48 | 125.2 | 2.94 | 0.99 | 0/200 |
| 64 | 126.9 | 2.98 | 1.00 | 0/200 |
| 256 (new) | 125.9 | 2.95 | 0.99 | 0/200 |
| 512 (new) | 124.3 | 2.91 | 0.98 | 0/200 |
| 1024 (new) | 122.9 | 2.88 | 0.97 | 0/200 |

Artifacts: `largeN_survival.{csv,png,pdf}`, `largeN_multipliers.{csv,md}`, `largeN_tau_vs_N.{png,pdf}`.
