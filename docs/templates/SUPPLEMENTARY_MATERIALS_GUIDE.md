# Supplementary Materials Guide: Submitting Dynamic Auditory Data

> [!IMPORTANT]
> **Disclaimer**: Templates require legal and Institutional Review Board (IRB) review at your institution. AnnealMusic provides drafts as starting points, not legal advice.

---

This guide outlines exactly what files, manifests, and documentation PIs should upload to journal publishers (e.g., Nature, IEEE, Frontiers) as supplementary materials to guarantee 100% reproducibility.

---

## 1. Supplementary Materials Submission Checklist

To comply with high-impact research standards, your supplementary materials bundle should include:

- `[ ]` **Reproducible Study ZIP Archive**: The self-contained, GDPR-anonymized ZIP file exported directly from AnnealMusic.
- `[ ]` **Study Manifest (`manifest.json`)**: Containing strict version locks, synth engine hashes, and SHA-256 integrity proofs.
- `[ ]` **Physical SPL Calibration Log**: Documenting the headphone offsets and gain multipliers used to standardize target decibel outputs ($G_{cal}$).
- `[ ]` **User Python Analysis Scripts**: Any whitelisted Python scripts (utilizing `numpy`, `pandas`, `scipy`) used to compute behavioral statistical aggregates.
- `[ ]` **High-Fidelity Stimulus Audio Renderings**: Raw 16-bit WAV or high-quality Opus audio files of the exact trials played to participants.

---

## 2. Recommended Caption Language

When uploading files to the publisher's portal, use the following standardized descriptions:

### File 1: Supplementary Data ZIP Archive

> _"**Supplementary File 1 (Study_Archive.zip)**: A self-contained, reproducible archive containing the study's parameter configurations, whitelisted Python analysis scripts, raw survey schemas, and anonymized participant behavior logs. This bundle can be imported and executed inside the AnnealMusic Auditor Portal at `https://annealmusic.app/reproduce`."_

### File 2: Physical SPL Calibration & Latency History

> _"**Supplementary File 2 (SPL_Calibration_Log.csv)**: Tabular logs recording the physical Sound Pressure Level (SPL) headphone calibration measurements, gain multipliers ($G_{cal}$), and real-time Web Audio thread latency/jitter summaries recorded across all participant trials."\_

### File 3: High-Fidelity Audio Abstracts

> _"**Supplementary File 3 (Stimulus_Render.mp4)**: A high-fidelity, synchronized video recording capturing the dynamic orbital visualizer and calibrated Web Audio synthesis output representing the active experimental condition."_
