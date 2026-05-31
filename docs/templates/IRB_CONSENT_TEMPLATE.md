# IRB Consent Template: Informed Consent for Auditory Research

> [!IMPORTANT]
> **Disclaimer**: Templates require legal and Institutional Review Board (IRB) review at your institution. AnnealMusic provides drafts as starting points, not legal advice.

---

## Informed Consent to Participate in Research

**Study Title**: [Insert Study Title, e.g., Cognitive Effects of Dynamic Generative Music]  
**Principal Investigator**: [Insert PI Name, Title, Institution]  
**Funding Agency**: [Insert Funding Source, e.g., National Institutes of Health, Grant #XXXX]

---

## 1. Introduction & Purpose

You are invited to participate in a research study involving auditory stimulus exposure and physiological tracking. The purpose of this study is to analyze how continuous, dynamically changing auditory environments affect [insert target, e.g., cognitive fatigue, breathing rates, autonomic relaxation].

---

## 2. Procedures

If you agree to participate, you will complete the following procedures:

1. **Physical Sound Calibration**: You will listen to a brief $1\text{ kHz}$ reference tone to calibrate your listening hardware to a safe, comfortable volume level (approximately $60-65\text{ dBA}$).
2. **Auditory Exposure**: You will listen to generative musical synthesis or sonified data streams for approximately [insert duration, e.g., 30 minutes].
3. **Surveys & Tasks**: You will answer simple demographic and comfort surveys, and perform response-latency tasks (tapping keys on your keyboard).
4. **Physiological Tracking (Optional)**: If you opt in, the system will pair with your BLE device (Polar chest strap / biometric sensor) to record heart rate and respiratory data.

---

## 3. Risks & Discomforts

The primary risks associated with this study are mild auditory fatigue, hearing strain, headaches, or brief periods of sensory over-stimulation.

- You can stop playback at any time by pressing the prominent **HALT AUDIO** button on your screen.
- You can report symptoms immediately using the **Symptom Trigger** overlay.

---

## 4. Privacy & Data Confidentiality

Your data will be stored under a cryptographically random, anonymized unique code (UUIDv4). No personally identifying information (such as name, IP address, or email) is linked to your experimental records.

- All raw data is stored locally in an encrypted sandbox on your device during the session.
- Aggregated data is securely transmitted via HTTPS to the investigator's database.

---

## 5. Voluntary Participation & Withdrawal Rights

Your participation is voluntary. You can withdraw your consent and end participation at any time:

- **Discard All Data**: If you select this option upon withdrawal, all subjective survey responses, reaction logs, and physical calibration logs will be instantly and permanently shredded from the server. The server will only record the fact that a participant withdrew, as required for audit tracking.
- **Retain Partial Data**: You may allow investigators to keep the data recorded prior to your withdrawal.

---

## 6. Participant Acknowledgment

By clicking **"I Agree and Consent"**, you acknowledge that:

- You are at least 18 years of age.
- You have read this consent form and understand the procedures, risks, and your withdrawal rights.
- You explicitly opt in to the following data collection streams:
  - `[ ]` Behavioral Responses & Reaction Latencies (Required)
  - `[ ]` Headphone SPL Calibration Data (Required)
  - `[ ]` Physiological Biometrics: Heart Rate Variability (Optional)
  - `[ ]` Physiological Biometrics: Respiration Rates (Optional)
