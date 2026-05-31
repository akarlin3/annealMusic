# AnnealMusic v7 Research Collaboration Arc Retrospective

This retrospective closes the **v7 Research Collaboration Arc** (v7.0 → v7.7). Over this cycle, AnnealMusic transformed from a powerful single-user research sandbox into a multi-investigator clinical-grade research orchestrator and sonification display instrument.

Written at the close of the v7.7.0 release, this document provides an honest, comprehensive audit of our original technical and design hypotheses, what was built, unexpected friction points, and future directions.

---

## 1. The Original v7 Thesis & Design Bets

The core thesis of the v7 arc was: **A dynamic, real-time generative-music engine can achieve clinical-grade audio-stimulus rigor and continuous, interactive scientific data sonification in a multi-investigator collaborative environment, without breaching privacy/regulatory boundaries (staying in the "I-narrow" space).**

We structured v7 around five core design bets:

1. **Multi-Investigator Collaboration (`/research` -> Studies)**: Designing a secure, collaborative, and citable "Study" workspace, complete with immutable snapshots and direct Zenodo DOI integrations.
2. **Interpretive & Physics-Correct Sonification (v7.1 / v7.3)**: Moving beyond basic MIDI triggers to a highly parameterized, auto-calibrating mapping interface that translates raw continuous data into expressive audio-visual figures.
3. **Clinical Stimulus-Grade Audio (v7.2)**: Elevating online audio studies to laboratory precision via headphone SPL calibration, cryptographic counterbalancing (Williams Latin Squares), and time-locked onset scheduling.
4. **Live Biosignal Ingest (v7.4)**: Ingesting high-resolution physiological telemetry (HRV, respiration) directly from consumer and laboratory biometric devices over Web Bluetooth, WebHID, WebSerial, and mobile Capacitor bridges.
5. **GDPR / IRB Sovereignty (v7.5)**: Building a zero-egress sandboxed participant environment, automated relative-timestamp anonymization, Laplace-noise differential privacy, and complete cascade shredding of all logs upon participant withdrawal.

---

## 2. Chronological Review of the Arc (v7.0 – v7.7)

| Version  | Focus Area                 | Key Accomplishments                                                                                                                                                                     |
| :------- | :------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v7.0** | Multi-Investigator Studies | Shipped the multi-investigator study workspace, permission matrix (`pi` / `co-investigator` / `analyst`), audit-trail sidebar, immutable snapshots, and Zenodo sandboxed DOI publisher. |
| **v7.1** | Sonification Engine        | Created the dynamic parameter-mapping interface supporting linear, logarithmic, and exponential scaling matrices.                                                                       |
| **v7.2** | Clinical Audio Rigor       | Developed SPL headphone calibration ($1\text{ kHz}$ reference tone), Williams Latin Square counterbalancing, and sub-millisecond onset time-locked scheduling.                          |
| **v7.3** | Sonification Library       | Seeded 20 canonical sonification templates (time series, networks, scalar fields, logs) alongside the auto-calibration dynamic scaling limits.                                          |
| **v7.4** | Biofeedback Ingest         | Implemented BLE Polar H10, OpenBCI Cyton, and Muse 2 drivers, Zustanded biometrics pairing modals, and Capacitor native platforms.                                                      |
| **v7.5** | Reproducible Export        | Built the self-contained ZIP archive exporter (locking synth models, scripts, SHA-256 manifests) and the `/reproduce` auditor portal.                                                   |
| **v7.6** | Scientific Publishing      | Designed Playwright headless MP4 video abstract renders, the `< 30 KB` Vanilla iframe widget (`/embed-figure`), and full talk/slide presenter modes.                                    |
| **v7.7** | Community Closeout         | Completed targeted guides for ICAD and clinical researchers, five partnership templates, legal posture declarations, and final release tagging.                                         |

---

## 3. Serviced Research Communities: An Honest Assessment

### Which communities does v7 actually serve exceptionally well?

