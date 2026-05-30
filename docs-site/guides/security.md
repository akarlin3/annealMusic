# Security & Consent Protocols

AnnealMusic operates in highly sensitive research, medical, and clinical-trial environments. To safeguard participant privacy and secure local hosting systems, the application integrates rigorous security mechanisms.

---

## 1. Zero-Data-Processor Sandboxing

AnnealMusic runs entirely within the participant's local browser context. Unlike traditional cloud-based telemetry platforms, AnnealMusic **does not collect, process, or transmit personal data**:

- **No persistent identifiers:** No tracking cookies, advertising IDs, or session fingerprinting techniques are deployed.
- **Wipe-on-Exit:** If a participant aborts a trial or clicks "Withdraw", all in-memory logs and response buffers are instantly cleared from memory.
- **Manual Data Dispatch:** Exported data is compiled into a local ZIP file. If an HTTP POST transmission is configured, participants are shown the exact plaintext JSON payload, giving them full transparency and agency before submit actions occur.

---

## 2. Network Security & Tunnels

When bridging the web-based synthesizer to local Python or OSC environments, local sockets open. The following mitigations are enforced:

### Loopback Default

The WebSocket and UDP bridge daemons bind exclusively to the local loopback interface:

```text
127.0.0.1
```

This restricts network interface exposure, meaning external computers on the same Wi-Fi/local network cannot inject OSC packets or sniff synthesizer states.

### String & Input Sanitization

To prevent injection attacks, all incoming OSC addresses are validated against a strict, anchored regular expression:

```regex
^\/anneal\/control\/[a-zA-Z0-9_\-\/]+$
```

Any address that fails validation, contains special execution characters, or attempts path traversal is immediately discarded with an active security warning in the terminal.

### Throttling & DDoS Protection

- **Packet Quota:** The OSC UDP daemon implements rate-limiting, dropping clients that exceed `100 packets/sec` to prevent memory/CPU starvation.
- **Bandwidth Control:** Telemetry broadcasts (such as FFT spectrum blobs) are optimized to run at `30Hz` and can be adjusted downward or fully deactivated inside the `/research` control panel to prevent network saturation.
