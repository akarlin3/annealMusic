# AnnealMusic Curriculum & Tutorial Surface Audit

This document summarizes the curriculum surface audit conducted during the **v9.2 and v9.3** release cycles. It details how we evaluated educational content, identified pedagogical gaps, and verified that lessons remain completely aligned with our calm-by-design guidelines.

---

## 1. Educational Goals & Design Principles

AnnealMusic’s curriculum surface `/learn` exists to guide learners from basic physical intuition about sound to advanced microtonal synthesis, generative arrangement, and scientific analysis.

All tutorial content adheres to the following principles:

- **Offers, Not Funnels:** Lessons are skippable, dismissable, and carry no artificial timers, urgency, or scores.
- **No Extrinsic Gamification:** Banned terms like "streak", "daily quest", or "level up" are programmatically guarded by our CI lexical gate (`src/test/calm-by-design.test.ts`).
- **Mode-Responsive Learning:** Onboarding and recommendation engines automatically match the user's active device mode (Meditation, Musician, Researcher), offering clear relevance badges when a cross-mode recommendation is presented.

---

## 2. Identified Pedagogical Gaps & remediations

During the v9.2 audit, we reviewed all steps from v0.1 to v8.5 and filled 6 key learning gaps with new, high-fidelity lessons:

1. **Microtonal Harmonics:** Demystifying the math behind the harmonic lattice.
2. **Frequency Modulation (FM) Stacks:** Explaining the phase relationship of operator structures.
3. **Resonator Excitation:** Visualizing the differences between string, tube, and plate modeling.
4. **Offline Datalogging for Researchers:** Programmatic guidance on telemetry sweeps.
5. **Interactive Schedule Editor:** Teaching the concurrent composition timeline.
6. **Mindful Biofeedback Calibration:** Step-by-step guidance on BLE EEG headset alignment.

---

## 3. Heuristic Validation Checks

Every lesson step is run through our automated quality-check pipeline:

- **Audio Clip Affinity:** Ensures linked audio clip references exist in the clip library.
- **Prerequisite Directed Acyclic Graph (DAG):** Cycle-detection verifies there are no deadlocks in the curriculum path.
- **Vocabulary Compliance:** Scans written copy to prevent toxic engagement-loop terminology.
- **Step Completeness:** Assures every step has valid configurations, prompts, and matching visual icons.

---

## 4. Mode Onboarding Matrix

Users are presented with unique, quiet, and skippable mode onboarding:

| Onboarding Track      | Target Mode | Focus                                                          |
| :-------------------- | :---------- | :------------------------------------------------------------- |
| **Silent Mind**       | Meditation  | Breathing timers, calming ambient presets, and focus settings. |
| **Creative Sculptor** | Musician    | The full sandbox, loop capture, and custom synthesis.          |
| **Telemetry Analyst** | Researcher  | Telemetry sweeps, OSC configurations, and scientific scripts.  |

---

## 5. Verification Results

All 5 tracks and 55 lessons compile cleanly with zero verification failures.
All unit tests in `src/learn/__tests__/recommend.test.tsx` pass.
The lexical gate scan reports 100% compliance across all educational surfaces.
