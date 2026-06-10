"""Scoring module: four pre-committed pass conditions for the kinetic-theory
probe (anneal v6). Thresholds are FROZEN here and may not be moved; they are
the same four conditions under which the additive 1/sqrt(N) noise (Appendix B)
and the multiplicative breath-locked noise / WS-constants mechanisms were
excluded, with the prolongation window pre-committed at [2.9, 3.5] for this
probe.

Conditions (evaluated at the correction's physical, theory-fixed order):
  (1) prolongation factor in [2.9, 3.5]: median over N in {8,16,32,64} of
      (median capture time) / (per-N deterministic DOP853 median);
  (2) N-independent: CV of the per-N factor across the four N < 0.15;
  (3) breath-phase locking preserved: Rayleigh p < 0.05 of capture phases
      (canonical PR#41 breath detector) at every N;
  (4) rising-in-cycles hazard: censored-Weibull k_cyc > 1 with the 95%
      profile-likelihood CI excluding 1 at every N.

Verdict convention (stated before any scoring run): PASS = all four hold;
PARTIAL = condition (1) holds but not all four; FAIL = condition (1) fails.
All four are reported individually regardless.

Diagnostics reported alongside but NON-BINDING: the factor against the pooled
deterministic reference (the manuscript's 3.2x convention), the CV over
N in {8,16,32} only, and the measured-system context (under per-N referencing
the MEASURED factors are 3.44/3.16/3.03/1.98, CV 0.190, because the reduced
ensemble's median crosses one extra breath cycle at N=64; see
paper/revision-data-gated/results_mech.json "notes").
"""
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

import importlib.util  # noqa: E402

_spec = importlib.util.spec_from_file_location(
    "ah_survival", ROOT / "anneal-hazard/src/survival.py")
ah_survival = importlib.util.module_from_spec(_spec)
sys.modules["ah_survival"] = ah_survival  # dataclasses need the module registered
_spec.loader.exec_module(ah_survival)
fit_weibull_ci = ah_survival.fit_weibull

from harness import DET_MED, DET_POOLED_MED, NS, T_MAX, ABS  # noqa: E402

rayleigh = ABS["rayleigh"]

# ------------------------- pre-committed thresholds -------------------------
PROLONG_LO, PROLONG_HI = 2.9, 3.5     # condition (1)
CV_MAX = 0.15                         # condition (2)
RAYLEIGH_ALPHA = 0.05                 # condition (3)
KCYC_FLOOR = 1.0                      # condition (4): CI low end must exceed
# ----------------------------------------------------------------------------

MEASURED_CONTEXT = {  # ground truth from results_mech.json (read-only context)
    "per_N_factor": {"8": 3.4441776710684264, "16": 3.1581450653983354,
                     "32": 3.027874564459931, "64": 1.98359375},
    "median_factor": 3.0930098149291334,
    "cv_factor": 0.1901232427195897,
}


def summarize_cell(rows, det_med):
    """Per-(N) summary with censoring-aware fits (event = captured, censored
    at T_MAX). Verbatim logic of mech_probe.summarize_cell (identical bar)."""
    n = len(rows)
    cap = np.array([r["captured"] for r in rows], bool)
    t = np.array([r["t_capture"] if r["captured"] else T_MAX for r in rows], float)
    ev = cap.astype(int)
    cap_frac = float(cap.mean())
    med_all = float(np.median(t))
    prolong = med_all / det_med if det_med and np.isfinite(det_med) else float("nan")

    phis = np.array([r["capture_phase_canon"] for r in rows
                     if r["capture_phase_canon"] is not None], float)
    n_ray, mphase, Rbar, z, p_ray = rayleigh(phis) if len(phis) else (
        0, np.nan, np.nan, np.nan, np.nan)

    wt = fit_weibull_ci(np.maximum(t, 0.05), ev) if ev.sum() >= 5 else None

    tb = np.array([r["Tb_canon"] if r["Tb_canon"] else np.nan for r in rows], float)
    ok = np.isfinite(tb) & (tb > 0)
    nc = t[ok] / tb[ok]
    evc = ev[ok]
    wc = fit_weibull_ci(np.maximum(nc, 1e-3), evc) if evc.sum() >= 5 else None
    med_cyc = float(np.median(nc[evc == 1])) if (evc == 1).sum() else float("nan")

    return dict(
        n=n, n_captured=int(cap.sum()), n_censored=int(n - cap.sum()),
        capture_frac=cap_frac, median_capture=med_all,
        median_is_censored=bool(cap_frac <= 0.5),
        det_ref=det_med, prolongation=prolong,
        rayleigh_n=int(n_ray), rayleigh_Rbar=float(Rbar), rayleigh_p=float(p_ray),
        weibull_k=(float(wt.k) if wt else float("nan")),
        weibull_k_ci=([float(wt.k_ci[0]), float(wt.k_ci[1])] if wt else None),
        k_cyc=(float(wc.k) if wc else float("nan")),
        k_cyc_ci=([float(wc.k_ci[0]), float(wc.k_ci[1])] if wc else None),
        n_no_Tb=int(len(rows) - ok.sum()), median_cycles=med_cyc,
        median_Tb=float(np.nanmedian(tb)) if ok.any() else float("nan"),
        m_lo_min=float(min(r["m_lo"] for r in rows)),
        m_hi_max=float(max(r["m_hi"] for r in rows)),
    )


