# Getting Started with the Research Console

Welcome to the **AnnealMusic Research Surface**. This guide explains how to use the built-in `/research` console, intercept RPC traffic, and build your own external control scripts to orchestrate the generator parameters in real-time.

---

## 1. Navigating the UI

To access the research console:

1. Start the main application (e.g. `npm run dev` in development, or access your production deploy).
2. Open `/research` in your browser (or click a research launcher).
3. Ensure the **Health sync indicator** in the upper right is showing `ok`. This confirms the JSON-RPC bridge is successfully connected to the main audio orchestrator.

### Telemetry Tab

This tab displays all live RPC packets flying back and forth over the `BroadcastChannel`.

- **→ REQ**: Outgoing request from console to the main orchestrator (e.g. setting param values).
- **← RES**: Incoming response from the orchestrator, tagged with processing duration in milliseconds.
- **📡 NTF**: Subscribed change events (e.g. param sweeps).
- **Quick Sculpt Actions**: Interactive sliders to adjust frequency, brightness, and reverb space, and buttons to switch synthesizers.

---

## 2. Writing Your Own Script (Same-Origin Scripting)

Because the v5.0 bridge is backed by a standard browser `BroadcastChannel` named `anneal_music_bridge`, you can write your own script in **any other browser tab** on the same origin (e.g. `http://localhost:5173`) and send controls to the synth in real-time.

Open a separate tab on the same origin, open the Chrome/Safari DevTools Console, and paste this script:

```javascript
// 1. Open the bridge channel
const bridge = new BroadcastChannel('anneal_music_bridge');

// 2. Set up a listener for responses and notifications
bridge.onmessage = (event) => {
  const msg = event.data;
  if (msg.method === 'anneal.state.onChange') {
    console.log('📡 Engine state changed!', msg.params.key, msg.params.value);
  } else if (msg.id !== undefined) {
    console.log('← Received Response:', msg);
  }
};

// 3. Send a request to set parameters
function setFrequency(freq) {
  bridge.postMessage({
    jsonrpc: '2.0',
    method: 'anneal.state.set',
    params: {
      params: {
        rootFreq: freq,
        brightness: 0.75,
      },
    },
    id: Date.now(),
  });
}

// 4. Trigger a sweep every 2 seconds
let f = 110;
setInterval(() => {
  f = f === 110 ? 220 : 110;
  console.log(`→ Sweeping root frequency to ${f} Hz...`);
  setFrequency(f);
}, 2000);
```

As soon as you execute this, look at the main application tab—the synthesizer will instantly sweep its root frequency back and forth every 2 seconds! Additionally, the Telemetry Console in the `/research` tab will print all `→ REQ` and `📡 NTF` packets in real-time.

---

## 3. High-Rate Spectrum Visualizations

To stream real-time FFT spectrum data at up to 60Hz:

```javascript
const bridge = new BroadcastChannel('anneal_music_bridge');
let reqId = 1;

function pollSpectrum() {
  bridge.postMessage({
    jsonrpc: '2.0',
    method: 'anneal.engine.getSpectrum',
    id: reqId++,
  });
}

// Listen for the spectrum array
bridge.onmessage = (event) => {
  const msg = event.data;
  if (msg.id && msg.result && msg.result.spectrum) {
    console.log('FFT bins:', msg.result.spectrum);
  }
};

// Poll 30 times a second
setInterval(pollSpectrum, 1000 / 30);
```

---

## 4. Troubleshooting Sync Issues

If the console shows `health sync: offline`:

1. **Bootstrap Check**: Ensure the main application is open in a browser tab. The research console relies on the main app running in the background to handle DSP and parameter storage.
2. **Audio Activation**: Click anywhere on the main application tab to unlock the Web Audio context. Browsers require user interaction before playing sound.
3. **Same-Origin Check**: Ensure both tabs are open on the exact same origin (e.g. both on `http://localhost:5173` or both on the same production URL). `BroadcastChannel` is strictly same-origin.
