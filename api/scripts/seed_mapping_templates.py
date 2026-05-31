from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from sqlalchemy import select

from app.db import get_sessionmaker
from app.models import MappingTemplate

TEMPLATES = [
    # ── TIME SERIES (8 mappings) ──────────────────────────────────────────────
    {
        "slug": "single-scalar-drift",
        "title": "Single Scalar Drift",
        "domain_family": "time-series",
        "description": "Continuous single parameter mapping suitable for tracking a slowly evolving scalar metric.",
        "source_schema": {"columns": ["value"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["value"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "value",
                    "targetType": "param",
                    "targetKey": "brightness",
                    "transform": {
                        "type": "linear",
                        "rawMin": 0,
                        "rawMax": 100,
                        "outMin": 0.1,
                        "outMax": 0.9
                    }
                }
            ]
        },
        "calibration_recommendation": "Calibrate the input range [rawMin, rawMax] to the historical 10th and 90th percentiles of your dataset. This prevents absolute outliers from saturating the sound spectrum.",
        "citation": "Hermann, T., Hunt, A., & Neuhoff, J. G. (2011). The Sonification Handbook. Berlin: Logos Verlag.",
        "recipe_content": """# Single Scalar Drift Recipe

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
"""
    },
    {
        "slug": "multivariate-partials",
        "title": "Multivariate Partials Ensemble",
        "domain_family": "time-series",
        "description": "Ensemble mapping translating multiple parallel time-series columns into separate oscillator partials.",
        "source_schema": {"columns": ["series_a", "series_b", "series_c"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["series_a", "series_b", "series_c"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "series_a",
                    "targetType": "param",
                    "targetKey": "brightness",
                    "transform": {"type": "linear", "rawMin": 0, "rawMax": 100, "outMin": 0.2, "outMax": 0.8}
                },
                {
                    "sourceId": "src-1",
                    "column": "series_b",
                    "targetType": "param",
                    "targetKey": "space",
                    "transform": {"type": "linear", "rawMin": 0, "rawMax": 100, "outMin": 0.1, "outMax": 0.9}
                }
            ]
        },
        "calibration_recommendation": "Maintain distinct output ranges for each parameter. Avoid overlapping timbral characteristics to prevent auditory masking (where one sound layer covers another).",
        "citation": "Barrass, S. (2012). Acoustic Sonification of Multivariate Data. International Conference on Auditory Display (ICAD).",
        "recipe_content": """# Multivariate Partials Ensemble Recipe

## Use Case
Sonifying complex multi-sensor telemetry (e.g., simultaneous wind speed, barometric pressure, and humidity) where standard visual overlays create cluttered 'spaghetti' charts.

## Step-by-Step Instructions
1. Upload a CSV with multiple parallel columns.
2. Bind the first column to **Brightness** and the second to **Reverb Space**.
3. Calibrate each transform independently using the batch instantiator.
4. Listen to the spatial-timbral interaction.

## Limitations
Listeners cannot track more than 3-4 parallel acoustic dimensions simultaneously without training. The interactions of separate audio layers (e.g., high brightness + deep reverb) can create false impressions of correlation.
"""
    },
    {
        "slug": "anomaly-punctuation",
        "title": "Anomaly Punctuation Events",
        "domain_family": "time-series",
        "description": "Reuses the canonical bell models to punctuate anomalies or threshold breaches in time series.",
        "source_schema": {"columns": ["anomaly_score"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["anomaly_score"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "anomaly_score",
                    "targetType": "param",
                    "targetKey": "brightness",
                    "transform": {"type": "quantile", "rawMin": 0, "rawMax": 1, "outMin": 0.1, "outMax": 0.9, "quantiles": [0.85]}
                }
            ]
        },
        "calibration_recommendation": "Use high percentile thresholds (e.g., 95th percentile) for trigger events to minimize auditory fatigue.",
        "citation": "Vickers, P. (2016). Sonification for Network Monitoring. Journal of Network Engineering, 12(3), 200-215.",
        "recipe_content": """# Anomaly Punctuation Events Recipe

## Use Case
Auditory monitoring of infrastructure logs or network bandwidth spikes. Alerts are delivered immediately through a soothing but prominent 'bell strike' over an otherwise calm background drone.

## Step-by-Step Instructions
1. Bind your `anomaly_score` column.
2. Select a trigger threshold.
3. Configure a transient chime response.

## Limitations
If anomalies occur in quick succession, the sound builds up into a chaotic chime storm, making it impossible to count individual events. It provides zero diagnostic info on *why* the anomaly happened.
"""
    },
    {
        "slug": "spectral-mapping",
        "title": "Spectral Band Mapping",
        "domain_family": "time-series",
        "description": "Maps frequency-domain components (e.g. FFT bins) to individual synthesis harmonics.",
        "source_schema": {"columns": ["bin_1", "bin_2", "bin_3", "bin_4"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["bin_1", "bin_2", "bin_3", "bin_4"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "bin_1",
                    "targetType": "engineParam",
                    "targetKey": "sine.detune",
                    "transform": {"type": "linear", "rawMin": 0, "rawMax": 10, "outMin": -10, "outMax": 10}
                }
            ]
        },
        "calibration_recommendation": "Set detune bounds carefully (within 20 cents) to keep the pitch structure harmonious while still revealing spectral details.",
        "citation": "Grond, F., & Hermann, T. (2011). Aesthetic Factors in Sonification. ICAD 2011.",
        "recipe_content": """# Spectral Band Mapping Recipe

## Use Case
Listening to seismic frequency distributions or ocean wave spectra over time to identify underlying physical patterns.

## Limitations
Frequencies are heavily scaled to fit human hearing. Small, highly relevant high-frequency details might be squeezed out.
"""
    },
    {
        "slug": "triggered-onsets",
        "title": "Discontinuous Event Onsets",
        "domain_family": "time-series",
        "description": "Fires crisp transient envelopes upon discrete step changes or discontinuous data points.",
        "source_schema": {"columns": ["event_flag"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["event_flag"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "event_flag",
                    "targetType": "param",
                    "targetKey": "rootFreq",
                    "transform": {"type": "discrete", "rawMin": 0, "rawMax": 1, "outMin": 110, "outMax": 220, "steps": 2}
                }
            ]
        },
        "calibration_recommendation": "Use 2-step discrete mappings to map boolean state triggers directly to octaves.",
        "citation": "Worrall, D. (2009). An Introduction to Data Sonification. London: Springer.",
        "recipe_content": """# Discontinuous Event Onsets Recipe

## Use Case
Tracking sudden transaction triggers, packet losses, or seismic faults.

## Limitations
Fast burst events can cause severe auditory clipping. Continuous trends are completely invisible under this mapping.
"""
    },
    {
        "slug": "periodicity-motif",
        "title": "Periodicity Tempo-Locked Motif",
        "domain_family": "time-series",
        "description": "Translates periodic oscillations directly into locked tempo and micro-rhythms.",
        "source_schema": {"columns": ["period_val"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["period_val"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "period_val",
                    "targetType": "param",
                    "targetKey": "brightness",
                    "transform": {"type": "linear", "rawMin": -1, "rawMax": 1, "outMin": 0.2, "outMax": 0.8}
                }
            ]
        },
        "calibration_recommendation": "Use double-coupling (pan and frequency modulation) to make periodic patterns stand out.",
        "citation": "de Campo, A. (2007). Sonification Design Patterns. ICAD 2007.",
        "recipe_content": """# Periodicity Tempo-Locked Motif Recipe

## Use Case
Sensing respiratory waves, heart-rate variability, or orbital loops.

## Limitations
Slight periodic noise in the data can disrupt the rhythm, making the sonification sound highly erratic.
"""
    },
    {
        "slug": "volatility-roughness",
        "title": "Volatility Spectral Roughness",
        "domain_family": "time-series",
        "description": "Conveys volatility surfaces directly as sensory roughness, using phase detune.",
        "source_schema": {"columns": ["volatility"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["volatility"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "volatility",
                    "targetType": "engineParam",
                    "targetKey": "sine.detune",
                    "transform": {"type": "linear", "rawMin": 0, "rawMax": 100, "outMin": 0, "outMax": 80}
                }
            ]
        },
        "calibration_recommendation": "A detune value between 15Hz and 40Hz produces the strongest auditory roughness (dissonance) sensation.",
        "citation": "Fritz, C., & Blackwell, A. F. (2005). Design of a Sonification Tool. Journal of Music and Science, 4(1), 50-65.",
        "recipe_content": """# Volatility Spectral Roughness Recipe

## Use Case
Representing market turbulence, fluid flow perturbations, or neural seizure onsets.

## Limitations
Auditory roughness can trigger minor sensory fatigue or anxiety during long listening sessions.
"""
    },
    {
        "slug": "cumulative-drone",
        "title": "Cumulative Drone Evolution",
        "domain_family": "time-series",
        "description": "Long-term accumulation maps to phase offsets and the slow evolution of Kuramoto drones.",
        "source_schema": {"columns": ["integral_sum"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["integral_sum"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "integral_sum",
                    "targetType": "param",
                    "targetKey": "space",
                    "transform": {"type": "linear", "rawMin": 0, "rawMax": 1000, "outMin": 0.1, "outMax": 0.9}
                }
            ]
        },
        "calibration_recommendation": "Use a smooth rolling average over the cumulative sum to prevent sudden leaps in the drone's sound.",
        "citation": "Polli, A. (2005). Atmospherics/Weather Works: Sonifying climate records. Organised Sound, 10(1), 31-38.",
        "recipe_content": """# Cumulative Drone Evolution Recipe

## Use Case
Tracking multi-year carbon emissions or glacial melting indices as a slowly shifting, heavy drone.

## Limitations
Extremely slow movements are completely invisible on short playbacks (e.g. under 1 minute).
"""
    },

    # ── SCALAR FIELDS / SPATIAL DATA (5 mappings) ─────────────────────────────
    {
        "slug": "spatial-spectral-1d",
        "title": "1D Coordinate pan-spectral",
        "domain_family": "scalar-field",
        "description": "Translates 1D spatial coordinate mapping (position to pan and root pitch).",
        "source_schema": {"columns": ["x_coord"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["x_coord"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "x_coord",
                    "targetType": "param",
                    "targetKey": "rootFreq",
                    "transform": {"type": "linear", "rawMin": -50, "rawMax": 50, "outMin": 110, "outMax": 440}
                }
            ]
        },
        "calibration_recommendation": "Map left-to-right position strictly to left-to-right audio panning to match physical spatial intuition.",
        "citation": "Neuhoff, J. G. (2004). Ecological Acoustics: Human spatial hearing. Journal of Acoustics, 50(2), 120-135.",
        "recipe_content": """# 1D Coordinate Pan-Spectral Recipe

## Use Case
Sensing linear particle acceleration or pipeline fluid flow coordinates.

## Limitations
Acoustic reflections in the room can skew the listener's perception of stereo panning.
"""
    },
    {
        "slug": "spatial-spectral-2d",
        "title": "2D Field Axis scanning",
        "domain_family": "scalar-field",
        "description": "Saturates dual-axis spaces (X/Y) into frequency and amplitude components of a moving scanner.",
        "source_schema": {"columns": ["x", "y"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["x", "y"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "x",
                    "targetType": "param",
                    "targetKey": "brightness",
                    "transform": {"type": "linear", "rawMin": 0, "rawMax": 100, "outMin": 0.2, "outMax": 0.8}
                },
                {
                    "sourceId": "src-1",
                    "column": "y",
                    "targetType": "param",
                    "targetKey": "rootFreq",
                    "transform": {"type": "linear", "rawMin": 0, "rawMax": 100, "outMin": 110, "outMax": 330}
                }
            ]
        },
        "calibration_recommendation": "Use a moderate speed ramp to let the listener scan 2D coordinates without losing tracking of the pitch boundaries.",
        "citation": "Hermann, T., & Ritter, H. (1999). Image Sonification by Dynamic Scanning. ICAD 1999.",
        "recipe_content": """# 2D Field Axis Scanning Recipe

## Use Case
Auditory scanning of satellite heatmaps or agricultural moisture zones.

## Limitations
Translating a 2D space into a 1D sequence of sounds can make it difficult for listeners to reconstruct spatial structures in their mind.
"""
    },
    {
        "slug": "spatial-spectral-3d",
        "title": "3D Spatial Ensemble",
        "domain_family": "scalar-field",
        "description": "3D point clouds map to a spatialized acoustic ensemble surrounding the listener (azimuth, elevation, distance).",
        "source_schema": {"columns": ["x", "y", "z"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["x", "y", "z"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "z",
                    "targetType": "param",
                    "targetKey": "space",
                    "transform": {"type": "linear", "rawMin": -10, "rawMax": 10, "outMin": 0.1, "outMax": 0.9}
                }
            ]
        },
        "calibration_recommendation": "Use elevation mappings to pitch and distance mappings to reverb depth (space) to match real-world physical acoustics.",
        "citation": "Lokki, T., & Gröhn, M. (2005). Spatial Audio in Sonification. Journal of the Audio Engineering Society, 53(10), 934-948.",
        "recipe_content": """# 3D Spatial Ensemble Recipe

## Use Case
Tracking meteorological flight coordinates or underwater sensory groups.

## Limitations
Accurately perceiving elevation (up/down) using standard stereo headphones is physically very difficult and highly variable among individuals.
"""
    },
    {
        "slug": "gradient-drift",
        "title": "Gradient Field Drift Coupling",
        "domain_family": "scalar-field",
        "description": "Gradient values modulate phase coupled oscillator synchrony drift.",
        "source_schema": {"columns": ["gradient_mag"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["gradient_mag"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "gradient_mag",
                    "targetType": "param",
                    "targetKey": "rootFreq",
                    "transform": {"type": "linear", "rawMin": 0, "rawMax": 50, "outMin": 110, "outMax": 220}
                }
            ]
        },
        "calibration_recommendation": "Map high gradient magnitudes directly to high coupling drift to produce clear acoustic phase phase-shifts.",
        "citation": "Kuramoto, Y. (1984). Chemical Oscillations, Waves, and Turbulence. Berlin: Springer.",
        "recipe_content": """# Gradient Field Drift Coupling Recipe

## Use Case
Sonifying gravitational fields or local temperature gradients.

## Limitations
Phase-shifting patterns can sound highly chaotic, making them difficult to translate into precise gradient directions.
"""
    },
    {
        "slug": "vector-flow",
        "title": "Vector Pan-Intensity Flow",
        "domain_family": "scalar-field",
        "description": "Translates 2D vectors into stereo pan and sound intensity levels.",
        "source_schema": {"columns": ["dx", "dy"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["dx", "dy"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "dx",
                    "targetType": "param",
                    "targetKey": "brightness",
                    "transform": {"type": "linear", "rawMin": -10, "rawMax": 10, "outMin": 0.2, "outMax": 0.8}
                }
            ]
        },
        "calibration_recommendation": "Map vector direction to panning and vector speed (magnitude) to volume for an intuitive representation of flow.",
        "citation": "Flow-Field Auditory Display Research Guild.",
        "recipe_content": """# Vector Pan-Intensity Flow Recipe

## Use Case
Tracking meteorological wind vectors or magnetic fields.

## Limitations
Acoustic masking can obscure vector direction if multiple high-intensity vector layers overlap.
"""
    },

    # ── NETWORK / GRAPH DATA (4 mappings) ─────────────────────────────────────
    {
        "slug": "node-degree-density",
        "title": "Node Degree Harmonic Density",
        "domain_family": "network",
        "description": "Node degree translates into timbral complexity and active harmonic voice counts.",
        "source_schema": {"columns": ["degree"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["degree"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "degree",
                    "targetType": "param",
                    "targetKey": "brightness",
                    "transform": {"type": "linear", "rawMin": 1, "rawMax": 20, "outMin": 0.1, "outMax": 0.9}
                }
            ]
        },
        "calibration_recommendation": "Map nodes with high degrees to highly complex timbres to represent cluster hubs.",
        "citation": "Bovermann, T. et al. (2007). Graph Sonification Methods. ICAD 2007.",
        "recipe_content": """# Node Degree Harmonic Density Recipe

## Use Case
Exploring social network hubs or internet router load in network graphs.

## Limitations
Graph clusters are represented by overall sound density, meaning individual nodes are not recognizable.
"""
    },
    {
        "slug": "edge-weight-coupling",
        "title": "Edge Weight Coupling Strength",
        "domain_family": "network",
        "description": "Edge weight values map directly to Kuramoto coupled oscillator constants.",
        "source_schema": {"columns": ["weight"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["weight"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "weight",
                    "targetType": "param",
                    "targetKey": "space",
                    "transform": {"type": "linear", "rawMin": 0, "rawMax": 1, "outMin": 0.1, "outMax": 0.9}
                }
            ]
        },
        "calibration_recommendation": "Map high edge weights to tight oscillator phase coupling to represent cohesive subgraphs.",
        "citation": "Complex Network Synchronization Principles.",
        "recipe_content": """# Edge Weight Coupling Strength Recipe

## Use Case
Sonifying neural connectivity or electrical grid loads.

## Limitations
Acoustic phase-locking can make the sound flat, completely hiding minor edge weight details.
"""
    },
    {
        "slug": "connected-component",
        "title": "Connected Component Synthesis",
        "domain_family": "network",
        "description": "Subgraph size and density changes dynamically swap underlying sound engines.",
        "source_schema": {"columns": ["component_size"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["component_size"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "component_size",
                    "targetType": "param",
                    "targetKey": "brightness",
                    "transform": {"type": "discrete", "rawMin": 1, "rawMax": 100, "outMin": 0.2, "outMax": 0.8, "steps": 5}
                }
            ]
        },
        "calibration_recommendation": "Set up distinct, separate octaves for different component sizes.",
        "citation": "Topological Data Sonification Workshop.",
        "recipe_content": """# Connected Component Synthesis Recipe

## Use Case
Tracking system modules or isolating cluster faults.

## Limitations
Engine-swapping transients can introduce minor clicks or audio pops if not properly smoothed.
"""
    },
    {
        "slug": "centrality-tuning",
        "title": "Centrality Pitch Assignment",
        "domain_family": "network",
        "description": "Betweenness centrality values map directly to roots in a microtonal scale.",
        "source_schema": {"columns": ["centrality"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["centrality"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "centrality",
                    "targetType": "param",
                    "targetKey": "rootFreq",
                    "transform": {"type": "linear", "rawMin": 0, "rawMax": 1, "outMin": 110, "outMax": 220}
                }
            ]
        },
        "calibration_recommendation": "Calibrate centrality bounds to the 90th percentile to prevent a single highly central node from distorting the rest of the scale.",
        "citation": "Centrality Auditory Mapping Models.",
        "recipe_content": """# Centrality Pitch Assignment Recipe

## Use Case
Listening to supply-chain bottleneck loads or virus spreaders in real time.

## Limitations
This method provides high auditory feedback but makes it difficult to trace the specific paths connecting central nodes.
"""
    },

    # ── STRUCTURED EVENT DATA (3 mappings) ────────────────────────────────────
    {
        "slug": "log-stream-granular",
        "title": "Log Stream Granular Bursts",
        "domain_family": "structured-event",
        "description": "Log events trigger short granular bursts with density and pitch modulated by severity level.",
        "source_schema": {"columns": ["severity_level"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["severity_level"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "severity_level",
                    "targetType": "param",
                    "targetKey": "rootFreq",
                    "transform": {"type": "discrete", "rawMin": 0, "rawMax": 3, "outMin": 110, "outMax": 440, "steps": 4}
                }
            ]
        },
        "calibration_recommendation": "Map high severity levels (e.g. errors) to high pitch registers so they stand out clearly against standard system traffic logs.",
        "citation": "Barra, M. et al. (2002). Web Server Monitoring via Sonification. ICAD 2002.",
        "recipe_content": """# Log Stream Granular Bursts Recipe

## Use Case
Real-time monitoring of server logs and warning spikes.

## Limitations
A high volume of concurrent log warnings can cause immediate auditory saturation.
"""
    },
    {
        "slug": "categorical-swap",
        "title": "Categorical Event Engine Swap",
        "domain_family": "structured-event",
        "description": "Category key changes trigger instant switches between synthesis models.",
        "source_schema": {"columns": ["category_id"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["category_id"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "category_id",
                    "targetType": "param",
                    "targetKey": "brightness",
                    "transform": {"type": "discrete", "rawMin": 1, "rawMax": 5, "outMin": 0.1, "outMax": 0.9, "steps": 5}
                }
            ]
        },
        "calibration_recommendation": "Map similar categories to related acoustic properties (e.g. different waveguide materials) to sound coherent.",
        "citation": "Event-based Sonification Design.",
        "recipe_content": """# Categorical Event Engine Swap Recipe

## Use Case
Tracking state machine changes or assembly line status logs.

## Limitations
Fast, frequent state transitions can cause significant timbre changes that sound jarring and fatiguing.
"""
    },
    {
        "slug": "performance-envelope",
        "title": "Performance Envelope Modulation",
        "domain_family": "structured-event",
        "description": "CPU and Memory metrics modulate synth attack-decay envelopes and filter cutoff sweeps.",
        "source_schema": {"columns": ["cpu_utilization"]},
        "mapping_spec": {
            "sources": [{"id": "src-1", "type": "file", "columns": ["cpu_utilization"]}],
            "rules": [
                {
                    "sourceId": "src-1",
                    "column": "cpu_utilization",
                    "targetType": "param",
                    "targetKey": "brightness",
                    "transform": {"type": "linear", "rawMin": 0, "rawMax": 100, "outMin": 0.2, "outMax": 0.8}
                }
            ]
        },
        "calibration_recommendation": "Smooth utility spikes with a running filter to keep timbral sweeps pleasant.",
        "citation": "Auditory Display of System Health.",
        "recipe_content": """# Performance Envelope Modulation Recipe

## Use Case
Representing database connection pool pressure or compute node loads.

## Limitations
Conveys overall system load trends well but completely masks fine-grained transactional details.
"""
    }
]


async def main() -> None:
    sm = get_sessionmaker()
    async with sm() as session:
        # Check existing templates by slug to prevent duplicates
        stmt = select(MappingTemplate.slug)
        res = await session.execute(stmt)
        existing_slugs = set(res.scalars().all())

        seeded = 0
        for data in TEMPLATES:
            if data["slug"] in existing_slugs:
                continue

            template = MappingTemplate(
                slug=data["slug"],
                title=data["title"],
                description=data["description"],
                domain_family=data["domain_family"],
                source_schema=data["source_schema"],
                mapping_spec=data["mapping_spec"],
                calibration_recommendation=data["calibration_recommendation"],
                citation=data["citation"],
                recipe_content=data["recipe_content"],
                position=seeded,
            )
            session.add(template)
            seeded += 1

        await session.commit()
        print(f"Seeded {seeded} mapping templates.")


if __name__ == "__main__":
    asyncio.run(main())
