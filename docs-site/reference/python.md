# Python `anneal` Module API Reference

The browser-sandboxed Python scripting panel leverages **Pyodide** to provide direct, high-performance execution of scientific Python workflows. The core scripting library is the `anneal` module, pre-imported in all scripting contexts.

---

## 1. Submodule: `anneal.state`

Handles observation and mutation of generator parameters.

### `get()` -> `dict`

- **Stability:** `stable`
- **Description:** Retrieves the complete state of the parameter store.
- **Example:**
  ```python
  import anneal
  state = anneal.state.get()
  print("Root frequency:", state['params']['rootFreq'])
  ```

### `set(params: dict)`

- **Stability:** `stable`
- **Description:** Mutates generator parameters. Physical boundaries are strictly clamped.
- **Example:**
  ```python
  anneal.state.set({"rootFreq": 147.0, "coupling": 0.8})
  ```

### `set_engine(engine_id: str)`

- **Stability:** `stable`
- **Description:** Swaps active synthesis engine dynamically.
- **Example:**
  ```python
  anneal.state.set_engine("fm")
  ```

### `subscribe(keys: list, callback: callable) -> str`

- **Stability:** `stable`
- **Description:** Subscribes to changes on state keys. Returns a unique subscription ID.
- **Example:**

  ```python
  def on_change(diff):
      print("Parameter updated:", diff)

  sub_id = anneal.state.subscribe(["params"], on_change)
  ```

### `unsubscribe(sub_id: str)`

- **Stability:** `stable`
- **Description:** Cancels active parameter store subscription.

---

## 2. Submodule: `anneal.engine`

Inspects real-time sound synthesis outputs.

### `get_spectrum() -> numpy.ndarray`

- **Stability:** `stable`
- **Description:** Returns a 256-element Numpy array representing Web Audio FFT amplitudes.
- **Example:**
  ```python
  fft = anneal.engine.get_spectrum()
  print("Max amplitude bin:", fft.argmax())
  ```

### `get_partials() -> list`

- **Stability:** `stable`
- **Description:** Retrieves emergent partial values (frequencies and relative amplitudes).
- **Response format:** `[{"freq": 110.0, "amp": 0.8}, ...]`

---

## 3. Submodule: `anneal.session`

Manages synthesis lifecycle state.

### `start()`

- **Stability:** `stable`
- **Description:** Fades and triggers the audio synthesis session.

### `stop()`

- **Stability:** `stable`
- **Description:** Fades and pauses audio synthesis.

---

## 4. Submodule: `anneal.datalog`

Accesses deterministic time-series logs of audio-reactive and synthesis telemetry.

### `start(mode="standard")`

- **Stability:** `stable`
- **Description:** Boots session datalogging at a continuous `30Hz` sample rate.

### `snapshot() -> numpy.ndarray`

- **Stability:** `stable`
- **Description:** Retrieves all recorded datalogging frames as an array of state dictionaries.

### `stop()`

- **Stability:** `stable`
- **Description:** Stills and completes active datalogging.

---

## 5. Submodule: Extended Scientific APIs

### `session_log(last_seconds=None, format='standard') -> pandas.DataFrame`

- **Stability:** `stable`
- **Description:** Converts datalogged telemetry frames into a Pandas DataFrame.
- **Parameters:**
  - `last_seconds` (`int`): If provided, returns only data points from the last $N$ seconds.
  - `format` (`str`): `'standard'` or `'spectrum'`.

### `stream_log(every_n_ticks=10)`

- **Stability:** `stable`
- **Description:** Async generator yielding batches of logged frames as Pandas DataFrames.
- **Example:**
  ```python
  async for batch_df in anneal.stream_log(every_n_ticks=30):
      print("Mean RMS of batch:", batch_df['features.rms'].mean())
  ```

### `sweep(params_grid: dict, duration=5) -> pandas.DataFrame`

- **Stability:** `stable`
- **Description:** Runs an automated parameter sweep over the Cartesian product of the parameters inside `params_grid`, pausing `duration` seconds on each step. Evaluates and aggregates acoustic telemetry (RMS, centroid, flux, Kuramoto order parameter).
- **Example:**
  ```python
  import asyncio
  grid = {"coupling": [0.1, 0.5, 0.9], "drift": [0.0, 0.5]}
  df = await anneal.sweep(grid, duration=2)
  ```

### `features(start=None, end=None) -> pandas.DataFrame`

- **Stability:** `stable`
- **Description:** Retrieves a focused Pandas DataFrame of acoustic features (RMS, spectral centroid, spectral flux, zero-crossing rate).

### `render(duration=30, format='numpy', path=None)`

- **Stability:** `stable`
- **Description:** Offlines renders the synthesizer output.
- **Formats:** `'numpy'` (returns array of channel values) or `'wav'` (writes binary WAV file to `path`).

### `cite() -> str` [NEW]

- **Stability:** `stable`
- **Description:** Returns the formatted BibTeX entry and APA citation string for academic references.

---

## 6. Submodule: `anneal.experiment`

Builds perceptual experiments.

### Classes:

- **`Experiment(title, description="", consent_text="", debrief_text="")`:**
  - `add_block(block)`: Adds a stimulus block.
  - `add_break(message)`: Adds a participant rest screen.
  - `add_demographics(survey)`: Adds participant intake survey fields.
  - `run()`: Registers the experiment definition to the browser's runner pipeline.
- **`Block(name, trials, randomize="full", counterbalance=False)`:**
  - `trials` is a list of dicts: `[{"stimulus": Stimulus, "response": Response}]`.
- **`Stimulus(id, patch, duration=4.0)`:**
  - `id`: Unique stimulus handle.
  - `patch`: Generative parameter state dictionary.
  - `duration`: Active playback time in seconds.
- **Response Handlers:**
  - `LikertResponse(prompt, scale=7)`: Renders a $N$-point scalar rating slider.
  - `ForcedChoice(prompt, options)`: Displays radioactive multiple-choice buttons.
  - `FreeText(prompt, max_chars=500)`: Renders a textual area feedback box.
  - `AdjustValue(prompt, range, step, target_param)`: Interactive slider altering synthesizer values.
  - `ReactionTime(prompt, target_key="Space")`: Measures time between onset and keyboard hits.
  - `Continuous(prompt, duration, scale=100)`: Continuous valence-arousal tracking.
  - `DemographicSurvey(fields=None)`: Intake information (defaults: `["age", "hearing_loss", "musical_experience"]`).
