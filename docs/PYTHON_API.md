# AnnealMusic · Python API Reference (`anneal`)

The `anneal` Python module is a high-performance local library loaded inside the sandboxed Web Worker environment of the Research Console. It provides direct, zero-latency access to the active parameter store, synthesizer engines, and datalogger outputs.

---

## State Access (`anneal.state`)

### `anneal.state.get() -> dict`

Returns a Python dictionary representing the full, instantaneous state of the parameter store.

- **Return Keys:**
  - `params`: Dict of active sculpt parameters (`rootFreq`, `brightness`, `drift`, `space`, etc.).
  - `engineId`: String identifier of the active synthesis engine (`"sine"`, `"granular"`, etc.).
  - `engineParams`: Dict of active engine-specific parameters.
  - `tuning`: Active scale tuning system configuration.
  - `mode`: Active session mode (`"sketch"` or `"drone"`).

### `anneal.state.set(params: dict) -> None`

Patches the active parameters store asynchronously.

```python
import anneal
anneal.state.set({"brightness": 0.75, "drift": 0.2})
```

### `anneal.state.set_engine(engine_id: str) -> None`

Asynchronously swaps the active synthesizer engine.

- **Allowed Values:** `"sine"`, `"waveguide"`, `"bowed"`, `"pulse"`.

### `anneal.state.subscribe(keys: list[str], callback: callable) -> str`

Subscribes to live changes on specific parameter keys. Triggers the callback with a diff dictionary whenever any watched key changes. Returns a unique string subscription ID.

```python
def on_change(diff):
    print("Brightness shifted to:", diff["brightness"])

sub_id = anneal.state.subscribe(["brightness"], on_change)
```

### `anneal.state.unsubscribe(sub_id: str) -> None`

Cancels an active state key subscription.

---

## Audio Analysis & Engine (`anneal.engine`)

### `anneal.engine.get_spectrum() -> np.ndarray`

Returns the latest magnitude spectrum frame as a 512-element floating-point NumPy array representing decibel values in the range `[-100, 0]`.

```python
import anneal
spectrum = anneal.engine.get_spectrum()
print("Peak bin index:", spectrum.argmax())
```

### `anneal.engine.get_partials() -> list[dict]`

Returns a list of dictionaries `[{"freq": float, "amp": float}]` representing the active coupled partial frequencies (Hz) and linear amplitudes in real time.

---

## Session Lifecycle (`anneal.session`)

### `anneal.session.start() -> None`

Starts the active listening session or standalone meditation timer.

### `anneal.session.stop() -> None`

Stops the active listening session or standalone meditation timer.

---

## Datalogger (`anneal.datalog`)

### `anneal.datalog.start(mode: str = "standard") -> None`

Starts recording session logs into the memory ring buffer.

- **Modes:** `"lightweight"`, `"standard"`, `"full"`.

### `anneal.datalog.snapshot() -> np.ndarray`

Retrieves a snapshot of the latest logged ticks from the ring buffer as a structured NumPy array.

### `anneal.datalog.stop() -> None`

Stops recording session logs.

---

## System Meta (`anneal.version`)

### `anneal.version() -> str`

Returns the active system version and JSON-RPC schema version string.

---

## Scientific Analysis & Data Science (`anneal` root)

These methods are introduced in **v5.5** to support rich data-science workflows with **pandas**, **SciPy**, and **matplotlib** inside the sandboxed environment.

### `anneal.session_log(last_seconds: float = None, format: str = "standard") -> pd.DataFrame`

Ingests ticks from the datalogger ring buffer and flattens them into a clean, flat pandas `DataFrame` with columns like `params.rootFreq`, `features.rms`, and `drift.orderParameter`.

- **Parameters:**
  - `last_seconds`: Optional. Filter to only return ticks captured in the last N audio seconds.
  - `format`: `"standard"` or `"spectrum"`. The `"spectrum"` variant filters to retain only magnitude spectrum decibel columns.

```python
df = anneal.session_log()
print("Average RMS:", df['features.rms'].mean())
```

### `anneal.stream_log(every_n_ticks: int = 10) -> AsyncGenerator[pd.DataFrame]`

An asynchronous generator that yields a flattened pandas `DataFrame` containing a batch of `every_n_ticks` ticks in real time.

```python
# Must be run inside an async context
async for batch in anneal.stream_log(every_n_ticks=20):
    if batch['features.rms'].max() > 0.6:
        anneal.state.set({"volume": 0.2})
```

### `anneal.sweep(params_grid: dict, duration: float = 5.0) -> pd.DataFrame`

Asynchronously sweeps a grid of parameter values, settles the engine, logs acoustic features over `duration` seconds for each combination, and returns a compiled performance matrix as a pandas `DataFrame`.

- **Return Columns:** Includes grid parameter names along with calculated performance features: `rms_mean`, `rms_max`, `spectral_centroid_mean`, `spectral_flux_mean`, `zcr_mean`, `order_parameter_mean`.

```python
# Must be run inside an async context
df = await anneal.sweep({
    "drift": [0.1, 0.5, 0.9],
    "brightness": [0.3, 0.7]
}, duration=3.0)
```

### `anneal.features(start: float = None, end: float = None) -> pd.DataFrame`

Returns a tabular DataFrame containing strictly real-time audio features (`rms`, `spectralCentroid`, `spectralFlux`, `zcr`) indexed by session timestamp over the specified interval.

### `anneal.render(duration: float = 30.0, format: str = "numpy", path: str = None) -> np.ndarray | bool`

Asynchronously renders the active patch offline using the engine's DSP logic and the reverb IR.

- **Formats:**
  - `"numpy"`: Returns a 2D float NumPy array `(channels, samples)` of audio samples.
  - `"wav"`: Encodes the render to standard stereo 16-bit PCM WAV format and writes it to Pyodide's virtual filesystem (`MEMFS`) at `path`. Requires `path` to be specified.

```python
# Must be run inside an async context
# Render to NumPy array
audio = await anneal.render(duration=10.0, format="numpy")

# Render to virtual wav file
await anneal.render(duration=10.0, format="wav", path="/tmp/render.wav")
```
