# AnnealMusic · Scripting Guide & Recipes

This guide covers advanced scripting concepts, sandbox constraints, and recipes for writing custom analysis and generative music patches inside the AnnealMusic Research Console.

---

## 1. Sandbox Model & Resource Limits

To protect execution threads and local data, all Python code runs inside a isolated **Web Worker** sandbox.

- **Network Block:** All internet egress is blocked. Importing `socket`, `urllib`, `requests`, or invoking `pyfetch` will immediately raise a `PermissionError`.
- **Synchronous Threading:** Standard Python script execution is blocking inside the worker. To prevent infinite loops from hanging the entire research console, the interface provides an **Interrupt/Stop** button that immediately terminates the active Web Worker thread and boots a clean instance.
- **Cached State Synchronizer:** State changes stream into the worker over a 50Hz BroadcastChannel subscription. This keeps reads (`get()`, `get_spectrum()`) synchronous and fast without locking up the UI thread.

---

## 2. Scripting Recipes

### Recipe A: Parametric LFO Modulator

Modulates synthesizer brightness using a smooth sinusoidal low frequency oscillator (LFO):

```python
import anneal
import time
import math

print("Starting custom LFO modulation script...")

# 50 steps at 100ms intervals = 5 seconds total run
for i in range(50):
    # Calculate smooth sine sweep in range [0.25, 0.75]
    brightness = 0.5 + 0.25 * math.sin(i * 0.25)

    # Patch parameters
    anneal.state.set({"brightness": brightness, "drift": 0.2})
    print(f"Tick {i:02d}: brightness = {brightness:.3f}")

    time.sleep(0.1)

print("LFO modulation complete.")
```

### Recipe B: Coupling Coherence Audit & Visualizer

Audit the live Kuramoto coherence parameter $r(t)$ and compute key statistical metrics:

```python
import anneal
import time
import numpy as np

print("Auditing Kuramoto oscillator phase alignment...")

# Record datalog ticks at standard rate
anneal.datalog.start("standard")
time.sleep(1.0) # Accumulate ticks

# Fetch circular buffer snapshot
ticks = anneal.datalog.snapshot()
anneal.datalog.stop()

if len(ticks) > 0:
    # Retrieve orderParameter from ticks
    coherences = [t["drift"]["orderParameter"] for t in ticks if "drift" in t]

    if coherences:
        mean_coh = np.mean(coherences)
        std_coh = np.std(coherences)
        print(f"Coupling Coherence Stats:")
        print(f"  Observations: {len(coherences)}")
        print(f"  Mean r(t):    {mean_coh:.4f}")
        print(f"  StdDev r(t):  {std_coh:.4f}")
        print(f"  Peak r(t):    {np.max(coherences):.4f}")
    else:
        print("Audit failed: Coherence attributes missing from tick schema.")
else:
    print("Datalog empty. Ensure a listening session is active.")
```

### Recipe C: Adaptive Spectral Feedback Loop

Reads the actual FFT spectral centroid and dynamically shapes the convolver space mix:

```python
import anneal
import time

print("Initializing Adaptive Spectral Feedback loop...")

for step in range(20):
    # Fetch live coupled spectrum analyses
    state = anneal.state.get()

    # Check current brightness and slightly detune carrier to inject organic movement
    curr_brightness = state["params"]["brightness"]
    feedback_space = min(1.0, max(0.0, curr_brightness * 1.2))

    # Write back adaptive dampener
    anneal.state.set({"space": feedback_space})
    print(f"Centroid Feedback step {step}: set space dampener to {feedback_space:.2f}")

    time.sleep(0.25)

print("Spectral feedback sweep ended.")
```
