# AnnealMusic Session Datalogging Guide (v1.0)

AnnealMusic v5.3 implements client-side, high-resolution session datalogging to standard scientific data formats (**JSONL**, **CSV**, **HDF5**, **Parquet**). This utility enables researchers in acoustics, cognitive science, music information retrieval (MIR), and generative audio to ingest session logs directly into data science environments (Pandas, NumPy, MATLAB, R, Julia) for downstream statistical analysis and audit.

---

## 1. Stable Schema Definition (v1.0)

Every datalog record captures the complete state of the audio context and parameters. The datalog schema version is versioned as `1.0` and will remain stable indefinitely.

### Datalog Fields Table

| Field                   | JSON Path                   | Data Type      | Description                                                                         |
| ----------------------- | --------------------------- | -------------- | ----------------------------------------------------------------------------------- |
| **Timestamp**           | `timestamp`                 | Float          | Precise time in seconds since the session started (`AudioContext.currentTime`).     |
| **Wall Time**           | `wallTime`                  | String         | ISO 8601 UTC timestamp of the real-world sample clock.                              |
| **Carrier Frequency**   | `params.rootFreq`           | Float          | Fundamental frequency $f_0$ of the active synthesizer carrier (Hz).                 |
| **Spectral Spread**     | `params.spread`             | Float          | Harmonics detune spread multiplier range (-1..1).                                   |
| **Partial Density**     | `params.density`            | Float          | Density parameter regulating the number of active partials (1..32).                 |
| **Drift Coupling**      | `params.coupling`           | Float          | Kuramoto phase coupling strength $K \in [0, 1]$.                                    |
| **Drift Rate**          | `params.drift`              | Float          | Speed of the individual detuning random-walks (0..1).                               |
| **Brightness**          | `params.brightness`         | Float          | Mapped low-pass filter cutoff scalar multiplier (0..1).                             |
| **Space**               | `params.space`              | Float          | Convolver dry/wet spatialization mix level (0..1).                                  |
| **Volume**              | `params.volume`             | Float          | Master channel output volume level (0..1).                                          |
| **Synthesizer Engine**  | `metadata.engineId`         | String         | Selector of active voice synthesis generator (e.g. `'sine'`, `'granular'`).         |
| **Mean Detune**         | `drift.meanDetune`          | Float          | Average detuning of all partials (in cents).                                        |
| **Order Parameter**     | `drift.orderParameter`      | Float          | Phase coherence order parameter $r(t) \in [0, 1]$ (Kuramoto synchronization index). |
| **Drift Partials**      | `drift.partials`            | Array[Float]   | Per-partial current detune offset value (in cents).                                 |
| **Partial Frequencies** | `partials.frequencies`      | Array[Float]   | Per-partial current absolute frequency (in Hz).                                     |
| **Partial Amplitudes**  | `partials.amplitudes`       | Array[Float]   | Per-partial current linear gain amplitude.                                          |
| **RMS Amplitude**       | `features.rms`              | Float          | Root-mean-square amplitude of final output block (0..1).                            |
| **Spectral Centroid**   | `features.spectralCentroid` | Float          | Center of mass of the power spectrum (Hz) representing brightness.                  |
| **Spectral Flux**       | `features.spectralFlux`     | Float          | Magnitude spectrum Euclidean change relative to the previous frame.                 |
| **Zero Crossing Rate**  | `features.zcr`              | Float          | Rate at which the audio block crosses 0 (frequency/noise marker).                   |
| **FFT Spectrum**        | `features.spectrum`         | Array[Float]   | Optional: 512-bin magnitude spectrum frame (in dB).                                 |
| **Raw Block**           | `audioChunk`                | Array[Float]   | Optional: 1024-sample raw float mono output block (Research-Extreme only).          |
| **Event Flag**          | `event`                     | String \| null | Status event markers (`'session-start'`, `'engine-swap'`, `'session-stop'`).        |

---

## 2. Ingestion Recipes

### Python / Pandas & NumPy

Pandas natively supports reading JSONL using `read_json` with `lines=True`. Nested JSON parameters can be parsed losslessly:

```python
import pandas as pd
import json

# 1. Ingest JSONL losslessly
df = pd.read_json("session_log.jsonl", lines=True)

# Clean out the header and footer records
df_clean = df[df['type'].isna() & df['timestamp'].notna()].copy()

# 2. Ingest Parquet
df_parquet = pd.read_parquet("session_log.parquet")

# 3. Ingest HDF5
df_hdf5 = pd.read_hdf("session_log.h5", key="datalog")

# Parse stringified lists (e.g. partial frequencies) back to numerical lists
df_parquet['partials.frequencies'] = df_parquet['partials.frequencies'].apply(json.loads)
```

### MATLAB

Ingest flat CSV rows or read Parquet/JSONL directly:

```matlab
% Ingest tabular CSV data
opts = detectImportOptions('session_log.csv');
opts.VariableNamingRule = 'preserve';
data = readtable('session_log.csv', opts);

% Plot the Kuramoto Phase Coherence over time
plot(data.timestamp, data.("drift.orderParameter"), 'LineWidth', 1.5);
xlabel('Time (s)');
ylabel('Order Parameter r(t)');
title('Emergent Phase Synchronization');
grid on;
```

### R

Use `jsonlite` for JSONL loading and `arrow` for Parquet files:

```R
library(jsonlite)
library(ggplot2)

# Load JSONL records
lines <- readLines("session_log.jsonl")
clean_lines <- lines[!grepl('"type":"header"', lines) & !grepl('"type":"footer"', lines)]
records <- stream_in(textConnection(clean_lines))

# Plot RMS and Spectral Centroid
ggplot(records, aes(x = timestamp)) +
  geom_line(aes(y = features$rms, color = "RMS")) +
  geom_line(aes(y = features$spectralCentroid / 5000, color = "Centroid (scaled)")) +
  labs(title = "Real-Time Audio Feature Extraction", x = "Time (s)", y = "Value")
```

### Julia

```julia
using JSON3
using DataFrames
using Plots

# Read JSONL line-by-line
records = []
open("session_log.jsonl") do f
    for line in eachline(f)
        obj = JSON3.read(line)
        if !haskey(obj, :type)
            push!(records, obj)
        end
    end
end

df = DataFrame(records)
plot(df.timestamp, df.params.brightness, label="Brightness", lw=2)
```

---

## 3. Privacy & Compliance

- **100% Client-Side:** Datalogging is written locally to temporary memory in the browser or directly to files in offline renders. No telemetry or practice timing data is ever transmitted to AnnealMusic servers.
- **Academic Citation:** When using datalogs for perceptual studies, cognitive research, or acoustics audits, please reference:
  > Karlin, Avery. _AnnealMusic: Emergent Kuramoto Oscillator Physics and Generative Synthesis Systems._ v5.3 (2026).
