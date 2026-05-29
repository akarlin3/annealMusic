# Anneal Ambiance MIDI CC Output Mapping Table (v1.6)

This document standardizes the outgoing Control Change (CC) channels emitted by Anneal Ambiance. When **Emit CC Streams** is enabled in the MIDI Dashboard, any manual parameter changes or drift-driven automated modulations are streamed on these CC channels.

This standard layout allows creators to easily record Anneal Ambiance performances directly into a DAW (e.g. Ableton, Logic, Reaper) as automation lanes alongside multitrack stems, or route them to modulate external physical synthesizers.

---

## Standard CC Output Map

By default, Anneal Ambiance transmits the 8 primary synthesiser parameters on the following standard MIDI CC channels:

| Parameter Key | MIDI CC Channel | Standard CC Assignment Name       | Description                                   | Output Range |
| :------------ | :-------------- | :-------------------------------- | :-------------------------------------------- | :----------- |
| `rootFreq`    | **CC 74**       | Sound Controller 5 / Brightness   | Base synthesizer pitch, mapped exponentially. | 0 - 127      |
| `spread`      | **CC 75**       | Sound Controller 6                | Harmonic spread multiplier.                   | 0 - 127      |
| `density`     | **CC 76**       | Sound Controller 7                | Partial density count.                        | 0 - 127      |
| `coupling`    | **CC 77**       | Sound Controller 8                | Oscillator phase coupling coefficient.        | 0 - 127      |
| `drift`       | **CC 78**       | Sound Controller 9                | Ornstein–Uhlenbeck detuning rate.             | 0 - 127      |
| `brightness`  | **CC 71**       | Sound Controller 2 / Resonance    | Low-pass tone cutoff resonance.               | 0 - 127      |
| `space`       | **CC 72**       | Sound Controller 3 / Release Time | Reverb send balance / dry-wet.                | 0 - 127      |
| `volume`      | **CC 7**        | Channel Volume                    | Master synthesizer output volume gain.        | 0 - 127      |

---

## Technical Specifications

### Transmission Rate & Throttling

- All outgoing CC signals are bundled and throttled at a strict **60Hz rate limit (16.6ms intervals)**.
- If a parameter changes rapidly (such as a swift fader movement), the intermediate values are accumulated, and only the latest value is sent on the next clock tick. This prevents MIDI buffer congestion and driver lockups on physical MIDI ports.

### Channel Assignment

- CC messages are sent on the output channel configured under **MIDI Output Channel** (defaults to **Channel 16** to prevent interference with key performance channels 1–15).

### Output Curves

- Parameter values are reverse-interpolated back into a 7-bit MIDI CC integer range (`0` to `127`).
- The `rootFreq` parameter is mapped exponentially to match standard physical pitch scales. All other parameters use a linear reverse-interpolation.
