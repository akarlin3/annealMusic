# Command Line Interface (CLI) Reference

The standalone `annealmusic` CLI is a high-performance, headless audio rendering utility designed for batch rendering, parameter sweeps, reproducibility dataset generation, stems exports, and mindfulness listening session production.

---

## Global Options

All CLI commands accept the following global flags:

- `-h, --help`: Displays help information for the command.
- `-V, --version`: Outputs the active CLI and schema version.

---

## Commands

### `render`

- **Stability:** `stable`
- **Syntax:**
  ```bash
  annealmusic render <patch_file.json> [options]
  ```
- **Description:** Renders a single generative music patch to an audio WAV file using the high-fidelity offline audio context.
- **Options:**
  - `-o, --output <path>`: Destination path of the WAV file (default: `output.wav`).
  - `-d, --duration <duration>`: Length of the rendered clip (e.g. `30s`, `10m`).
  - `-s, --seed <number>`: Random seed for deterministic playback (default: `42`).
  - `--engine <node|browser>`: Node (fast native math) or Headless Browser (absolute runtime matching) (default: `node`).
  - `-r, --rate <rate>`: Sample rate in Hz (default: `48000`).
  - `--depth <24|32>`: Output bit depth (default: `24`).
  - `--per-partial`: Output stems for each individual oscillator frequency voice.
  - `--with-fx`: Apply master post-fx loop delays/reverbs (default: `true`).

### `batch`

- **Stability:** `stable`
- **Syntax:**
  ```bash
  annealmusic batch <sweep_file.json> [options]
  ```
- **Description:** Performs high-throughput parameter sweeps across multiple dimensions, outputting files and an academic `manifest.json`.
- **Options:**
  - `-o, --output <dir>`: Target output directory for WAVs (default: `./out/`).
  - `-j, --jobs <jobs>`: Concurrency level limits parallel renders (default: `CPU cores - 1`).
  - `--resume`: Resume previous sweep, skipping existing non-empty WAV files.
  - `--engine <node|browser>`: Synthesizer rendering engine (default: `node`).

### `stems`

- **Stability:** `stable`
- **Syntax:**
  ```bash
  annealmusic stems <piece_file.json> [options]
  ```
- **Description:** Exports individual audio channels, loops, or voices for multi-track mixing.
- **Options:**
  - `-o, --output <dir>`: Destination folder (default: `./stems/`).
  - `--per-partial`: Split every voice of the generator as a separate stem file.
  - `--with-fx`: Include master post-fx tails (default: `true`).
  - `--engine <node|browser>`: Offline synthesis engine (default: `node`).

### `listening`

- **Stability:** `stable`
- **Syntax:**
  ```bash
  annealmusic listening <session_file.json> [options]
  ```
- **Description:** Offline renders complete, mindfully-timed listening sessions including fade-ins and scheduled Zen bells.
- **Options:**
  - `-o, --output <path>`: Destination WAV path (default: `session.wav`).
  - `--engine <node|browser>`: Rendering engine (default: `node`).

### `piece`

- **Stability:** `stable`
- **Syntax:**
  ```bash
  annealmusic piece <piece.json> [options]
  ```
- **Description:** Compiles and renders arrangement pieces with dynamic segments.
- **Options:**
  - `-o, --output <path>`: Destination WAV path.
  - `-s, --seed <number>`: Seed for random variation schedules (default: `42`).

### `validate`

- **Stability:** `stable`
- **Syntax:**
  ```bash
  annealmusic validate <file.json>
  ```
- **Description:** Validates configuration payloads (patches, sweeps, sessions, or pieces) against the unified system schema version.

### `verify-parity`

- **Stability:** `stable`
- **Syntax:**
  ```bash
  annealmusic verify-parity <fileA.wav> <fileB.wav>
  ```
- **Description:** Performs sample-by-sample analysis of two WAV files, reporting Mean Squared Error (MSE), Root Mean Squared Error (RMSE), and maximum differential.

### `cite` [NEW]

- **Stability:** `stable`
- **Syntax:**
  ```bash
  annealmusic cite
  ```
- **Description:** Prints the recommended APA citation and standard BibTeX entry for the current running software version to console.
