# AnnealMusic Session Datalog Schema v1.0 (Machine-Readable JSON Schema)

This schema specifies the standard structure of the `SessionLogRecord` objects written during datalogging.

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
