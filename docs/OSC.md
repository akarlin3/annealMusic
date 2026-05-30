# AnnealMusic · Bidirectional Open Sound Control (OSC) Reference

AnnealMusic features bidirectional Open Sound Control (OSC) integration for both **Web** (via localhost WebSocket bridge helper) and **Mobile** (via native Capacitor plugins for local network UDP).

This allows you to seamlessly integrate AnnealMusic with SuperCollider, Max/MSP, Pure Data, Reaktor, Sonic Pi, and physical sound installations.

---

## 1. Address Namespace Specifications

All control actions are under `/anneal/control/`, and state broadcasts are under `/anneal/state/`.

### State Broadcasts (Read Endpoints)

These are broadcast by AnnealMusic to external endpoints:

| OSC Address                | Type Tag  | Description                                                                |
| :------------------------- | :-------- | :------------------------------------------------------------------------- |
| `/anneal/state/root`       | `f`       | Current root frequency in Hz (20.0 - 4200.0)                               |
| `/anneal/state/spread`     | `f`       | Tuning spread coefficient (0.7 - 1.3)                                      |
| `/anneal/state/density`    | `i`       | Active partial count (1 - 8)                                               |
| `/anneal/state/coupling`   | `f`       | Oscillator coupling factor (0.0 - 1.0)                                     |
| `/anneal/state/drift`      | `f`       | Phase drift coefficient (0.0 - 1.0)                                        |
| `/anneal/state/brightness` | `f`       | Spectral brightness (0.0 - 1.0)                                            |
| `/anneal/state/space`      | `f`       | Reverb decay/space parameter (0.0 - 1.0)                                   |
| `/anneal/state/volume`     | `f`       | Master output volume (0.0 - 0.8)                                           |
| `/anneal/state/engine`     | `s`       | Active engine ID (`"sine" \| "fm" \| "granular" \| "physical" \| "pulse"`) |
| `/anneal/state/mode`       | `s`       | Creative mode (`"sketch" \| "drone"`)                                      |
| `/anneal/spectrum`         | `b`       | FFT Spectrum blob: 256 bytes of raw uint8 amplitude values                 |
| `/anneal/partials`         | `ffff...` | Interleaved frequency (Hz) and amplitude per partial (density \* 2 floats) |
| `/anneal/session/state`    | `s`       | Creative session state (`"idle" \| "playing" \| "paused" \| "ended"`)      |
| `/anneal/session/elapsed`  | `f`       | Elapsed time since the session started, in seconds                         |

#### Engine-Specific State Broadcasts

Exposed under `/anneal/state/engine_params/<engine>/<param>`:

- **FM (`fm`)**:
  - `modRatio` (`f`): Modulator frequency ratio (0.5 - 4.0)
  - `modIndex` (`f`): Modulation depth index (0.0 - 10.0)
  - `feedback` (`f`): Modulator self-feedback (0.0 - 1.0)
- **Granular (`granular`)**:
  - `source` (`f`): Audio source index (0.0 - 3.0)
  - `size` (`f`): Grain size in milliseconds (30.0 - 300.0)
  - `density` (`f`): Grain trigger rate per second (4.0 - 40.0)
  - `posJitter` (`f`): Grain position jitter (0.0 - 1.0)
  - `pitchJitter` (`f`): Grain pitch jitter in cents (0.0 - 100.0)
  - `posCenter` (`f`): Grain playhead center (0.0 - 1.0)
- **Physical (`physical`)**:
  - `model` (`f`): Physical model index (0.0 - 7.0)
  - `excitationLevel` (`f`): Continuous excite energy (0.0 - 1.0)
  - `damping` (`f`): High-frequency damping factor (0.0 - 1.0)
  - `brightness` (`f`): Resonator excitation brightness (0.0 - 1.0)
  - `reed` (`f`): Non-linear excitation feedback stiffness (0.0 - 1.0)
  - `inharm` (`f`): Modal inharmonicity factor (0.0 - 1.0)
- **Pulse (`pulse`)**:
  - `density` (`f`): Pulse grid subdivision index (0.0 - 5.0)
  - `accent` (`f`): Accent emphasis state (0.0 or 1.0)
  - `tone` (`f`): Synthesis lowpass filter tone (0.0 - 1.0)
  - `swing` (`f`): Grid shuffle swing factor (0.0 - 1.0)
  - `humanize` (`f`): Trigger timing jitter (0.0 - 1.0)

