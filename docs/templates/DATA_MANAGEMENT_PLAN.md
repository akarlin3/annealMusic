# Data Management Plan: NIH/NSF-Style Template

> [!IMPORTANT]
> **Disclaimer**: Templates require legal and Institutional Review Board (IRB) review at your institution. AnnealMusic provides drafts as starting points, not legal advice.

---

## 1. Types of Data to be Generated

This study will generate several quantitative behavioral and physiological data streams:

- **Stimulus Parameters**: Cryptographic checksums (SHA-256) of active digital audio synthesis configurations and mapping specifications.
- **Behavioral Latency Logs**: Continuous response metrics and keyboard-anchored reaction times, recorded with sub-millisecond precision.
- **Subjective Survey Inputs**: Multi-point Likert ratings, demographic choices, and optional free-text reflection responses.
- **Autonomic Biofeedback Stream**: Heart Rate Variability (R-R interval sequences) and respiratory waves, logged at a standard sample rate of $[30\text{ Hz}-50\text{ Hz}]$.
- **Physical SPL Calibration Logs**: Measured headphone levels and calculated decibel gain multipliers.

---

## 2. Standards for Data & Metadata Formatting

All generated datasets will be stored in highly standardized, machine-readable scientific formats:

- **Raw Log Sequences**: Stored in uncompressed **JSON Lines (JSONL)** format to preserve raw high-frequency observations without data loss.
- **Tabular Outputs**: Compiled into flat **CSV** formats, suitable for downstream processing in Python, R, MATLAB, Julia, or SPSS.
- **Zipped Archives**: The final reproducible study archive is bundled as a standard `.zip` file containing:
  - `manifest.json`: Locking all software, schema, and script versions.
  - `responses.csv`: Aggregated behavioral and survey metrics.
  - `datalogger.jsonl`: Time-locked telemetry tick sequences.

---

## 3. Policies for Access & Sharing (GDPR / HIPAA Compliance)

- **Anonymization Boundary**: All absolute database timestamps are shifted to relative offsets (seconds from session start) upon participant ingestion. Patient IDs are masked with random UUIDv4 strings.
- **Differential Privacy**: Investigators can apply Laplace noise to numeric aggregates to ensure that individual patient values cannot be reconstructed from open-access data packages.
- **Zero-Egress Sandboxing**: Data is processed locally in the user's browser sandboxed environment. No data egress to AnnealMusic central services occurs unless explicitly opted in.

---

## 4. Plans for Archiving & Long-Term Preservation

At the conclusion of the research study, the entire self-contained, reproducible ZIP bundle will be archived in persistent scientific repositories:

- **Zenodo Repository**: The primary archive is deposited on Zenodo to secure a permanent **Digital Object Identifier (DOI)**.
- **OSF (Open Science Framework)**: Supplementary user scripts and CSV sheets are cross-linked to the study's OSF preregistration space.
- **Retention Period**: All finalized data archives will be retained in open-access storage for a minimum of 10 years to support ongoing scientific audit and replication attempts.
