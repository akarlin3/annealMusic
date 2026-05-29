# Anneal Ambiance MIDI Integration Guide (v1.6)

This document provides a comprehensive operational guide for using **MIDI Input and Output** in Anneal Ambiance. The Web MIDI API enables native communication between physical MIDI controllers, synthesizers, and your browser for manual parameter sculpting, pitch keyboard tracking, and downstream device clock synchronization.

---

## 1. Compatibility & Browser Support

> [!IMPORTANT]
> **Desktop Web Environment Required**
> The Web MIDI API is supported natively only in desktop-class browsers.
>
> - **Supported Browsers**: Google Chrome, Microsoft Edge, Opera, and Mozilla Firefox (v108+).
> - **Unsupported Environments**: Safari (macOS/iOS), all iOS WebView shells (Chrome, Edge, Firefox on iOS), and the Capacitor mobile apps (which utilize system WebViews lacking Web MIDI capabilities).

### Graceful Fallback

When a user launches Anneal Ambiance in an unsupported browser (such as Safari) and navigates to the `/midi` settings page, the app automatically detects the lack of native Web MIDI support and displays a premium glassmorphic warning card. The warning directs the user to open the application in a supported browser.

---

## 2. Setting Up Permissions

To start using MIDI, go to the **MIDI Dashboard** by clicking the MIDI icon in the application footer/header, or directly navigating to `/midi`.

### Activating Access

1. Click the **Enable MIDI** button on the settings card.
2. The browser will present a native permission prompt: _"Anneal Ambiance wants to use your MIDI devices"_.
3. Click **Allow**.

> [!NOTE]
> **SysEx Security Policy**
> Anneal Ambiance initiates Web MIDI access with `{ sysex: false }` to guarantee a minimal security authorization profile. This avoids high-severity browser warnings and is fully sufficient for standard CC controllers, notes, clock signals, and transport parameters.

---

## 3. CC Parameter Mapping

Any physical MIDI Controller knob, slider, or fader emitting standard MIDI Control Change (CC) messages can be mapped to control both global and engine-specific parameters.

### Manual MIDI Learning

To map a parameter to a physical control:

1. Navigate to the **Parameter CC Assignments** table in `/midi`.
2. Click the **Learn** button next to your target parameter.
3. The table row will transition into an active listening state, displaying **"Wiggle CC knob..."**.
4. Wiggle your desired physical knob or slide your fader.
5. The interface registers the first incoming CC number and links it to that parameter immediately.
6. A toast confirmation will slide up confirming the successful binding.

### Manual Binding & Editing

You can also type a CC number directly into the **Assigned CC** input box for any parameter. Clearing the input box or clicking **Clear Map** unbinds the parameter.

### Min, Max, and Response Curves

Once a CC is assigned, you can customize how the 7-bit physical range (0–127) translates to synthesis parameters:

- **Min / Max Bounds**: Restrict the parameter sweep to a specific range (e.g. map a fader to sweep filter resonance between `0.20` and `0.80`).
- **Response Curves**:
  - `Linear`: Default mapping for direct proportional response.
  - `Exponential`: Tailored for exponential scales (such as Pitch/Root Frequency) to give fine resolution at lower values.
  - `Logarithmic`: Inverted exponential scale.

### Built-in Controller Templates

Anneal Ambiance includes pre-bundled, zero-configuration layout maps for popular controllers. If you connect one of these devices, you can click **Load Default Maps** to automatically populate your mappings:

- **Ableton Push 2**
- **Novation Launch Control XL**
- **Akai MIDI Mix**
- **Korg nanoKONTROL2**
- **Generic 8-Fader Fallback**

---

## 4. Keyboard Pitch Note Tracking

You can play a physical MIDI Keyboard to set the synthesis base root pitch.

### How to Enable Note Tracking

1. Scroll to the **Keyboard Pitch Note Tracking** section.
2. Toggle **Note Sets Root Frequency** to active.

### Monophonic Pitch Behavior

Anneal Ambiance tracks note inputs monophonically.

- **Last-Note-Priority**: When holding down multiple keys, the synthesizer's pitch responds to the most recently pressed key.
- **Pre-MIDI Pitch Preservation**: The system captures your manual UI Root slider frequency before you strike a key so that it can return to it if configured.

### Note-Off Release Behavior

When you release all keys, you can customize the release behavior:

- **Sustain Last Pitch (Ambient Default)**: The synthesizer holds the frequency of the last played key indefinitely. This is perfect for continuous ambient textures.
- **Return to manual UI slider pitch**: The synthesizer immediately glides back to the root frequency that was selected on the manual UI Root slider before you played the keyboard.

### Strike Velocity Modulation

You can map keyboard strike velocities (0–127 force) to modulate any of the following synthesis destinations dynamically:

- `excitationLevel` (Excellent for Physical modeling mallet strikes)
- `brightness` (Modulates filter cutoff)
- `drift` (Modulates detuning speed)
- `space` (Modulates post-reverb wet balance)
- `volume` (Modulates session volume)
- `None` (Static strike velocity)

---

## 5. Output Clock & Transport Sync

Anneal Ambiance can act as the **Master Clock of Record** for your studio. Downstream hardware synths, drum machines, or sequencer software can be synchronized to the same generative temporal cycle.

### PPQN Clock Streaming

When enabled, the app streams **24 PPQN (Pulses Per Quarter Note)** MIDI clock ticks to the selected active Output device.

- **BPM Range**: Exposes a slider to adjust tempo from **30 BPM** up to **240 BPM**.
- **Session Transport Integration**: Starting the main Anneal Ambiance session (Open Jam or Arc) automatically emits a **MIDI Start (0xFA)** transport signal. Stopping the session emits a **MIDI Stop (0xFC)** signal.
- **Port Hot-Plugging**: Hardware output ports can be hot-plugged at run-time without interrupting the active clock thread.

### Outgoing CC Streaming

To record your performance into a DAW alongside physical audio stems:

1. Toggle **Emit CC Streams** in `/midi` to active.
2. Manual fader sweeps and drift-driven parameters will be output as standard CC streams to your chosen output device.
3. The streams are throttled to a strict **60Hz frequency cap** to avoid MIDI loopbacks, network congestion, and hardware driver locks.

---

## 6. Import and Export Configurations

If you have customized an intricate controller configuration, you can back it up or share it.

- **Export**: Click the **Export** button in the header to download a `json` file of all configurations and controller maps.
- **Import**: Click the **Import** button to load a saved JSON configuration backup.

---

_Enjoy bringing physical tactile expression into the generative meditation sandbox!_
