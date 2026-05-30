# AnnealMusic · Scientific Python Cookbook & Recipes

Welcome to the Scientific Python environment inside the sandboxed Research Console! This guide provides standard recipes, configurations, and best practices for conducting real-time data analysis, parameter sweeps, and spectral visualisations using **Pandas**, **SciPy**, and **matplotlib**.

---

## 1. Environment Activation

By default, the Python environment boots as a lightweight runtime loading only `numpy`. To enable the full scientific suite:

1. **Preload Option (Recommended):** Toggle **Preload Scientific Environment** in the Scripting settings. This loads `scipy`, `pandas`, `matplotlib`, and `scikit-learn` from the CDN on startup.
2. **On-Demand Loading:** If you write `import pandas` or `import scipy` in your script, the console's **Magic AST-Scan Import Interceptor** automatically loads the packages dynamically from the CDN before executing.

---

## 2. Standard Recipes & Analysis

### Recipe A: Real-Time State Coherence Audit

This script starts the datalogger, drives organic parameter sweeps, captures the resulting ring buffer observations into a pandas `DataFrame`, and renders a visual plot of the Kuramoto Coupling Coherence order parameter $r(t)$ in real-time.

```python
import anneal
import time
import matplotlib.pyplot as plt

print("Starting Kuramoto Coupling Audit...")
anneal.datalog.start("standard")

# Modulate brightness and drift coupling slowly
for i in range(10):
    val = 0.2 + (i * 0.05)
    anneal.state.set({"drift": val, "brightness": 0.3 + (i * 0.04)})
    time.sleep(0.1)

# Ingest log as flattened Pandas DataFrame
df = anneal.session_log()
print(f"Captured {len(df)} ticks.")

if not df.empty:
    plt.figure(figsize=(6, 3))
    plt.plot(df['timestamp'], df['drift.orderParameter'], label='Coherence r(t)', color='orange')
    plt.xlabel('Audio Time (s)')
    plt.ylabel('Order Parameter r(t)')
    plt.title('Kuramoto Coupling Phase Coherence')
    plt.grid(True)
    plt.legend()
    plt.show() # Automatically intercepted and drawn on the UI Canvas

anneal.datalog.stop()
print("Audit Complete ✅")
```

---

### Recipe B: Asynchronous Parameter Grid Sweep

Sweeping parameter combinations is a long-running process that must run asynchronously to prevent blocking the worker event loop. This recipe runs a $3 \times 2$ grid sweep and exports a summary CSV matrix to the virtual disk.

```python
import anneal
import asyncio

async def run_sweep():
    print("Initiating Grid Sweep...")

    # 3x2 parameter search grid
    grid = {
        "drift": [0.1, 0.5, 0.9],
        "brightness": [0.3, 0.7]
    }

    # Run sweep (settles 1.0s per combination)
    df = await anneal.sweep(grid, duration=1.0)
    print("\nCalculated Acoustic Feature Matrix:")
    print(df[['drift', 'brightness', 'rms_mean', 'order_parameter_mean']])

    # Write to virtual file system
    df.to_csv('/tmp/sweep_results.csv', index=False)
    print("CSV saved to virtual filesystem: /tmp/sweep_results.csv ✅")

# Register the async task
asyncio.ensure_future(run_sweep())
```

---

### Recipe C: Audio Feature Interval Analysis

Extracting real-time spectral centroid and zero-crossing rates over an active performance window.

```python
import anneal
import time

print("Analyzing acoustic features...")
anneal.datalog.start("full")
time.sleep(1.0)

# Extract features over elapsed audio timeline
df_feats = anneal.features(start=0.2, end=0.8)
anneal.datalog.stop()

if not df_feats.empty:
    print("Mean Spectral Centroid (Hz):", df_feats['spectralCentroid'].mean())
    print("Mean Zero Crossing Rate:", df_feats['zcr'].mean())
```

---

### Recipe D: Stem Synthesis Rendering to Virtual File System

This script renders a stereo patch offline faster-than-realtime, reads it as a numpy array, and compiles a standard 16-bit PCM WAV file in the Virtual File System (`MEMFS`) for download to the actual disk.

```python
import anneal
import asyncio

async def compile_stems():
    # 1. Render directly as a 2D NumPy array
    audio = await anneal.render(duration=3.0, format='numpy')
    print(f"NumPy Buffer: Channels={audio.shape[0]}, Samples={audio.shape[1]}")

    # 2. Render and save to virtual disk as a stereo WAV file
    print("Compiling WAV file inside VFS...")
    await anneal.render(duration=3.0, format='wav', path='/tmp/bloom.wav')
    print("WAV stem compiled successfully! Check the VFS Panel to download. ✅")

# Run async rendering
asyncio.ensure_future(compile_stems())
```

---

## 3. Sandboxed File Operations (VFS)

Pyodide provides an isolated, highly-secure in-memory virtual filesystem.

- **Storage Path:** Write standard files under the `/tmp` virtual directory.
- **Downloading to Disk:** Files written to the VFS are rendered inside the **Virtual File System** panel in the scripting area. Clicking **Download** triggers a native browser download, copying the file to your physical hard drive.
- **Persistent memory:** Virtual files are maintained in worker memory for the active tab session. Reloading the page clears the virtual memory, preventing persistent storage overheads.
