# Clinical IRB Templates: Protocols, Consent, & Data Management Plans

> [!IMPORTANT]
> **Disclaimer**: Templates require legal and Institutional Review Board (IRB) review at your institution. AnnealMusic provides drafts as starting points, not legal advice.

---

## 1. Study Protocol Narrative: Auditory Stimuli & Calibration

### Target Section: Methodology / Study Design

> "Auditory stimuli are synthesized dynamically using the Web Audio API on the participant's local device, or streamed as raw lossless audio files via the AnnealMusic platform.
> To ensure physical auditory safety and consistent acoustic dosage, a hardware-level Sound Pressure Level (SPL) calibration procedure is conducted before stimulus presentation.
> Participants adjust their physical playback levels using a calibrated $1\text{ kHz}$ reference tone played at a normalized volume of $-20\text{ dBFS}$. Subsequent auditory stimuli are dynamically scaled using the investigator's calibrated gain multiplier ($G_{cal}$) to maintain a target sound output of $[60-70\text{ dBA}]$, completely avoiding digital clipping."

---

## 2. Informed Consent Form (ICF) Language

### Section: Data Privacy & Security

> "Your physiological biofeedback signals (such as heart rate variability and breathing rates) and behavioral responses (such as reaction times and survey ratings) will be logged by the software.
> All logged telemetry is stored in an encrypted local database sandbox on your device. Only anonymized, aggregated metrics are transmitted to the investigator's database. No personal identifying information (PII) is accessed or stored by the software.
> If you choose to withdraw from this study at any time, you can click the 'Withdraw Consent' button. You will be asked if you want to 'Discard All Data' or 'Retain Partial Data'. Selecting 'Discard All Data' instantly and permanently shreds your logs from all servers."

---

## 3. Data Management Plan (DMP) Boilerplate

### Section: Data Storage, Transfer, & Preservation

- **Local Sandbox Storage**: Participant telemetry is logged locally to an encrypted Zustand state store and cached via `localStorage` during active playbacks.
- **Server Transmission**: Data is transmitted using HTTPS POST requests to the investigator's private API. Data packets are formatted in tabular CSV and compressed JSON Lines (JSONL).
- **Anonymization**: All absolute timestamps are automatically shifted to relative offsets in seconds from the participant's start time. Unique participant identifiers are masked using cryptographically random UUIDv4 keys.
- **Archiving and Access**: At the study's conclusion, investigators compile all data, stimuli manifests, and analysis scripts into a single self-contained, reproducible ZIP bundle. This archive can be uploaded to public repositories (such as OSF, Dryad, or Zenodo) with optional Differential Privacy noise added to protect privacy.
