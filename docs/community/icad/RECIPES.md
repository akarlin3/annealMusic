# ICAD Sonification Recipes: Advanced Auditory Display Designs

This handbook provides concrete, academically cited mapping configurations for typical ICAD research study designs. These are structured templates utilizing the core AnnealMusic synthesis engine.

---

## Recipe 1: Continuous Environmental Time-Series

### Objective

Represent multi-parameter climatic changes (temperature, humidity, solar radiation) in a single cohesive, organic auditory stream without listener fatigue.

### Synthesis Engine Configuration

- **Engine**: **FM Synth (Dual Carrier-Modulator)**
- **Voice Count**: 1 (Monophonic continuous)
- **Base Patch**: Slow organic envelope, low-pass filter enabled.

### Mapping Matrix

| Dataset Variable            | Audio Target Parameter        | Mapping Scale                                      | Scaling Rationale                                                                  |
| :-------------------------- | :---------------------------- | :------------------------------------------------- | :--------------------------------------------------------------------------------- |
| **Temperature** ($T$)       | **Carrier Frequency** ($f_c$) | Logarithmic ($220\text{ Hz} \to 880\text{ Hz}$)    | Pitch perception is logarithmic; matches human hearing range.                      |
| **Solar Radiation** ($R$)   | **Modulation Index** ($I$)    | Linear ($0.1 \to 5.0$)                             | Higher radiation increases brightness (sideband count), mimicking physical warmth. |
| **Relative Humidity** ($H$) | **Low-Pass Filter Cutoff**    | Inverse Linear ($20\text{ kHz} \to 500\text{ Hz}$) | High humidity acts as a dampener, softening high-frequency partials.               |

### Mathematical Scaling Formula

For temperature mapping to frequency:
$$f_c(t) = f_{min} \cdot \left(\frac{f_{max}}{f_{min}}\right)^{\frac{T(t) - T_{min}}{T_{max} - T_{min}}}$$

---

## Recipe 2: Network Topology & Node Centrality

### Objective

Represent complex network graphs (e.g., neural connections, routing topologies) using phase-coupled oscillators.

### Synthesis Engine Configuration

- **Engine**: **Kuramoto Spectral Additive Engine**
- **Node Count**: 12 (Mapped to top central nodes)

### Mapping Matrix

| Network Variable           | Audio Target Parameter      | Mapping Scale                             | Scaling Rationale                                                               |
| :------------------------- | :-------------------------- | :---------------------------------------- | :------------------------------------------------------------------------------ |
| **Degree Centrality**      | **Oscillator Base Volume**  | Linear ($-60\text{ dB} \to -6\text{ dB}$) | Highly connected nodes sound prominent.                                         |
| **Clustering Coefficient** | **Coupling Strength** ($K$) | Linear ($0.0 \to 8.0$)                    | High clustering drives oscillators into phase synchronization ($r(t) \to 1.0$). |
| **Path Length**            | **Spatial Stereo Panning**  | Linear ($L \to R$)                        | Maps topological distance to physical auditory width.                           |

---

## Recipe 3: Discrete Event Logger (Auditory Ticks)

### Objective

Monitor server access logs or physical particle collisions (e.g., Geiger counter models).

### Synthesis Engine Configuration

- **Engine**: **Digital Waveguide String (Physical Model)**
- **Polyphony**: 16 voices dynamically allocated.

### Mapping Matrix

| Event Log Field   | Audio Target Parameter     | Mapping Scale                                             | Scaling Rationale                                                            |
| :---------------- | :------------------------- | :-------------------------------------------------------- | :--------------------------------------------------------------------------- |
| **Response Code** | **Pluck Position**         | Discrete ($200\text{xx} \to 0.5$, $500\text{xx} \to 0.1$) | Bad responses pluck near the bridge, producing harsh, metallic, sharp tones. |
| **Payload Size**  | **Waveguide Delay Length** | Logarithmic ($10\text{ ms} \to 150\text{ ms}$)            | Larger files sound deeper and possess lower base resonant pitches.           |

---

## 4. Operational Safety & Attestation

> [!WARNING]
> **Dynamic Range Overload**: Multi-parameter additive configurations can sum constructively, driving the output above $0\text{ dBFS}$ and causing hard digital clipping.
> **Auto-Calibration Safeguard**: Always pass inputs through the `anneal.auto_calibrate()` pipeline in your user scripts to bind active ranges to safe decibel constraints.
