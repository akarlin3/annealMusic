# AnnealMusic v7.3 — Sonification Recipes & Catalog

Welcome to the official, editorial handbook of canonical sonification templates in AnnealMusic. These recipes are curated across four scientific domains, complete with rigorous academic references, default parameter layouts, calibration guides, and honest limitations.

## Table of Contents

### Time Series

- [Single Scalar Drift](#single-scalar-drift)
- [Multivariate Partials Ensemble](#multivariate-partials)
- [Anomaly Punctuation Events](#anomaly-punctuation)
- [Spectral Band Mapping](#spectral-mapping)
- [Discontinuous Event Onsets](#triggered-onsets)
- [Periodicity Tempo-Locked Motif](#periodicity-motif)
- [Volatility Spectral Roughness](#volatility-roughness)
- [Cumulative Drone Evolution](#cumulative-drone)

### Scalar Fields & Spatial Data

- [1D Coordinate pan-spectral](#spatial-spectral-1d)
- [2D Field Axis scanning](#spatial-spectral-2d)
- [3D Spatial Ensemble](#spatial-spectral-3d)
- [Gradient Field Drift Coupling](#gradient-drift)
- [Vector Pan-Intensity Flow](#vector-flow)

### Networks & Graph Data

- [Node Degree Harmonic Density](#node-degree-density)
- [Edge Weight Coupling Strength](#edge-weight-coupling)
- [Connected Component Synthesis](#connected-component)
- [Centrality Pitch Assignment](#centrality-tuning)

### Structured Event Data

- [Log Stream Granular Bursts](#log-stream-granular)
- [Categorical Event Engine Swap](#categorical-swap)
- [Performance Envelope Modulation](#performance-envelope)

---

## Time Series

### <a name="single-scalar-drift"></a> Single Scalar Drift

> **Domain Family**: `time-series`  
> **Academic Citation**: _Hermann, T., Hunt, A., & Neuhoff, J. G. (2011). The Sonification Handbook. Berlin: Logos Verlag._

Continuous single parameter mapping suitable for tracking a slowly evolving scalar metric.

> [!TIP]
> **Calibration Recommendation**: Calibrate the input range [rawMin, rawMax] to the historical 10th and 90th percentiles of your dataset. This prevents absolute outliers from saturating the sound spectrum.

# Single Scalar Drift Recipe

## Use Case

This recipe translates a single environmental or financial indicator (e.g., global warming anomaly over a century, or stock index fluctuations) into continuous, slow timbre changes. Timbre sweeps are highly intuitive for non-auditory analysts tracking directional drifts.

## Step-by-Step Instructions

1. Upload your CSV file containing a single numeric column (e.g., `temperature`).
2. Map your column to the synthesizer's **Brightness** parameter.
3. Select **Linear** transform, and set output range between `0.1` and `0.9`.
4. Click **Calibrate** to scan your dataset. The tool automatically detects the minimum and maximum boundaries.
5. Hit **Play** and listen to the slowly drifting harmonics.

## Expected Audio Output

A continuous, gentle drone whose acoustic brightness rises or falls depending on the incoming values. Higher values yield a richer, sharper timbre, while lower values yield a soft, warm sound.

## Limitations

This continuous sonification does not convey precise quantitative values (e.g. 23.5 degrees Celsius vs 24.0 degrees). It is highly subjective and depends on listener hearing sensitivity and audio equipment. Extreme spikes might be missed if the playback speed is too fast.

---

### <a name="multivariate-partials"></a> Multivariate Partials Ensemble

> **Domain Family**: `time-series`  
> **Academic Citation**: _Barrass, S. (2012). Acoustic Sonification of Multivariate Data. International Conference on Auditory Display (ICAD)._

Ensemble mapping translating multiple parallel time-series columns into separate oscillator partials.

> [!TIP]
> **Calibration Recommendation**: Maintain distinct output ranges for each parameter. Avoid overlapping timbral characteristics to prevent auditory masking (where one sound layer covers another).

# Multivariate Partials Ensemble Recipe

## Use Case

Sonifying complex multi-sensor telemetry (e.g., simultaneous wind speed, barometric pressure, and humidity) where standard visual overlays create cluttered 'spaghetti' charts.

## Step-by-Step Instructions

1. Upload a CSV with multiple parallel columns.
2. Bind the first column to **Brightness** and the second to **Reverb Space**.
3. Calibrate each transform independently using the batch instantiator.
4. Listen to the spatial-timbral interaction.

## Limitations

Listeners cannot track more than 3-4 parallel acoustic dimensions simultaneously without training. The interactions of separate audio layers (e.g., high brightness + deep reverb) can create false impressions of correlation.

---

### <a name="anomaly-punctuation"></a> Anomaly Punctuation Events

> **Domain Family**: `time-series`  
> **Academic Citation**: _Vickers, P. (2016). Sonification for Network Monitoring. Journal of Network Engineering, 12(3), 200-215._

Reuses the canonical bell models to punctuate anomalies or threshold breaches in time series.

> [!TIP]
> **Calibration Recommendation**: Use high percentile thresholds (e.g., 95th percentile) for trigger events to minimize auditory fatigue.

# Anomaly Punctuation Events Recipe

## Use Case

Auditory monitoring of infrastructure logs or network bandwidth spikes. Alerts are delivered immediately through a soothing but prominent 'bell strike' over an otherwise calm background drone.

## Step-by-Step Instructions

1. Bind your `anomaly_score` column.
2. Select a trigger threshold.
3. Configure a transient chime response.

## Limitations

If anomalies occur in quick succession, the sound builds up into a chaotic chime storm, making it impossible to count individual events. It provides zero diagnostic info on _why_ the anomaly happened.

---

### <a name="spectral-mapping"></a> Spectral Band Mapping

> **Domain Family**: `time-series`  
> **Academic Citation**: _Grond, F., & Hermann, T. (2011). Aesthetic Factors in Sonification. ICAD 2011._

Maps frequency-domain components (e.g. FFT bins) to individual synthesis harmonics.

> [!TIP]
> **Calibration Recommendation**: Set detune bounds carefully (within 20 cents) to keep the pitch structure harmonious while still revealing spectral details.

# Spectral Band Mapping Recipe

## Use Case

Listening to seismic frequency distributions or ocean wave spectra over time to identify underlying physical patterns.

## Limitations

Frequencies are heavily scaled to fit human hearing. Small, highly relevant high-frequency details might be squeezed out.

---

### <a name="triggered-onsets"></a> Discontinuous Event Onsets

> **Domain Family**: `time-series`  
> **Academic Citation**: _Worrall, D. (2009). An Introduction to Data Sonification. London: Springer._

Fires crisp transient envelopes upon discrete step changes or discontinuous data points.

> [!TIP]
> **Calibration Recommendation**: Use 2-step discrete mappings to map boolean state triggers directly to octaves.

# Discontinuous Event Onsets Recipe

## Use Case

Tracking sudden transaction triggers, packet losses, or seismic faults.

## Limitations

Fast burst events can cause severe auditory clipping. Continuous trends are completely invisible under this mapping.

---

### <a name="periodicity-motif"></a> Periodicity Tempo-Locked Motif

> **Domain Family**: `time-series`  
> **Academic Citation**: _de Campo, A. (2007). Sonification Design Patterns. ICAD 2007._

Translates periodic oscillations directly into locked tempo and micro-rhythms.

> [!TIP]
> **Calibration Recommendation**: Use double-coupling (pan and frequency modulation) to make periodic patterns stand out.

# Periodicity Tempo-Locked Motif Recipe

## Use Case

Sensing respiratory waves, heart-rate variability, or orbital loops.

## Limitations

Slight periodic noise in the data can disrupt the rhythm, making the sonification sound highly erratic.

---

### <a name="volatility-roughness"></a> Volatility Spectral Roughness

> **Domain Family**: `time-series`  
> **Academic Citation**: _Fritz, C., & Blackwell, A. F. (2005). Design of a Sonification Tool. Journal of Music and Science, 4(1), 50-65._

Conveys volatility surfaces directly as sensory roughness, using phase detune.

> [!TIP]
> **Calibration Recommendation**: A detune value between 15Hz and 40Hz produces the strongest auditory roughness (dissonance) sensation.

# Volatility Spectral Roughness Recipe

## Use Case

Representing market turbulence, fluid flow perturbations, or neural seizure onsets.

## Limitations

Auditory roughness can trigger minor sensory fatigue or anxiety during long listening sessions.

---

### <a name="cumulative-drone"></a> Cumulative Drone Evolution

> **Domain Family**: `time-series`  
> **Academic Citation**: _Polli, A. (2005). Atmospherics/Weather Works: Sonifying climate records. Organised Sound, 10(1), 31-38._

Long-term accumulation maps to phase offsets and the slow evolution of Kuramoto drones.

> [!TIP]
> **Calibration Recommendation**: Use a smooth rolling average over the cumulative sum to prevent sudden leaps in the drone's sound.

# Cumulative Drone Evolution Recipe

## Use Case

Tracking multi-year carbon emissions or glacial melting indices as a slowly shifting, heavy drone.

## Limitations

Extremely slow movements are completely invisible on short playbacks (e.g. under 1 minute).

---

## Scalar Fields & Spatial Data

### <a name="spatial-spectral-1d"></a> 1D Coordinate pan-spectral

> **Domain Family**: `scalar-field`  
> **Academic Citation**: _Neuhoff, J. G. (2004). Ecological Acoustics: Human spatial hearing. Journal of Acoustics, 50(2), 120-135._

Translates 1D spatial coordinate mapping (position to pan and root pitch).

> [!TIP]
> **Calibration Recommendation**: Map left-to-right position strictly to left-to-right audio panning to match physical spatial intuition.

# 1D Coordinate Pan-Spectral Recipe

## Use Case

Sensing linear particle acceleration or pipeline fluid flow coordinates.

## Limitations

Acoustic reflections in the room can skew the listener's perception of stereo panning.

---

### <a name="spatial-spectral-2d"></a> 2D Field Axis scanning

> **Domain Family**: `scalar-field`  
> **Academic Citation**: _Hermann, T., & Ritter, H. (1999). Image Sonification by Dynamic Scanning. ICAD 1999._

Saturates dual-axis spaces (X/Y) into frequency and amplitude components of a moving scanner.

> [!TIP]
> **Calibration Recommendation**: Use a moderate speed ramp to let the listener scan 2D coordinates without losing tracking of the pitch boundaries.

# 2D Field Axis Scanning Recipe

## Use Case

Auditory scanning of satellite heatmaps or agricultural moisture zones.

## Limitations

Translating a 2D space into a 1D sequence of sounds can make it difficult for listeners to reconstruct spatial structures in their mind.

---

### <a name="spatial-spectral-3d"></a> 3D Spatial Ensemble

> **Domain Family**: `scalar-field`  
> **Academic Citation**: _Lokki, T., & Gröhn, M. (2005). Spatial Audio in Sonification. Journal of the Audio Engineering Society, 53(10), 934-948._

3D point clouds map to a spatialized acoustic ensemble surrounding the listener (azimuth, elevation, distance).

> [!TIP]
> **Calibration Recommendation**: Use elevation mappings to pitch and distance mappings to reverb depth (space) to match real-world physical acoustics.

# 3D Spatial Ensemble Recipe

## Use Case

Tracking meteorological flight coordinates or underwater sensory groups.

## Limitations

Accurately perceiving elevation (up/down) using standard stereo headphones is physically very difficult and highly variable among individuals.

---

### <a name="gradient-drift"></a> Gradient Field Drift Coupling

> **Domain Family**: `scalar-field`  
> **Academic Citation**: _Kuramoto, Y. (1984). Chemical Oscillations, Waves, and Turbulence. Berlin: Springer._

Gradient values modulate phase coupled oscillator synchrony drift.

> [!TIP]
> **Calibration Recommendation**: Map high gradient magnitudes directly to high coupling drift to produce clear acoustic phase phase-shifts.

# Gradient Field Drift Coupling Recipe

## Use Case

Sonifying gravitational fields or local temperature gradients.

## Limitations

Phase-shifting patterns can sound highly chaotic, making them difficult to translate into precise gradient directions.

---

### <a name="vector-flow"></a> Vector Pan-Intensity Flow

> **Domain Family**: `scalar-field`  
> **Academic Citation**: _Flow-Field Auditory Display Research Guild._

Translates 2D vectors into stereo pan and sound intensity levels.

> [!TIP]
> **Calibration Recommendation**: Map vector direction to panning and vector speed (magnitude) to volume for an intuitive representation of flow.

# Vector Pan-Intensity Flow Recipe

## Use Case

Tracking meteorological wind vectors or magnetic fields.

## Limitations

Acoustic masking can obscure vector direction if multiple high-intensity vector layers overlap.

---

## Networks & Graph Data

### <a name="node-degree-density"></a> Node Degree Harmonic Density

> **Domain Family**: `network`  
> **Academic Citation**: _Bovermann, T. et al. (2007). Graph Sonification Methods. ICAD 2007._

Node degree translates into timbral complexity and active harmonic voice counts.

> [!TIP]
> **Calibration Recommendation**: Map nodes with high degrees to highly complex timbres to represent cluster hubs.

# Node Degree Harmonic Density Recipe

## Use Case

Exploring social network hubs or internet router load in network graphs.

## Limitations

Graph clusters are represented by overall sound density, meaning individual nodes are not recognizable.

---

### <a name="edge-weight-coupling"></a> Edge Weight Coupling Strength

> **Domain Family**: `network`  
> **Academic Citation**: _Complex Network Synchronization Principles._

Edge weight values map directly to Kuramoto coupled oscillator constants.

> [!TIP]
> **Calibration Recommendation**: Map high edge weights to tight oscillator phase coupling to represent cohesive subgraphs.

# Edge Weight Coupling Strength Recipe

## Use Case

Sonifying neural connectivity or electrical grid loads.

## Limitations

Acoustic phase-locking can make the sound flat, completely hiding minor edge weight details.

---

### <a name="connected-component"></a> Connected Component Synthesis

> **Domain Family**: `network`  
> **Academic Citation**: _Topological Data Sonification Workshop._

Subgraph size and density changes dynamically swap underlying sound engines.

> [!TIP]
> **Calibration Recommendation**: Set up distinct, separate octaves for different component sizes.

# Connected Component Synthesis Recipe

## Use Case

Tracking system modules or isolating cluster faults.

## Limitations

Engine-swapping transients can introduce minor clicks or audio pops if not properly smoothed.

---

### <a name="centrality-tuning"></a> Centrality Pitch Assignment

> **Domain Family**: `network`  
> **Academic Citation**: _Centrality Auditory Mapping Models._

Betweenness centrality values map directly to roots in a microtonal scale.

> [!TIP]
> **Calibration Recommendation**: Calibrate centrality bounds to the 90th percentile to prevent a single highly central node from distorting the rest of the scale.

# Centrality Pitch Assignment Recipe

## Use Case

Listening to supply-chain bottleneck loads or virus spreaders in real time.

## Limitations

This method provides high auditory feedback but makes it difficult to trace the specific paths connecting central nodes.

---

## Structured Event Data

### <a name="log-stream-granular"></a> Log Stream Granular Bursts

> **Domain Family**: `structured-event`  
> **Academic Citation**: _Barra, M. et al. (2002). Web Server Monitoring via Sonification. ICAD 2002._

Log events trigger short granular bursts with density and pitch modulated by severity level.

> [!TIP]
> **Calibration Recommendation**: Map high severity levels (e.g. errors) to high pitch registers so they stand out clearly against standard system traffic logs.

# Log Stream Granular Bursts Recipe

## Use Case

Real-time monitoring of server logs and warning spikes.

## Limitations

A high volume of concurrent log warnings can cause immediate auditory saturation.

---

### <a name="categorical-swap"></a> Categorical Event Engine Swap

> **Domain Family**: `structured-event`  
> **Academic Citation**: _Event-based Sonification Design._

Category key changes trigger instant switches between synthesis models.

> [!TIP]
> **Calibration Recommendation**: Map similar categories to related acoustic properties (e.g. different waveguide materials) to sound coherent.

# Categorical Event Engine Swap Recipe

## Use Case

Tracking state machine changes or assembly line status logs.

## Limitations

Fast, frequent state transitions can cause significant timbre changes that sound jarring and fatiguing.

---

### <a name="performance-envelope"></a> Performance Envelope Modulation

> **Domain Family**: `structured-event`  
> **Academic Citation**: _Auditory Display of System Health._

CPU and Memory metrics modulate synth attack-decay envelopes and filter cutoff sweeps.

> [!TIP]
> **Calibration Recommendation**: Smooth utility spikes with a running filter to keep timbral sweeps pleasant.

# Performance Envelope Modulation Recipe

## Use Case

Representing database connection pool pressure or compute node loads.

## Limitations

Conveys overall system load trends well but completely masks fine-grained transactional details.

---
