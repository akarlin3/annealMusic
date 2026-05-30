# AnnealMusic JSON-RPC Research API Reference (v1)

This document specifies the stable public contract for the **AnnealMusic Research Bridge (API v1)**. Every request, response, and error payload follows the standard [JSON-RPC 2.0 specification](https://www.jsonrpc.org/specification).

---

## 1. Protocol Architecture & Transports

The Research API is designed to be **transport-agnostic**. The payload serialization is pure JSON-RPC 2.0, allowing different network/process boundaries to wrap the same engine calls.

- **v5.0 (BroadcastChannel)**: Standard communication channel named `anneal_music_bridge`. BroadcastChannel isolates scopes automatically to the same-origin, same-browser context, providing implicit security.
- **v5.1+ (WebSockets / OSC)**: Planned support for secure WebSocket tunnels to bridge external Python scripting or OSC controllers.
- **v5.2+ (stdio)**: Headless CLI process coordination.

---

## 2. API Method Specification

### State Observation

#### `anneal.state.get`

Returns the full parameter store state, including current creative mode, parameters, active engine, and active tuning.

- **Parameters**: None.
- **Response**:

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

#### `anneal.state.subscribe`

Subscribes to changes on specific keys of the param store (`params`, `engineId`, `tuning`, or `mode`).

- **Parameters**:

```typescript
{
  "keys": ("params" | "engineId" | "tuning" | "mode")[]
}
```

- **Response**:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "subscriptionId": "sub_a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6"
  },
  "id": 2
}
```

- **Notification push**: Sent asynchronously to the client when values change:

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

#### `anneal.state.unsubscribe`

Cancels an active state subscription.

- **Parameters**:

```typescript
{
  "subscriptionId": string
}
```

- **Response**: `true` on success.

---

### Sound Engine & Spectrum

#### `anneal.engine.getSpectrum`

Retrieves the latest Web Audio AnalyserNode Fast Fourier Transform (FFT) spectrum frame.

- **Parameters**: None.
- **Response**:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "spectrum": [0, 12, 45, 128, 255, 192, 64, 8]
  },
  "id": 3
}
```

> [!TIP]
> Spectrum data arrays correspond to standard Web Audio `Uint8Array` frequency bin values.

#### `anneal.engine.getPartials`

Retrieves the emergent phase-coupled partial values from the active synthesizer engine (frequencies and amplitudes).

- **Parameters**: None.
- **Response**:

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

### State Mutation

#### `anneal.state.set`

Patches the core generator parameters. Clamps all values to their physical bounds.

- **Parameters**:

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

- **Response**: `true` on success.

#### `anneal.state.setEngine`

Swaps the active sound synthesis engine dynamically (e.g. `'sine'`, `'waveguide'`, `'bowed'`, `'pulse'`, `'fm'`, `'mallet'`, `'membrane'`, `'edge'`).

- **Parameters**:

```typescript
{
  "engineId": string
}
```

- **Response**: `true` on success.

#### `anneal.state.setTuning`

Updates the reference tuning system and A4 frequency.

- **Parameters**:

```typescript
{
  "tuning": {
    "system": string,
    "referenceA4Hz": number
  }
}
```

- **Response**: `true` on success.

---

### Lifecycle Management

#### `anneal.session.start`

Fades and starts the active listening session or meditation timer.

- **Parameters**: None.
- **Response**: `true` on success.

#### `anneal.session.stop`

Fades and stops the active listening session or meditation timer.

- **Parameters**: None.
- **Response**: `true` on success.

#### `anneal.session.status`

Returns the current status of the running session, along with elapsed and remaining durations.

- **Parameters**: None.
- **Response**:

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

#### `anneal.session.loadPatch`

Directly hydrates the parameters, engine, and tuning parameters from a pre-saved patch object.

- **Parameters**:

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

- **Response**: `true` on success.

#### `anneal.session.loadPiece`

Loads an arrangement piece, including segments and bell schedules.

- **Parameters**:

```typescript
{
  "piece": Record<string, any>
}
```

- **Response**: `true` on success.

---

### System Metadata

#### `anneal.version`

Returns app version, bridge version, and active schema version.

- **Parameters**: None.
- **Response**:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "app": "5.0.0",
    "bridge": "1.0",
    "schema": "v20"
  },
  "id": 6
}
```

#### `anneal.health`

Simple liveness check.

- **Parameters**: None.
- **Response**:

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

## 3. JSON-RPC Error Codes

All bridge error responses strictly follow the JSON-RPC 2.0 error specification.

| Error Code | Error Message            | Description                                                                  |
| :--------- | :----------------------- | :--------------------------------------------------------------------------- |
| `-32700`   | `Parse error`            | Invalid JSON received by the server.                                         |
| `-32600`   | `Invalid Request`        | The JSON sent is not a valid JSON-RPC 2.0 request.                           |
| `-32601`   | `Method not found`       | The requested method does not exist on the bridge.                           |
| `-32602`   | `Invalid params`         | The method parameters are invalid or fail schema bounds.                     |
| `-32603`   | `Internal error`         | Internal bridge server error.                                                |
| `-32000`   | `Unauthorized`           | WebSocket or CLI token validation failed (for v5.1+).                        |
| `-32001`   | `Security Violation`     | Attempted action violates the safety policy (e.g. attempting account saves). |
| `-32002`   | `Engine Not Initialized` | The AudioContext or engine orchestrator is not yet bootstrapped.             |

---

## 4. Safety Model

The Research Bridge acts purely as a local control interface. It **cannot** perform the following destructive or unauthorized operations:

1. **Save Patches**: Cannot trigger backend database writes (such as saving patches to accounts).
2. **Social Interaction**: Cannot follow users, like patches, or post comments.
3. **Gallery Publishing**: Cannot trigger publishing of pieces or patches to the public gallery.
4. **Data Exfiltration**: The bridge server lives entirely within the sandboxed web client, with no permissions to access remote endpoints beyond standard same-origin WebSocket tunnels.
