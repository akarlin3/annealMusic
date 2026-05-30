# Advanced Biofeedback Composition Recipe

This advanced recipe details how to design closed-loop, biometric-driven meta-compositions using AnnealMusic's Python (Pyodide) API.

---

## Recipe 16: Heart Rate and EEG Biofeedback Closed-Loop

- **Goal:** Create a closed-loop system where simulated real-time biometric metrics (Heart Rate Variability (HRV) and EEG delta/theta power ratios) dynamically sculpt synthesizer parameters to guide a listener into a relaxed, meditative state.
- **Prose Walkthrough:** Run a high-frequency polling script simulating biofeedback feeds (such as Bluetooth heart rate monitors or mobile EEG headbands). Parse the indicators, applying higher `coupling` (synchronization) and larger `space` (reverb) when tension rises to acoustically soothe the subject.

### Python Closed-Loop Script:

```python
import anneal
import asyncio
import numpy as np
import random

# Biometric simulation defaults
simulated_heart_rate = 72.0 # bpm
eeg_theta_alpha_ratio = 1.2

async def biometric_feedback_loop():
    global simulated_heart_rate, eeg_theta_alpha_ratio
    print("[INFO] Initiating Closed-Loop Biometric Meta-Composition...")

    while True:
        # 1. Simulate real-time sensor polling (e.g. bluetooth feed)
        # HRV index: high is relaxed, low indicates tension
        hrv_index = random.uniform(20.0, 100.0) - (simulated_heart_rate * 0.2)
        simulated_heart_rate += random.uniform(-1.0, 1.0)
        simulated_heart_rate = max(60.0, min(100.0, simulated_heart_rate))

        # 2. Compute Target Synthesizer Modulations
        # Under tension (high heart rate / low HRV):
        # We increase space (larger room) and increase coupling (phase locking)
        # to create a highly predictable, comforting, and immersive sonic field.
        if simulated_heart_rate > 80.0:
            target_coupling = 0.9  # Coherent, synchronized harmonic structure
            target_space = 0.85     # Deep space reverb
            target_brightness = 0.3 # Warm lowpass tone
        else:
            target_coupling = 0.4  # Slightly complex, evolving texture
            target_space = 0.6      # Moderate space reverb
            target_brightness = 0.6 # Brighter harmonic content

        # 3. Inject parameter updates in-app synchronously
        anneal.state.set({
            "coupling": target_coupling,
            "space": target_space,
            "brightness": target_brightness
        })

        print(f"[Biometric Update] HR: {simulated_heart_rate:.1f} bpm, CC: {target_coupling}, Sp: {target_space}")

        await asyncio.sleep(1.0) # Poll sensor once per second

# Start the biometric feedback meta-composition loop
asyncio.ensure_future(biometric_feedback_loop())
```

### Expected Output:

- **Sonic Response:** Timbre dynamically warms, darkens, and syncs harmonically when simulated heart rate spikes, wrapping the listener in a soothing acoustic blanket.
- **Telemetry logs:** Parameter transitions match the biometric inputs.
