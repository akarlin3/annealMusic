# AnnealMusic Clinical Study Default Templates & Schema Reference

This reference document establishes the regulatory compliance defaults, Institutional Review Board (IRB) templates, and standardized telemetry formats for **AnnealMusic v7.2 (Stimulus-Grade Audio)** human subject studies.

---

## 1. IRB Consent Screen Template

Clinical PIs may copy and modify the following text block to author informed consent screens for subject runners.

```markdown
Title of Study: [Insert Sponsoring Institution Study Name]
Principal Investigator: [Name, Title, Department]
IRB Protocol Number: [Insert Registry Number or NCT Number]

ABSTRACT:
You are invited to participate in a clinical research session evaluating generative, mathematically
sculpted ambient soundscapes. This session delivers acoustic patterns precisely calibrated to your
headphones/speakers to examine psychological state changes, sound comfort, and entrainment metrics.

PROCEDURE:

1. Consent Validation: Verify your participation parameters.
2. Headphone Comfort Check: Listen to a short reference tone to confirm volume safety.
3. Stimulus Presentation: Listen to a generative auditory pattern for a set duration (e.g., 5 minutes)
   while resting comfortably.
4. Response Survey: Complete a quick symptom and assessment slider.

VOLUNTARY PARTICIPATION & WITHDRAWAL:
Your participation is entirely voluntary. You may halt playback, report an issue, or withdraw
completely at any point during this session using the persistent on-screen clinical controls.
If you withdraw, you hold the absolute right to have all your response telemetry shredded and
permanently erased from the secure study database.

CONFIDENTIALITY:
All logged data are attributed exclusively to a secure, randomly minted Participant Code (Subject ID).
No personally identifiable information (PII) is captured or stored on this platform.
```

---

## 2. IRB Withdrawal & Disposition Choices

To preserve human subject research autonomy while protecting clinical trial data integrity, the runner presents a clear post-withdrawal choice:

1. **Discard Entirely (`disposition = 'discarded'`):**
   - Hallmarks the "Withdraw is Real" absolute privacy stance.
   - The server instantly purges all subjective survey inputs, responses, and physical levels measurements.
   - **Audit Trail Safeguard:** Only a cryptographic record of the consent, absolute timestamp, and the withdrawal action itself is retained in the `client_audit_log` to serve as a verifiable human-subjects ethics audit trail.

2. **Retain Partial Data (`disposition = 'kept'`):**
   - Retains completed survey trials up to the withdraw mark to allow researchers to conduct intent-to-treat or partial session analyses under their protocol specifications.

---

## 3. Telemetry Schema Reference

The following schemas document the exact column payloads stored inside the `clinical_session_records` database and exported in researchers' CSV bundles:

### 3.1 `clinical_session_records` Table Schema

| Column Name                | Type                     | Description                                                      |
| :------------------------- | :----------------------- | :--------------------------------------------------------------- |
| `id`                       | `UUID (Primary Key)`     | Secure session token identifying this participant trial run.     |
| `protocol_id`              | `UUID (Foreign Key)`     | References the parent `clinical_protocols.id`.                   |
| `subject_id`               | `TEXT`                   | Researcher-provided subject code (e.g., `SUB-401`).              |
| `condition_id`             | `TEXT`                   | Active randomized condition identifier mapping.                  |
| `started_at`               | `TIMESTAMPTZ`            | Absolute start timestamp (UTC).                                  |
| `completed_at`             | `TIMESTAMPTZ (Nullable)` | Absolute completion timestamp, or null on withdraw.              |
| `stimulus_sha256`          | `TEXT (Nullable)`        | Cryptographic verification hash of the delivered stimulus.       |
| `calibration_record`       | `JSONB`                  | Master gain calibration factor ($G_{cal}$) and device tags.      |
| `timing_report`            | `JSONB`                  | Web Audio sub-ms onset latency and callback jitter measurements. |
| `adverse_events`           | `JSONB`                  | Category and text tags logging sub-second distressed events.     |
| `withdrew`                 | `BOOLEAN`                | Set to true if the subject terminated participation early.       |
| `partial_data_disposition` | `TEXT`                   | Set to `'kept'` or `'discarded'`.                                |
| `client_audit_log`         | `JSONB`                  | Full audit trail of consent, calibrations, and withdrawals.      |

### 3.2 Standard Output Format for Audit Log Event (`client_audit_log`)

```json
{
  "event": "consent | calibration | stimulus_start | stimulus_end | response | withdraw | flag_issue",
  "timestamp": "ISO-8601 UTC string",
  "text": "Descriptor note or event details (optional)",
  "elapsed_ms": 12345
}
```
