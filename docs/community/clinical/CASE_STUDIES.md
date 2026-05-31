# Clinical Case Studies: Auditory Interventions & Music Cognition

This document outlines realistic, anonymized, and hypothetical case studies showing how clinical investigators and music cognition labs have utilized AnnealMusic to conduct human-subject experiments.

---

## Case Study 1: Biofeedback-Driven Respiratory Pacing (HRV/Breath)

### Clinical Objective

An autonomic neuroscience lab sought to evaluate whether a dynamic, real-time auditory pacing stimulus could entrain breathing rates, thereby maximizing heart rate variability (HRV) and mitigating acute anxiety.

### Methodology & Stimulus Setup

- **Cohort**: 40 healthy adult participants.
- **Hardware Ingestion**: Polar H10 chest straps paired via the **Web Bluetooth BLE Bridge** directly to the participant console.
- **Synthesizer Pacing**: Mapped the participant's respiratory rate baseline to a breathing synth voice:
  - Inhalation: Rising frequency sweep with a soft ambient pad.
  - Exhalation: Slow decay noise simulating the sound of ocean waves.
- **Real-Time Calibration**: A resting 2-minute baseline calibration wizard calculated each participant's resting SDNN (HRV constant) to scale the dynamic filter sweep range.

### Results & Safety Compliance

No adverse events were logged. Two participants exercised their GDPR rights to withdraw mid-session. The console immediately stopped playback, and their records were completely and permanently shredded from the server. The final study showed that biofeedback-driven pacing achieved higher respiratory entrainment indexes compared to static, non-adaptive auditory guides.

---

## Case Study 2: Auditory Fatigue in Continuous Ambient Environments

### Clinical Objective

A music cognition lab investigated the physiological and cognitive limits of continuous, generative synthesizer exposure (specifically looking for symptoms of auditory fatigue, headaches, or focus shifts over 60-minute listening sessions).

### Methodology & Stimulus Setup

- **Cohort**: 25 participants.
- **Counterbalancing**: DETERMINISTIC Williams Latin Square Counterbalancing distributed participants across three conditions (Continuous FM Synthesis, Phase-Coupled Spectral Synthesis, and Silent Control).
- **Physical Level Calibration**: Headphones were calibrated individually using a physical SPL meter to ensure stimulus delivery was locked at exactly $62\text{ dBA}$ for every participant.
- **Cognitive Measures**: Continuous response-latency tasks were scheduled via Web Audio thread clocks, capturing keypress reaction times accurate to $\pm 1.2\text{ ms}$.

### Results & Safety Compliance

Three participants triggered the **Adverse Event Overlay**, reporting mild hearing strain and headaches. The system immediately recorded the exact millisecond offset of their triggers, halted all audio, and generated a safe exit survey. The remaining cohort data was exported as a reproducible study ZIP, with Laplace differential privacy noise ($\epsilon = 0.5$) applied to protect individual reaction times prior to public archival on Zenodo.
