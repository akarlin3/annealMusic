# Music Technologist Recipes

These recipes focus on local network integrations, custom controllers, hardware bridging, and embedded headless deployments.

---

## Recipe 4: Build a Custom Controller Layout in TouchOSC

- **Goal:** Create an interactive iPad/iPhone control surface for live sculpting.
- **Prose Walkthrough:** TouchOSC offers a visual editor to build sliders and XY pads. Map the elements to target addresses matching the AnnealMusic control namespace.

### Mapping Bindings:

- **Master Volume Slider:** Bind to `/anneal/control/volume` (range `0.0 - 0.8`).
- **Root Pitch Slider:** Bind to `/anneal/control/root` (range `40.0 - 440.0`).
- **Aesthetic Sculpt XY Pad:**
  - **X-Axis:** Bind to `/anneal/control/brightness` (spectral brightness).
  - **Y-Axis:** Bind to `/anneal/control/coupling` (Kuramoto phase-coupling).

---

## Recipe 5: Bridge AnnealMusic to a Eurorack System

- **Goal:** Use physical Eurorack modules to modulate or react to AnnealMusic.
- **Prose Walkthrough:** Route live synthesizer state values (like active voice phases or the synchronization order parameter) to a USB MIDI-CV converter module, driving external analog synthesizers.

### Python Bridging Script:

```python
# Runs in Pyodide/Local Python bridging environment
import socket
import struct
import mido # Python MIDI library

# Setup socket to listen for AnnealMusic OSC broadcasts
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(("127.0.0.1", 9000))

# Open USB-to-CV MIDI Interface port
outport = mido.open_output("USB MIDI-CV Converter")

print("[INFO] Eurorack Bridge active. Awaiting synchronization data...")
while True:
    data, addr = sock.recvfrom(1024)
    # Parse incoming OSC packets representing /anneal/state/coupling
    if b"/anneal/state/coupling" in data:
        # Extract float value
        val = struct.unpack(">f", data[-4:])[0]
        # Map 0.0 - 1.0 to MIDI CC 0 - 127
        cc_val = int(val * 127)
        # Send CC message to MIDI-CV module to map to an analog CV output jack
        outport.send(mido.Message("control_change", control=10, value=cc_val))
```

---

## Recipe 6: Run Headless on a Raspberry Pi Installation

- **Goal:** Deploy AnnealMusic on a standalone, headless micro-computer as a public sound installation that boots automatically.
- **Prose Walkthrough:** Run the headless Node CLI on a Raspberry Pi, creating a Linux systemd unit service to start the rendering process at system startup.

### Systemd Service Configuration:

Create `/etc/systemd/system/annealmusic.service`:

```ini
[Unit]
Description=AnnealMusic Headless Installation Service
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/annealMusic
ExecStart=/usr/bin/node tools/cli/dist/index.js render examples/meditation_patch.json -o /dev/audio --duration 24h --seed 1337
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and boot the system service:

```bash
sudo systemctl enable annealmusic
sudo systemctl start annealmusic
```