---

### Control Actions (Write Endpoints)

Send these to AnnealMusic to sculpt creative parameters:

| OSC Address                     | Type Tag | Action / Implemented Mapping          |
| :------------------------------ | :------- | :------------------------------------ |
| `/anneal/control/root`          | `f`      | Sets root frequency (Hz).             |
| `/anneal/control/spread`        | `f`      | Sets spread coefficient.              |
| `/anneal/control/density`       | `i`      | Sets active partial density (1 - 8).  |
| `/anneal/control/coupling`      | `f`      | Sets coupling factor.                 |
| `/anneal/control/drift`         | `f`      | Sets drift coefficient.               |
| `/anneal/control/brightness`    | `f`      | Sets brightness.                      |
| `/anneal/control/space`         | `f`      | Sets space.                           |
| `/anneal/control/volume`        | `f`      | Sets master volume.                   |
| `/anneal/control/engine`        | `s`      | Sets active engine ID string.         |
| `/anneal/control/session/start` | (none)   | Starts active audio session.          |
| `/anneal/control/session/stop`  | (none)   | Fades and stops active audio session. |

#### Engine-Specific Control Actions

Mapped under `/anneal/control/engine_params/<engine>/<param>`:

- **FM**: `/anneal/control/engine_params/fm/<param>` (`f`) -> Sets `modRatio`, `modIndex`, `feedback`.
- **Granular**: `/anneal/control/engine_params/granular/<param>` (`f` or `s`) -> Sets `source`, `size`, `density`, `posJitter`, `pitchJitter`, `posCenter`.
- **Physical**: `/anneal/control/engine_params/physical/<param>` (`f`) -> Sets `model`, `excitationLevel`, `damping`, `brightness`, `reed`, `inharm`.
- **Pulse**: `/anneal/control/engine_params/pulse/<param>` (`f`) -> Sets `density`, `accent`, `tone`, `swing`, `humanize`.

---

## 2. Localhost WebSocket Bridge Setup

Because web browsers lack native UDP support, a small, loopback WebSocket helper translates packets.

### Starting the helper

Install globally and execute:

```bash
npm install -g annealmusic-osc-bridge
annealmusic-osc-bridge
```

The terminal prints:

```text
[INFO] WebSocket Server listening on ws://127.0.0.1:8766
[INFO] UDP Server listening on 127.0.0.1:8765
```

### CLI Config Customizer

Customize ports and log verbosity:

```bash
annealmusic-osc-bridge --udp-in 8000 --udp-out 9000 --ws-port 8080
```

---

## 3. Integration Examples

### SuperCollider Example

```supercollider
// 1. Setup Outgoing Controller (Send to Port 8765)
~anneal = NetAddr("127.0.0.1", 8765);

// Set root frequency of AnnealMusic
~anneal.sendMsg("/anneal/control/root", 220.0); // A3 Hz

// Swap engine to Granular
~anneal.sendMsg("/anneal/control/engine", "granular");

// 2. Setup Incoming Watchers (Receive on Port 9000)
thisProcess.openUDPPort(9000);

OSCdef(\rootWatcher, { |msg|
    var freq = msg[1];
    ("Root frequency changed: " + freq + " Hz").postln;
}, '/anneal/state/root');
```

---

## 4. Mobile Native UDP Setup

On mobile platforms (iOS and Android), Capacitor custom native plugins bypass the localhost bridge, opening **direct hardware UDP sockets** on your local network.

- **iOS**: Leverages Apple's modern high-performance `Network` framework, ensuring fast, battery-efficient networking.
- **Android**: Allocates dedicated threads running Java `DatagramSocket` listeners.

Configuration is handled inside the `/research` panel UI.

---

## 5. Security & Threat Mitigation

- **Loopback default**: Sockets bind to loopback address `127.0.0.1` by default to ensure complete network sandboxing.
- **Input checking**: addresses are validated against rigorous sanitizing regexes (`^\/anneal\/[a-zA-Z0-9_\-\/]+$`) to defense against injection attacks.
- **Client Throttling**: Sockets rate-limit clients sending more than 100 packets/sec to prevent CPU/memory exhaustion.
- **Bandwidth Throttling**: Interactive sliders allow users to throttle high-frequency streams (like spectrum blobs at 30Hz) while keeping critical controls instantaneous.
