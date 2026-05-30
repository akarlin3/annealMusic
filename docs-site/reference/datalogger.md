# Session Datalogger Schema Reference

The session datalogger generates high-fidelity, deterministic time-series datasets of the synthesizer's internal state and acoustic outputs at `30Hz`.

---

## JSON Schema Specification

The `SessionLogRecord` objects written during active session log sessions conform strictly to the following schema structure:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SessionLogRecord",
  "description": "Deterministic tick log record representing the runtime physical and acoustic state of an AnnealMusic generative session.",
  "type": "object",
  "required": [
    "timestamp",
    "wallTime",
    "params",
    "metadata",
    "drift",
    "partials",
    "features",
    "event"
  ],
  "properties": {
    "timestamp": {
      "type": "number",
      "description": "AudioContext.currentTime in seconds since session start"
    },
    "wallTime": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 UTC timestamp of the sample"
    },
    "params": {
      "type": "object",
      "required": [
        "rootFreq",
        "spread",
        "density",
        "coupling",
        "drift",
        "brightness",
        "space",
        "volume"
      ],
      "properties": {
        "rootFreq": { "type": "number" },
        "spread": { "type": "number" },
        "density": { "type": "number" },
        "coupling": { "type": "number" },
        "drift": { "type": "number" },
        "brightness": { "type": "number" },
        "space": { "type": "number" },
        "volume": { "type": "number" }
      }
    },
    "metadata": {
      "type": "object",
      "required": [
        "mode",
        "engineId",
        "engineParams",
        "tuning",
        "schemaVersion",
        "logSchemaVersion"
      ],
      "properties": {
        "mode": { "type": "string", "enum": ["sketch", "drone"] },
        "engineId": { "type": "string" },
        "engineParams": { "type": "object" },
        "tuning": {
          "type": "object",
          "required": ["system", "referenceA4Hz"],
          "properties": {
            "system": {
              "type": "string",
              "enum": ["equal", "just", "pythagorean", "custom"]
            },
            "referenceA4Hz": { "type": "number" },
            "sclId": { "type": "string" }
          }
        },
        "schemaVersion": { "type": "string" },
        "logSchemaVersion": { "type": "string" }
      }
    },
    "drift": {
      "type": "object",
      "required": ["meanDetune", "orderParameter", "partials"],
      "properties": {
        "meanDetune": { "type": "number" },
        "orderParameter": { "type": "number", "minimum": 0, "maximum": 1 },
        "partials": {
          "type": "array",
          "items": { "type": "number" }
        }
      }
    },
    "partials": {
      "type": "object",
      "required": ["frequencies", "amplitudes"],
      "properties": {
        "frequencies": {
          "type": "array",
          "items": { "type": "number" }
        },
        "amplitudes": {
          "type": "array",
          "items": { "type": "number" }
        }
      }
    },
    "features": {
      "type": "object",
      "required": ["rms", "spectralCentroid", "spectralFlux", "zcr"],
      "properties": {
        "rms": { "type": "number", "minimum": 0, "maximum": 1 },
        "spectralCentroid": { "type": "number" },
        "spectralFlux": { "type": "number" },
        "zcr": { "type": "number", "minimum": 0, "maximum": 1 },
        "spectrum": {
          "type": "array",
          "items": { "type": "number" }
        }
      }
    },
    "event": {
      "type": ["string", "null"]
    },
    "eventData": {
      "type": "object"
    },
    "audioChunk": {
      "type": "array",
      "items": { "type": "number" }
    }
  }
}
```

---

## Field Breakdown

### `timestamp`

The continuous, monotonic elapsed time in seconds since the audio synthesis thread started. Derived directly from `AudioContext.currentTime` to guarantee sub-millisecond scheduling precision.

### `drift.orderParameter`

The emergent **Kuramoto order parameter** $r(t) \in [0, 1]$, representing the coherence of active oscillator phases:

- $r(t) \approx 0$: Total phase desynchronization (highly complex, evolving).
- $r(t) \approx 1$: Perfect phase locking (unified periodic waveform).

### `features.rms`

The Root Mean Square energy of the generated signal over the latest frame, normalized to a $[0, 1]$ ceiling.

### `features.spectralCentroid`

The acoustic "brightness" center of mass of the FFT spectrum, in Hz.

### `features.spectralFlux`

The rate of acoustic change from the preceding spectrum frame, measuring texture stability.
