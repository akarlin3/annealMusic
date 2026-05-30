# Perceptual Experiment Framework Reference

This reference outlines the architectural timing characteristics, Institutional Review Board (IRB) sandboxing, and file export schema for **AnnealMusic v5.6's Perceptual Experimentation Framework**, a specialized tool for music cognition and Music Information Retrieval (MIR) research.

---

## 1. Timing Precision Characteristics

Psychoacoustic and cognitive behavioral studies require robust audio-stimulus scheduling. The AnnealMusic runner employs a dual-thread paradigm to maximize scheduling accuracy:

### Stimulus Audio Scheduling

- **Web Audio Context:** Stimulus playbacks are scheduled directly on the browser's high-priority `AudioContext.currentTime` thread. This guarantees **sub-millisecond onset and offset jitter** for audio synthesis and DSP execution.
- **Synthesizer Injection:** Synthetic state parameters (e.g., coupling coefficients, frequency parameters, voice density) are injected synchronously into the synthesizer voice thread immediately prior to voice execution.
- **Performance Optimization:** By default, visual rendering animations (FFT spectrums, Kuramoto coupling visualizers) are **deactivated during active participant trials** to eliminate main-thread rendering bottlenecks and maximize scheduling stability, unless the stimulus configuration explicitly sets `"visualizer": true`.

### Behavioral Event Log Latency

- **Event Jitter:** Unlike AudioContext thread scheduling, behavioral interaction logs (key presses for reaction times, mouse drags for continuous value adjustments) are processed on the browser's main JavaScript UI thread.
- **Main Thread Jitter:** Due to event-loop cycles, layout reflows, and input parsing, behavioral reaction times have an expected latency jitter of **5ms to 15ms**.
- **Usage Recommendation:** AnnealMusic is highly suited for behavioral rating scales, matching paradigms, and reaction time studies. However, due to browser event loop constraints, it is **NOT** recommended as a millisecond-accurate trigger for EEG, MEG, or fMRI synchronization without an external hardware audio-to-trigger interface.

---

## 2. Institutional Review Board (IRB) & Privacy Protocol

AnnealMusic operates under a **strictly sandboxed, zero-data-processor architectural model** to simplify IRB approval, GDPR compliance, and participant anonymity.

### IRB Safeguards:

1. **Explicit Consent Gatekeeping:** Participant trials will not initialize unless the participant explicitly clicks the verification check on the Consent Screen.
2. **Permanent Withdraw-and-Wipe:** A persistent "Withdraw" option is visible throughout the runner. Activating it stops the audio context immediately, clears all stored trial response variables, and purges memory structures to ensure zero residue remains.
3. **Anonymity by Default:** No cookies, cookies-tracking, IP parsing, or fingerprinting scripts are injected. Participant identities rely on temporary UUIDs or researcher-supplied parameters (e.g., `?subId=PRO123`).
4. **Data Transmission Transparency:** Before submitting an HTTP POST request to a lab server, the runner displays an itemized view of every single byte of data to be transmitted.

---

## 3. Data Export Schema Reference

When a participant completes a session, they can download an uncompressed ZIP file containing three files:

### 1. `manifest.json`

Contains overall metadata, the exact experiment Python-compiled definition, and participant intake demographics.

```json
{
  "experiment_title": "Dyad Consonance Perception Study",
  "experiment_description": "A scientific study of consonance vs dissonance.",
  "subject_id": "sub-x9f2a41b",
  "timestamp": "2026-05-30T02:30:15.123Z",
  "anneal_music_version": "5.7.0",
  "schema_version": "v20",
  "demographics": {
    "age": 24,
    "musical_experience": "6 years"
  },
  "definition": { ... }
}
```

### 2. `responses.csv`

A comma-separated mapping of behavioral responses, trial orders, and reaction times:

```csv
subject_id,trial_index,stimulus_id,response_type,response_value,rt_ms,timestamp
sub-x9f2a41b,0,perfect_fifth,LikertResponse,6,1240.5,2026-05-30T02:31:02.100Z
sub-x9f2a41b,1,tritone,LikertResponse,2,1980.2,2026-05-30T02:31:07.450Z
```

### 3. `datalogger.jsonl`

A JSON-Lines formatted stream logging continuous DSP parameter states and FFT-derived acoustic telemetry from the synthesizer at `30Hz` over active playbacks:

```json
{"trial_index":0,"stimulus_id":"perfect_fifth","timestamp":0.033,"features":{"rms":0.45,"spectralCentroid":840.2,"spectralFlux":12.4},"drift":{"orderParameter":0.92}}
{"trial_index":0,"stimulus_id":"perfect_fifth","timestamp":0.066,"features":{"rms":0.47,"spectralCentroid":839.8,"spectralFlux":10.1},"drift":{"orderParameter":0.94}}
```
