# Clinical Study Export & Reproducibility Guide

AnnealMusic v7.5 introduces **Clinical Study Export Bundles**, a complete solution for packing all assets, stimuli configurations, clinical protocols, scripts, and subject data into a single, immutable, self-contained archive (.zip).

This guide outlines how to use the export dialog, configure privacy settings, and prepare a reproducible clinical study package for publication or peer review.

---

## 1. Creating a Study Version

Before a study can be exported, its state must be frozen.

1. Navigate to the `/research` panel and select **Studies**.
2. Open your target study and click **Snapshot** in the top right.
3. Label your snapshot (e.g., `v1.0.0`, `pre-registration`). This freezes the investigators, patches, pieces, listening sessions, experiments, and scripts into an immutable version.

---

## 2. Triggering the Export

To export a frozen study version:

1. Click the **Export** button next to the desired version in your study versions list.
2. Select your **Reproducibility Level**:
   - **Bytes Identical**: Guarantees identical rendered WAV audio (verified via SHA-256 matches).
   - **Perceptually Identical**: Allows tiny floating-point drift across runtimes but remains audibly identical.
   - **Statistically Equivalent**: Designed for stochastic stimuli (e.g. Kuramoto oscillators with random seeds).
3. Toggle **Include Subject Session Records** if you wish to pack datalogs and signal streams.

---

## 3. Privacy & IRB Compliance

When exporting clinical data, AnnealMusic enforces strict anonymization safeguards:

1. **Scrubbed Subject IDs**: All subject IDs are replaced with clean, stable UUIDs.
2. **Relative Timestamps**: All absolute calendar datetimes are scrubbed. Telemetry datalogs and biofeedback streams are shifted to relative offsets in seconds from the session's start (`0.000s`).
3. **Differential Privacy (DP)**: Researchers can toggle DP noise on response and adverse event fields. This injects pure-Python Laplace noise scaled to clinical sensitivity bounds.
4. **Attestation Check**: PIs must actively sign a compliance attestation confirming that all data conforms to HIPAA/IRB anonymization protocols before the download is allowed.

---

## 4. Academic Citation

Every bundle automatically compiles a `CITATION.bib` file. This contains a complete BibTeX citation with minted DOIs, author lists compiled from study investigators, and the exact AnnealMusic core version, ready to copy directly into your paper's bibliography section.
