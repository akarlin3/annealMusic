# AnnealMusic · Bidirectional OSC Bridge Helper

This standalone local daemon enables **Bidirectional Open Sound Control (OSC)** for the **AnnealMusic** Web App by translating between native UDP OSC packets and sandboxed JSON-over-WebSocket frames.

---

## 1. Installation

### Node.js Users

Install globally via npm:

```bash
npm install -g annealmusic-osc-bridge
```

### Standalone Executable Binary

For users without Node installed on their machines, pre-compiled single-file executable binaries for **macOS**, **Linux**, and **Windows** are downloadable on the GitHub Releases section of the monorepos workspace. Double-click the file or run it in your terminal.

---

## 2. Default Configuration & Ports

By default, the bridge binds to loopback interface `127.0.0.1` and maps the following ports:

- **UDP Server** (Receives OSC from external software): Port `8765`
- **UDP Client** (Sends OSC to external software): Port `9000` on `127.0.0.1`
- **WebSocket Server** (Communicates with AnnealMusic): Port `8766`

---

## 3. CLI Options & Configuration

You can customize port bindings and logging levels using standard command-line flags:

```bash
# Customizing ports
annealmusic-osc-bridge --udp-in 8000 --udp-out 9000 --ws-port 8080

# Binding externally (WARNING: Disables local-only security sandbox)
annealmusic-osc-bridge --host 0.0.0.0 --udp-host 192.168.1.15

# Verbose debugging logs
annealmusic-osc-bridge --log-level debug
```

### Supported Flags:

- `--udp-in <port>`: Incoming UDP listener port (default: `8765`).
- `--udp-out <port>`: Target UDP client port (default: `9000`).
- `--udp-host <ip>`: Target UDP client host IP address (default: `127.0.0.1`).
- `--ws-port <port>`: WebSocket listen port (default: `8766`).
- `--host <ip>`: Local interface IP to bind servers on (default: `127.0.0.1`).
- `--log-level <debug|info|warn|error>`: Logging verbosity (default: `info`).

---

## 4. SuperCollider, Max/MSP, and Pure Data Integrations

### SuperCollider Example

Save this script inside SuperCollider to control AnnealMusic and receive live spectrum/parameter broadcasts:

```supercollider
// 1. Setup Outgoing Controller Client (Send to Port 8765)
~annealSend = NetAddr("127.0.0.1", 8765);

// 2. Modulate root frequency of AnnealMusic
~annealSend.sendMsg("/anneal/control/root", 164.81); // E3 Hz
~annealSend.sendMsg("/anneal/control/brightness", 0.85);

// 3. Setup Incoming Listener Server (Receive on Port 9000)
thisProcess.openUDPPort(9000); // Ensure port 9000 is open in SuperCollider

OSCdef(\annealRootWatcher, { |msg, time, addr, recvPort|
    var freq = msg[1];
    ("Anneal root frequency changed to: " + freq + " Hz").postln;
}, '/anneal/state/root');

OSCdef(\annealSpectrumWatcher, { |msg, time, addr, recvPort|
    var spectrum = msg.slice(1); // Array of 256 spectrum bin values
    // Update synth modulation depth or visualize spectrum
}, '/anneal/spectrum');
```

### Max/MSP Configuration

1. **Send Controls**: Create a `udpsend 127.0.0.1 8765` object. Format messages as:
   - `[ /anneal/control/root 110.0 ]`
   - `[ /anneal/control/brightness $1 ]`
2. **Receive Broadcasts**: Create a `udpreceive 9000` object. Connect it to a `route /anneal/state/root` object to display the parameter value.

---

## 5. Security & Safety Hardening

- **Localhost-Only Sandboxing**: The bridge executes strictly on loopback interfaces (`127.0.0.1`) by default, restricting access from external networks.
- **Socket Overload Defence**: Sockets drop any incoming packet exceeding 65,535 bytes instantly.
- **Denial of Service Mitigation**: Rates are monitored. If a client sends more than 100 packets/sec, their source IP is burst-throttled to prevent CPU/memory exhaustion.
