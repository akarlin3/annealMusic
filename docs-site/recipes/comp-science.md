# Computational Science Adjacent Recipes

These recipes focus on physical sonification systems, phase coupling dynamics calculations, and high-fidelity meditative stimulus synthesis for medical studies.

---

## Recipe 13: Sonify a 1D Diffusion (Heat) Equation

- **Goal:** Sonify the numerical solutions of the 1D partial differential heat equation.
- **Prose Walkthrough:** Run a finite difference solver in Python (Pyodide), mapping the heat dissipation field concentration to active synthesizer parameters in real-time.

### Python Code:

```python
import anneal
import numpy as np
import asyncio

# 1. Setup 1D grid space
nx = 50
dx = 0.1
alpha = 0.01 # Thermal diffusivity
dt = 0.05

# Initial condition: high localized spike in center
u = np.zeros(nx)
u[nx//2 - 5 : nx//2 + 5] = 1.0

async def solve_and_sonify():
    global u
    print("[INFO] Initiating Diffusion Sonification...")
    for step in range(500):
        # Apply boundary conditions
        u_new = u.copy()
        for i in range(1, nx-1):
            # Finite difference equation
            u_new[i] = u[i] + alpha * dt / (dx**2) * (u[i+1] - 2*u[i] + u[i-1])
        u = u_new

        # 2. Extract metrics
        mean_temp = np.mean(u)
        max_temp = np.max(u)
        spread = np.std(u)

        # 3. Map physical fields to active sound coordinates
        patch = {
            "rootFreq": 110.0 + (mean_temp * 440.0), # Frequency tracks mean heat
            "drift": min(1.0, max_temp),             # Drift tracks peak hot spots
            "coupling": 1.0 - min(1.0, spread)       # Sync tracks structural organization
        }
        anneal.state.set(patch)

        await asyncio.sleep(0.05) # 20Hz solver ticks

asyncio.ensure_future(solve_and_sonify())
```

---

## Recipe 14: Analyze Kuramoto Oscillator Synchronization

- **Goal:** Extract Voice phase angles, calculate order parameters, and verify transitions.
- **Prose Walkthrough:** Grab partials telemetry, evaluate Phase Order Parameter $r(t) = \frac{1}{N}\left|\sum_{j=1}^N e^{i\theta_j}\right|$ over sweeps of `coupling`, and plot order values.

### Python Notebook Code:

```python
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# 1. Load active session datalogger ticks
df = pd.read_json("datalogger.jsonl", lines=True)

# 2. Compute Phase Coherence Order Parameter r(t) manually
# r(t) = |1/N * sum( exp(i * theta_j) )|
order_parameters = []
for index, row in df.iterrows():
    # Extract phase values of active partial oscillators
    phases = np.array(row['drift']['partials'])
    N = len(phases)
    if N == 0:
        order_parameters.append(0.0)
        continue
    # Compute complex phase vectors
    complex_vectors = np.exp(1j * phases)
    r = np.abs(np.sum(complex_vectors)) / N
    order_parameters.append(r)

df['computed_r'] = order_parameters

# 3. Plot order parameter over the synchronization coupling transition
plt.plot(df['timestamp'], df['computed_r'], label="Computed Order Parameter")
plt.plot(df['timestamp'], df['params.coupling'], label="Coupling Coefficient", linestyle="--")
plt.xlabel("Elapsed Time (s)")
plt.ylabel("Coherence r(t)")
plt.title("Kuramoto Synchronization Transition Analysis")
plt.legend()
plt.show()
```

---

## Recipe 15: Render Hour-Long Meditative Drones

- **Goal:** Deterministically render high-resolution 60-minute WAV audio files.
- **Prose Walkthrough:** Formulate a master drone patch and utilize the high-performance CLI tool to execute the rendering step.

### CLI Rendering Instruction:

```bash
# Render a high-fidelity 1-hour meditation drone usingbrowser-parity math
annealmusic render meditation_patch.json -o ./stimulus_1h.wav --duration 3600s --engine browser --rate 48000 --depth 24
```

- **WAV properties:** 48kHz sampling, 24-bit PCM depth, perfect sample matching.
- **Result:** Excellent acoustic stimulus materials for clinical pilots.