- **Auditory Display & ICAD Researchers**: The auto-calibrated parameter mapping, coordinate sweeps, and micro-animations allow domain researchers to rapidly prototype and share sonifications. The `< 30 KB` Vanilla iframe figure widget makes online research dissemination highly accessible.
- **Music Cognition & Auditory Psychology Labs**: The sub-millisecond scheduled auditory onset timing and randomized Williams Latin Square counterbalancing provide the exact temporal and statistical precision required for basic perceptual research.
- **Human-Computer Interaction (HCI) Designers**: The dynamic biofeedback connection framework (HRV, breathing) opens an elegant workspace for exploring physical, embodied interfaces.

### Which communities would benefit from further work?

- **Large-Scale Clinical Trial Networks**: Multi-site coordination across different hospitals currently requires separate study environments. There is no federated database replication layer to synchronize cohorts across institutions without centralizing data.
- **Therapeutic Interventionists (I-wide)**: Because we deliberately stayed "I-narrow" (no diagnostic or therapeutic medical claims), researchers conducting medical interventions cannot easily use the software to run prescribed, clinical-grade patient therapeutics.

---

## 4. Unexpected Learnings & Clinical Friction Points

- **Physical SPL Calibration is Hard to Standardize**: While the $1\text{ kHz}$ reference tone and $G_{cal}$ gain multipliers are mathematically correct, they depend on participants accurately entering their headphone models or holding physical SPL meters. A participant with poor-fitting earbuds will still experience variable auditory levels, showing that software-only calibration cannot fully bypass physical acoustic environments.
- **Multi-Modal Biofeedback Latency is Variable**: Web Bluetooth and WebSerial introduce system-level buffer latencies ranging from $10\text{ ms}$ to $80\text{ ms}$. For high-frequency EEG/ECG tracking, this jitter is too high to perform tight phase-locked auditory pacing. The driver system is excellent for slow cardiovascular metrics (HRV/Breathing), but struggles with sub-millisecond neurofeedback.
- **The Human-Subjects Ethics Compliance Overhead**: Scaffolding the GDPR cascade shredding and Relative-Timestamp anonymizer took significant engineering resources. The clinical trial space requires a massive "defensive" architecture to handle data rights, which occasionally competed with synthesis DSP improvements.

---

## 5. The "I-Narrow" vs. "I-Wide" Scoping Decision

In v7, we made the strategic decision to scope AnnealMusic strictly as **I-narrow** (a pure research instrument and software infrastructure) rather than **I-wide** (a medical-claim therapeutic adjunct targeting FDA clearances).

### Did this decision hold up?

**Yes.** Staying I-narrow was our most successful risk mitigation. Attempting to pursue FDA class II medical device approvals would have:

- Imposed immense regulatory and documentation overhead that would have stalled synthesis innovation.
- Forced us to build complex HIPAA-certified patient databases rather than preserving our clean, zero-egress, anonymous-first design.
- Blocked the open-access Zenodo publish flows, as medical data must be heavily gated.

The I-narrow decision preserved our agility, enabling us to build an elegant, open, and reproducible research workspace.

---

## 6. Post-v7 Thesis Space: Moving Toward v8

With the closeout of the v7 research-collaboration arc, we face several compelling candidates for the next major development phase (v8):

- **Thesis A: Instrument Company (Hardware)**: Bridging our software engine with physical Eurorack, MIDI 2.0, MPE, and custom high-fidelity physical controllers.
- **Thesis C: Performance Platform**: Building shared ambient streaming, collaborative synthesis channels, and online listening rooms.
- **Thesis E: Platform (User-Uploaded Engines)**: Expanding our core to allow developers to upload custom audio worklet synthesis models.
- **Thesis L: Accessibility-First Audio**: Completely redesigning the interface from the ground up to prioritize blind and visually impaired creators, moving accessibility from a supplementary guide to the central core.
- **v7-Specific Candidate: Federated Research Network**: Implementing multi-site study coordination, decentralized cohort synchronization, and secure, cross-site replicate verifications without centralizing patient data.
