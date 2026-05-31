# Peer Reviewer's & Replicator's Guide

This guide explains how to verify and replicate an AnnealMusic Clinical Study using a study export bundle (.zip) sent by a researcher or downloaded from Zenodo/Dryad.

---

## 1. Web Portal Replication

Replicating a study in the web interface is the fastest way to audit results:

1. Navigate to `/reproduce` on the active AnnealMusic instance.
2. Drag and drop the study `.zip` bundle or browse your files to upload it.
3. Click **Run Reproduction Pipeline**.
4. The visual checklist will trace the verification stages step-by-step:
   - **Stage 1 (Unpacking & Hash Check)**: Asserts the bundle manifest integrity, validating that every stimulus and protocol matches its original SHA-256 signature.
   - **Stage 2 (Audio Hash Parity)**: Re-renders synthesis stimuli in your browser's Web Audio workspace and verifies that output hashes/descriptors match the bundle's calibrated audio specifications.
   - **Stage 3 (Script Analysis)**: Executes the included Python scripts against the scrubbed database records in a secure, isolated temp directory, streaming stdout/stderr outputs directly into the Retro terminal console.

---

## 2. Headless CLI Replication

Replicating a study from the terminal is suitable for automated CI/CD and large-scale replication sweeps:

### A. Manifest Integrity Check

Run `validate` to verify that all files exist and match their SHA-256 signatures:

```bash
annealmusic validate study_bundle.zip
```

If a file has been altered or tampered with, the CLI will output:

```bash
❌ Schema validation failed for study_bundle.zip:
  - Hash mismatch for stimuli/patch_abc.json. Expected e3b0c442..., got 4a7f9c2d...
```

### B. Complete Reproduction Sweep

Run `reproduce` to validate manifest hashes, re-render audio to verify sample parity, and execute bundled Python analysis scripts:

```bash
annealmusic reproduce study_bundle.zip
```

This command runs the analysis scripts offline using your local Python virtual environment, dumping the analysis table, execution status, and logs directly into standard output:

```bash
Reproducing study from bundle: study_bundle.zip...

Reproduction Report:
- Valid: ✅ YES
- Reproducibility Level: bytes-identical
- Audio Hash Parity: ✅ MATCH

Script Output:
Starting replication analysis...
Loaded 1 anonymized subject records successfully.
Record 1 completed in 300.0 seconds.
```
