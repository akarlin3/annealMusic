# Version Pinning & Reproducibility Guide

Academic credibility relies entirely on reproducibility. Because web-based tools and audio libraries naturally shift over time, AnnealMusic implements strict, version-locked mechanisms to guarantee that a study conducted today returns identical acoustic and behavior telemetry when re-run years from now.

---

## 1. Pinning the Command Line Interface (CLI)

When running sweeps, rendering pieces, or running batch evaluations, always pin the global npm package to a specific semantic version:

```bash
# Install the exact version used in your paper
npm install -g annealmusic@5.7.0
```

Verify your version matches the publication:

```bash
annealmusic --version
```

---

## 2. Pinning the In-Browser Runtime

By default, loading `https://anneal.averykarlin.org/research` accesses the latest stable release. To lock the runtime to the exact engine version used during participant collection, append the `version` parameter to the URL:

```url
https://anneal.averykarlin.org/research?version=5.7.0
```

This instructs the application bootstrapper to download and freeze the Web Assembly audio worklets and schemas associated with the specified tag, bypassing modern CDN updates.

---

## 3. Embedding Metadata in Data Manifests

All exported experiment ZIP structures automatically carry detailed telemetry manifests in `manifest.json`. Ensure your analysis pipeline verifies these values before ingestion:

```json
{
  "experiment_title": "Consonance Study",
  "subject_id": "sub-x9f2a41b",
  "timestamp": "2026-05-30T02:30:15.123Z",
  "anneal_music_version": "5.7.0",
  "schema_version": "v20"
}
```

If these fields deviate from your experiment registry, flag the dataset as contaminated.

---

## 4. Verifying Parity

If you re-run an offline rendering sweep or reconstruct participant stimulations and want to assert that the sound output matches the published baseline frame-by-frame, use the `verify-parity` tool:

```bash
annealmusic verify-parity original_stimulus.wav reproduced_stimulus.wav
```

The terminal prints detailed sample-level deviation metrics:

```text
[INFO] Comparing original_stimulus.wav vs reproduced_stimulus.wav
[INFO] Mean Squared Error (MSE): 0.000000e+00
[INFO] Root Mean Squared Error (RMSE): 0.000000e+00
[INFO] Max Absolute Difference: 0.000000e+00
[SUCCESS] Perfect sample-level parity verified!
```

Any MSE above `1e-7` indicates runtime floating point differences (e.g. browser Web Audio implementation vs NodeJS environment) and should be flagged.
