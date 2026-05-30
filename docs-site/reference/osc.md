# Open Sound Control (OSC) Namespace Reference

AnnealMusic features bidirectional Open Sound Control (OSC) integration for both **Web** (via localhost WebSocket bridge helper) and **Mobile** (via native Capacitor plugins for local network UDP).

---

## State Broadcasts (Read Endpoints)

These addresses are broadcast by AnnealMusic to registered network controllers or listeners:

| OSC Address                | Type Tag  | Description                                                                | Stability |
| :------------------------- | :-------- | :------------------------------------------------------------------------- | :-------- |
| `/anneal/state/root`       | `f`       | Current root frequency in Hz (20.0 - 4200.0)                               | `stable`  |
| `/anneal/state/spread`     | `f`       | Tuning spread coefficient (0.7 - 1.3)                                      | `stable`  |
| `/anneal/state/density`    | `i`       | Active partial count (1 - 8)                                               | `stable`  |
| `/anneal/state/coupling`   | `f`       | Oscillator coupling factor (0.0 - 1.0)                                     | `stable`  |
| `/anneal/state/drift`      | `f`       | Phase drift coefficient (0.0 - 1.0)                                        | `stable`  |
| `/anneal/state/brightness` | `f`       | Spectral brightness (0.0 - 1.0)                                            | `stable`  |
| `/anneal/state/space`      | `f`       | Reverb decay/space parameter (0.0 - 1.0)                                   | `stable`  |
| `/anneal/state/volume`     | `f`       | Master output volume (0.0 - 0.8)                                           | `stable`  |
| `/anneal/state/engine`     | `s`       | Active engine ID (`"sine" \| "fm" \| "granular" \| "physical" \| "pulse"`) | `stable`  |
| `/anneal/state/mode`       | `s`       | Creative mode (`"sketch" \| "drone"`)                                      | `stable`  |
| `/anneal/spectrum`         | `b`       | FFT Spectrum blob: 256 bytes of raw uint8 amplitude values                 | `stable`  |
| `/anneal/partials`         | `ffff...` | Interleaved frequency (Hz) and amplitude per partial (density \* 2 floats) | `stable`  |
| `/anneal/session/state`    | `s`       | Creative session state (`"idle" \| "playing" \| "paused" \| "ended"`)      | `stable`  |
| `/anneal/session/elapsed`  | `f`       | Elapsed time since the session started, in seconds                         | `stable`  |

### Engine-Specific Parameters:

Exposed under `/anneal/state/engine_params/<engine>/<param>`:

- **FM (`fm`):**
  - `modRatio` (`f`): Modulator frequency ratio (0.5 - 4.0)
  - `modIndex` (`f`): Modulation depth index (0.0 - 10.0)
  - `feedback` (`f`): Modulator self-feedback (0.0 - 1.0)
- **Granular (`granular`):**
  - `source` (`f`): Audio source index (0.0 - 3.0)
  - `size` (`f`): Grain size in milliseconds (30.0 - 300.0)
  - `density` (`f`): Grain trigger rate per second (4.0 - 40.0)
  - `posJitter` (`f`): Grain position jitter (0.0 - 1.0)
  - `pitchJitter` (`f`): Grain pitch jitter in cents (0.0 - 100.0)
  - `posCenter` (`f`): Grain playhead center (0.0 - 1.0)
- **Physical (`physical`):**
  - `model` (`f`): Physical model index (0.0 - 7.0)
  - `excitationLevel` (`f`): Continuous excite energy (0.0 - 1.0)
  - `damping` (`f`): High-frequency damping factor (0.0 - 1.0)
  - `brightness` (`f`): Resonator excitation brightness (0.0 - 1.0)
  - `reed` (`f`): Non-linear excitation feedback stiffness (0.0 - 1.0)
  - `inharm` (`f`): Modal inharmonicity factor (0.0 - 1.0)
- **Pulse (`pulse`):**
  - `density` (`f`): Pulse grid subdivision index (0.0 - 5.0)
  - `accent` (`f`): Accent emphasis state (0.0 or 1.0)
  - `tone` (`f`): Synthesis lowpass filter tone (0.0 - 1.0)
  - `swing` (`f`): Grid shuffle swing factor (0.0 - 1.0)
  - `humanize` (`f`): Trigger timing jitter (0.0 - 1.0)

---

## Control Actions (Write Endpoints)

Send these commands to AnnealMusic to sculpt soundscapes dynamically:

| OSC Address                     | Type Tag | Action / Implemented Mapping          | Stability |
| :------------------------------ | :------- | :------------------------------------ | :-------- |
| `/anneal/control/root`          | `f`      | Sets root frequency (Hz).             | `stable`  |
| `/anneal/control/spread`        | `f`      | Sets spread coefficient.              | `stable`  |
| `/anneal/control/density`       | `i`      | Sets active partial density (1 - 8).  | `stable`  |
| `/anneal/control/coupling`      | `f`      | Sets coupling factor.                 | `stable`  |
| `/anneal/control/drift`         | `f`      | Sets drift coefficient.               | `stable`  |
| `/anneal/control/brightness`    | `f`      | Sets brightness.                      | `stable`  |
| `/anneal/control/space`         | `f`      | Sets space.                           | `stable`  |
| `/anneal/control/volume`        | `f`      | Sets master volume.                   | `stable`  |
| `/anneal/control/engine`        | `s`      | Sets active engine ID string.         | `stable`  |
| `/anneal/control/session/start` | (none)   | Starts active audio session.          | `stable`  |
| `/anneal/control/session/stop`  | (none)   | Fades and stops active audio session. | `stable`  |

---

## WebSocket Loopback Bridge

Because web browsers lack native UDP support, the standalone `annealmusic-osc-bridge` translates incoming packets:

```bash
npm install -g annealmusic-osc-bridge
annealmusic-osc-bridge --udp-in 8765 --udp-out 9000 --ws-port 8766
```

### Security Details:

1. **Loopback default:** Binds to `127.0.0.1` by default to prevent unauthorized local network scans.
2. **Regex checks:** Strictly filters incoming packets against validation patterns.
3. **Throttling:** Imposes connection quotas and sliding filters.
