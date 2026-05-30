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