def score(by_N, label, extra=None):
    """Score one run set against the four pre-committed conditions.
    Returns the full score dict (also suitable for score.json)."""
    cells = {N: summarize_cell(by_N[N], DET_MED[N]) for N in NS}

    facs = [cells[N]["prolongation"] for N in NS]
    med_fac = float(np.median(facs))
    cv = float(np.std(facs) / np.mean(facs)) if np.mean(facs) else float("nan")
    c1 = bool(PROLONG_LO <= med_fac <= PROLONG_HI)
    c2 = bool(cv < CV_MAX)
    c3 = bool(all(np.isfinite(cells[N]["rayleigh_p"])
                  and cells[N]["rayleigh_p"] < RAYLEIGH_ALPHA for N in NS))
    klo = [(cells[N]["k_cyc_ci"][0] if cells[N]["k_cyc_ci"] else float("nan"))
           for N in NS]
    c4 = bool(all(np.isfinite(k) and k > KCYC_FLOOR for k in klo))
    all_pass = bool(c1 and c2 and c3 and c4)
    verdict = "pass" if all_pass else ("partial" if c1 else "fail")

    # non-binding diagnostics
    fac_pooled = {str(N): cells[N]["median_capture"] / DET_POOLED_MED for N in NS}
    fp = list(fac_pooled.values())
    f832 = facs[:3]
    diagnostics = {
        "pooled_det_reference_s": DET_POOLED_MED,
        "factor_vs_pooled_ref": fac_pooled,
        "factor_vs_pooled_ref_median": float(np.median(fp)),
        "factor_vs_pooled_ref_cv": float(np.std(fp) / np.mean(fp)),
        "cv_factor_N8_16_32_only": float(np.std(f832) / np.mean(f832)),
        "measured_system_context": MEASURED_CONTEXT,
    }

    out = {
        "label": label,
        "pre_committed_conditions": {
            "cond1": f"median per-N prolongation factor in [{PROLONG_LO}, {PROLONG_HI}]",
            "cond2": f"CV of per-N factor across N in {NS} < {CV_MAX}",
            "cond3": f"Rayleigh p < {RAYLEIGH_ALPHA} of capture phases at every N",
            "cond4": "censored-Weibull k_cyc > 1, 95% profile CI excluding 1, every N",
            "verdict_convention": "pass = all four; partial = cond1 only-ish "
                                  "(cond1 holds, not all four); fail = cond1 fails",
        },
        "per_N_factor": {str(N): facs[i] for i, N in enumerate(NS)},
        "median_factor": med_fac,
        "cv_factor": cv,
        "cond1_prolong_2p9_3p5": c1,
        "cond2_cv_lt_0p15": c2,
        "cond3_rayleigh_all_N": c3,
        "cond4_kcyc_gt1_all_N": c4,
        "all_pass": all_pass,
        "verdict": verdict,
        "cells": {str(N): cells[N] for N in NS},
        "deterministic_ref": {str(N): DET_MED[N] for N in NS},
        "diagnostics": diagnostics,
    }
    if extra:
        out.update(extra)
    return out


def write_score(score_dict, path):
    Path(path).parent.mkdir(exist_ok=True)
    Path(path).write_text(json.dumps(score_dict, indent=2, default=float))
    return path
