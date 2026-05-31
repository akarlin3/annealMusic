# AnnealMusic Legal Posture: Infrastructure, Authorship, & Data Boundaries

As a scientific research instrument, AnnealMusic maintains an explicit, transparent, and honest legal posture. This document serves as the formal declaration of how the software interacts with principal investigators, research institutions, Institutional Review Boards (IRBs), and human subject data.

---

## 1. Zero-Strings Infrastructure Definition

AnnealMusic is classified strictly as **software infrastructure**.

- Using the software to configure auditory stimuli, model synthesis parameters, or run local behavioral trials does not establish a joint venture, partnership, or cooperative relationship between the investigator and the software creators.
- The software developers, maintainers, and host systems act purely as utility providers.

---

## 2. IP and Co-Authorship Boundaries

- **No Co-authorship Claims**: The creators of AnnealMusic do not claim co-authorship rights, licensing rights, or intellectual property rights on any scientific findings, patents, papers, or media generated through the tool.
- **Academic Integrity Standards**: The standard of academic citation is sufficient. Investigators are expected to cite the software version and Zenodo DOI as they would any laboratory equipment or programming environment (e.g., Python, MATLAB, R).

---

## 3. Data Processing and GDPR/HIPAA Boundaries

- **Zero-Egress by Default**: By design, AnnealMusic processes all participant-level logs, survey inputs, and physiological biometrics locally in the user's browser sandbox environment. No subject-level logs are transmitted to central AnnealMusic servers unless the investigator explicitly opts into and purchases an enterprise hosted storage service.
- **GDPR Participant Sovereignty**: In full compliance with GDPR and human-subject ethics:
  - If a participant chooses to withdraw consent mid-session and selects **"Discard All Data"**, the system executes a **cascade shredding** routine.
  - This permanently deletes all subjective, calibration, and behavioral logs from all temporary storage and designated endpoints, leaving only a secure cryptographic audit log proving to the IRB that a participant enrolled and safely withdrew.
- **Differential Privacy Support**: To protect participant identity in open-access data releases, the local export compiler includes support for **Differential Privacy (Laplace noise)**, allowing investigators to inject controlled mathematical noise to aggregated numeric responses before publishing.
