# ICAD Sonification Case Studies: Real-World Applications

This document showcases anonymized and realistic case studies demonstrating how researchers have deployed AnnealMusic to solve complex data interpretation challenges across diverse scientific disciplines.

---

## Case Study 1: Interplanetary Magnetosphere Fluctuations

### Research Context

A space physics research group sought to analyze magnetic field fluctuations in high-cadence solar wind data from deep-space probes. Visual line plots struggled to convey high-frequency micro-oscillations superimposed on slow directional sweeps.

### Methodology & Mapping

- **Data Source**: 3-axis fluxgate magnetometer readings.
- **Synthesis Engine**: Monophonic FM Synth Engine.
- **Mapping Spec**:
  - $B_x$ component (slow baseline change) $\to$ Carrier Frequency ($220\text{ Hz} \to 440\text{ Hz}$).
  - $B_y$ component (rapid fluctuations) $\to$ Modulation Frequency ratio.
  - $B_z$ amplitude (wave magnitude) $\to$ Modulation Index ($0.1 \to 6.0$).
- **Calibration**: Dynamic auto-calibration bounded all parameters within safe human-hearing comfort margins.

### Results & Impact

By listening to the sonification while reviewing the coordinate charts, the team recognized distinct acoustic "growling" textures corresponding to localized plasma turbulence. This auditory display design was published in the _Space Physics Journal_, with the interactive figure widget embedded in their open-access preprint.

---

## Case Study 2: Canopy Canopy Environmental Acoustics

### Research Context

An ecological monitoring project set up in a temperate rainforest wanted to present environmental dynamics (humidity, canopy temperature, wind patterns) to both visiting citizens and domain scientists.

### Methodology & Mapping

- **Data Source**: 24-hour micro-climatic sensor networks.
- **Synthesis Engine**: Digital Waveguide Physical String Engine + Ambient Pad.
- **Mapping Spec**:
  - Air Temperature $\to$ Pluck Pitch (higher temperature plucks higher strings).
  - Relative Humidity $\to$ Resonance Decay Time (dampened strings when humid).
  - Wind Speed $\to$ Pluck Frequency (higher winds increase temporal pluck density).
- **Haptic Feedback**: The installation incorporated local tactile seats that translated low-frequency resonance ticks directly to the listener using standard Capacitor-based device vibration API commands.

### Results & Impact

The display was hosted in a public gallery and run on-site for three months. Surveys showed that citizens easily developed intuitive understanding of rainforest patterns (hearing the "rainforest awaken" as wind and temperature increased in the early morning).

---

## Case Study 3: Cyber Security Threat Synchronization

### Research Context

A cyber security Operations Center looked to monitor aggregate denial-of-service (DoS) attempts across a global network routing hub in real time, bypassing visual alert fatigue.

### Methodology & Mapping

- **Data Source**: Live log streams (requests/sec, dropped packets, connection counts).
- **Synthesis Engine**: Spectral Additive Kuramoto Oscillator Engine (12 voices).
- **Mapping Spec**:
  - Connection Count $\to$ Individual Oscillator Frequency.
  - Dropped Packets $\to$ Global Coupling Coefficient ($K$).
  - When $K$ is low (normal traffic), the oscillators drift in independent, low-intensity, polyphonic ambient textures.
  - When dropped packets spike, the coupling coefficient automatically scales up, driving the oscillators into tight phase-locking ($r(t) \to 1.0$), producing a unified, rhythmic, high-amplitude chime.

### Results & Impact

SecOps analysts could go about their standard tasks with the low-volume background soundscape. The moment an attack began, the sudden, emergent phase synchronization instantly signaled the breach without forcing constant screen vigilance.
