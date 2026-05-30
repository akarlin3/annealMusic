# JSON-RPC 2.0 Bridge Reference

This document specifies the stable public contract for the **AnnealMusic Research Bridge (API v1.0)**. Every request, response, and error payload follows the standard [JSON-RPC 2.0 specification](https://www.jsonrpc.org/specification).

---

## Protocol Architecture & Transports

The Research API is designed to be **transport-agnostic**. The payload serialization is pure JSON-RPC 2.0, allowing different network/process boundaries to wrap the same engine calls.

- **BroadcastChannel (v5.0):** Standard communication channel named `anneal_music_bridge` for same-origin, same-browser contexts.
- **WebSockets / OSC (v5.1+):** Secure WebSocket tunnels to bridge external Python scripting or OSC controllers.
- **stdio (v5.2+):** Headless CLI process coordination.

---

## State Observation Methods

### `anneal.state.get`

- **Stability:** `stable`
- **Parameters:** None.
- **Description:** Returns the full parameter store state, including current creative mode, parameters, active engine, and active tuning.
- **Response:**
  ```json
  {
    "jsonrpc": "2.0",
    "result": {
      "params": {
        "rootFreq": 110.0,
        "spread": 0.5,
        "density": 0.4,
        "coupling": 0.2,
        "drift": 0.15,
        "brightness": 0.5,
        "space": 0.4,
        "volume": 0.8
      },
      "engineId": "sine",
      "engineParams": {},
      "tuning": {
        "system": "12-EDO",
        "referenceA4Hz": 440.0
      },
      "mode": "sketch"
    },
    "id": 1
  }
  ```

### `anneal.state.subscribe`

- **Stability:** `stable`
- **Parameters:**
  ```typescript
  {
    "keys": ("params" | "engineId" | "tuning" | "mode")[]
  }
  ```
- **Description:** Subscribes to changes on specific keys of the param store.
- **Response:**
  ```json
  {
    "jsonrpc": "2.0",
    "result": {
      "subscriptionId": "sub_a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6"
    },
    "id": 2
  }
  ```
- **Notification push:** Sent asynchronously to the client when values change:
  ```json
  {
    "jsonrpc": "2.0",
    "method": "anneal.state.onChange",
    "params": {
      "subscriptionId": "sub_a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
      "key": "params",
      "value": { "rootFreq": 115.5 }
    }
  }
  ```

### `anneal.state.unsubscribe`

- **Stability:** `stable`
- **Parameters:**
  ```typescript
  {
    "subscriptionId": string
  }
  ```
- **Description:** Cancels an active state subscription.
- **Response:** `true` on success.

---

## Sound Engine & Spectrum Methods

### `anneal.engine.getSpectrum`

- **Stability:** `stable`
- **Parameters:** None.
- **Description:** Retrieves the latest Web Audio AnalyserNode Fast Fourier Transform (FFT) spectrum frame (256 uint8 frequency values).
- **Response:**
  ```json
  {
    "jsonrpc": "2.0",
    "result": {
      "spectrum": [0, 12, 45, 128, 255, 192, 64, 8]
    },
    "id": 3
  }
  ```

### `anneal.engine.getPartials`

- **Stability:** `stable`
- **Parameters:** None.
- **Description:** Retrieves the emergent phase-coupled partial values from the active synthesizer engine (frequencies in Hz and relative amplitudes).
- **Response:**
  ```json
  {
    "jsonrpc": "2.0",
    "result": {
      "partials": [
        { "freq": 110.0, "amp": 0.8 },
        { "freq": 220.0, "amp": 0.4 },
        { "freq": 330.0, "amp": 0.2 }
      ]
    },
    "id": 4
  }
  ```

---

## State Mutation Methods

### `anneal.state.set`

- **Stability:** `stable`
- **Parameters:**
  ```typescript
  {
    "params": {
      "rootFreq"?: number;
      "spread"?: number;
      "density"?: number;
      "coupling"?: number;
      "drift"?: number;
      "brightness"?: number;
      "space"?: number;
      "volume"?: number;
    }
  }
  ```
- **Description:** Patches the core generator parameters. Clamps all values to their physical bounds.
- **Response:** `true` on success.

### `anneal.state.setEngine`

- **Stability:** `stable`
- **Parameters:**
  ```typescript
  {
    "engineId": string // e.g. 'sine' | 'waveguide' | 'bowed' | 'pulse' | 'fm' | 'granular'
  }
  ```
- **Description:** Swaps the active sound synthesis engine dynamically.
- **Response:** `true` on success.

### `anneal.state.setTuning`

- **Stability:** `stable`
- **Parameters:**
  ```typescript
  {
    "tuning": {
      "system": string,
      "referenceA4Hz": number
    }
  }
  ```
- **Description:** Updates the reference tuning system and A4 frequency.
- **Response:** `true` on success.

---

## Session & Lifecycle Management

### `anneal.session.start`

- **Stability:** `stable`
- **Parameters:** None.
- **Description:** Fades and starts the active listening session or meditation timer.
- **Response:** `true` on success.

### `anneal.session.stop`

- **Stability:** `stable`
- **Parameters:** None.
- **Description:** Fades and stops the active listening session or meditation timer.
- **Response:** `true` on success.

### `anneal.session.status`

- **Stability:** `stable`
- **Parameters:** None.
- **Description:** Returns the current status of the running session, along with elapsed and remaining durations.
- **Response:**
  ```json
  {
    "jsonrpc": "2.0",
    "result": {
      "status": "playing",
      "elapsedMs": 35000,
      "remainingMs": 1165000
    },
    "id": 5
  }
  ```

### `anneal.session.loadPatch`

- **Stability:** `stable`
- **Parameters:**
  ```typescript
  {
    "patch": {
      "params": Record<string, number>,
      "engineId": string,
      "engineParams": Record<string, any>,
      "tuning": {
        "system": string,
        "referenceA4Hz": number
      }
    }
  }
  ```
- **Description:** Directly hydrates the parameters, engine, and tuning parameters from a pre-saved patch object.
- **Response:** `true` on success.

### `anneal.session.loadPiece`

- **Stability:** `stable`
- **Parameters:**
  ```typescript
  {
    "piece": Record<string, any>
  }
  ```
- **Description:** Loads an arrangement piece, including segments and bell schedules.
- **Response:** `true` on success.

---

## System Metadata

### `anneal.version`

- **Stability:** `stable`
- **Parameters:** None.
- **Description:** Returns app version, bridge version, and active schema version.
- **Response:**
  ```json
  {
    "jsonrpc": "2.0",
    "result": {
      "app": "5.7.0",
      "bridge": "1.0",
      "schema": "v20"
    },
    "id": 6
  }
  ```

### `anneal.health`

- **Stability:** `stable`
- **Parameters:** None.
- **Response:**
  ```json
  {
    "jsonrpc": "2.0",
    "result": {
      "status": "ok",
      "timestamp": "2026-05-30T05:00:00.000Z"
    },
    "id": 7
  }
  ```

---

## JSON-RPC Error Codes

All bridge error responses strictly follow the JSON-RPC 2.0 error specification.

| Error Code | Error Message            | Description                                                      |
| :--------- | :----------------------- | :--------------------------------------------------------------- |
| `-32700`   | `Parse error`            | Invalid JSON received by the server.                             |
| `-32600`   | `Invalid Request`        | The JSON sent is not a valid JSON-RPC 2.0 request.               |
| `-32601`   | `Method not found`       | The requested method does not exist on the bridge.               |
| `-32602`   | `Invalid params`         | The method parameters are invalid or fail schema bounds.         |
| `-32603`   | `Internal error`         | Internal bridge server error.                                    |
| `-32000`   | `Unauthorized`           | WebSocket or CLI token validation failed.                        |
| `-32001`   | `Security Violation`     | Attempted action violates the safety policy.                     |
| `-32002`   | `Engine Not Initialized` | The AudioContext or engine orchestrator is not yet bootstrapped. |
