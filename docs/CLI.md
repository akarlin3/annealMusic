# AnnealMusic Command-Line Interface (CLI) Guide

The standalone `annealmusic` CLI is a high-performance, headless audio rendering utility designed for batch rendering, parameter sweeps, reproducibility dataset generation, stems exports, and mindfulness listening session production.

Reusing the robust server-side audio engine offline contexts, it guarantees perfect output matching the production runtime.

---

## Installation & Setup

If you are using the monorepo, build the CLI tool first:

```bash
cd tools/cli
npm install
npm run build
```

Link or run it using `node`:

```bash
node dist/index.js --help
```

Or execute directly if npm-linked:

```bash
annealmusic --help
```

---

## Command Reference

### 1. Single Patch Render (`render`)

Renders a single generative music patch to an audio WAV file.

```bash
annealmusic render PATCH_FILE.json -o output.wav [--duration 30s] [--seed 42] [--engine node|browser] [--format wav] [--rate 48000] [--depth 24]
```

#### Options:

- `-o, --output <output>`: Output WAV file path (default: `output.wav`).
- `-d, --duration <duration>`: Duration to render (e.g. `30s`, `60s`). Fallback is patch duration.
- `-s, --seed <seed>`: Random seed for deterministic rendering (default: `42`).
- `--engine <engine>`: Rendering backend. `node` (fastest) or `browser` (absolute parity using headless Chromium) (default: `node`).
- `-r, --rate <rate>`: Sample rate in Hz (default: `48000`).
- `--depth <depth>`: Bit depth, either `24` or `32` (default: `24`).
- `--per-partial`: Export stems for every individual voice/partial instead of the stereo master mix.
- `--with-fx`: Apply master post-fx loop/delay tail inside the final rendering (default: `true`).

---

### 2. Batch Parameter Sweep (`batch`)

Performs a parameter sweep over multiple dimensions, computing Cartesian products or linear ranges, hydrated from a base patch configuration. Writes all results to a target output directory along with a reproducibility `manifest.json`.

```bash
annealmusic batch SWEEP_FILE.json -o ./out/ [--jobs 4] [--resume] [--engine node|browser]
```

#### Options:

- `-o, --output <dir>`: Target output directory for WAV files and the manifest (default: `./out/`).
- `-j, --jobs <jobs>`: Concurrency level. Limits maximum number of parallel rendering tasks (default: `CPU cores - 1`).
- `--resume`: Resume previous execution. Scans existing `manifest.json` and skips combinations that have already rendered non-empty files.
- `--engine <engine>`: Rendering backend (`node` or `browser`) (default: `node`).

#### Sweep File Format:

```json
{
  "base": {
    "schema_ver": 20,
    "payload": "m=open&e=sine&rootFreq=147&spread=1.08&density=4"
  },
  "varies": [
    { "key": "drift", "values": [0.1, 0.5] },
    { "key": "rootFreq", "range": { "min": 110, "max": 220, "steps": 3 } }
  ],
  "duration": "10s",
  "seeds": [42, 137]
}
```

---

### 3. Stems Export (`stems`)

Renders and exports individual tracks, loops, or sound voices for a generative piece.

```bash
annealmusic stems PIECE_FILE.json -o ./stems/ [--per-partial] [--with-fx] [--engine node|browser]
```

#### Options:

- `-o, --output <dir>`: Directory where stem files will be saved (default: `./stems/`).
- `--per-partial`: Export every synthesis voice/partial as a separate stem file.
- `--with-fx`: Include post-fx tails in each track (default: `true`).
- `--engine <engine>`: Rendering backend (`node` or `browser`) (default: `node`).

---

### 4. Mindful Listening Session Render (`listening`)

Renders a complete mindfulness listening session, combining a generative piece or patch, fade-ins, integration sequences, and mindfully scheduled Zen bell triggers.

```bash
annealmusic listening LISTENING_SESSION.json -o session.wav [--engine node|browser]
```

#### Options:

- `-o, --output <output>`: Output WAV path (default: `session.wav`).
- `--engine <engine>`: Rendering backend (`node` or `browser`) (default: `node`).

---

### 5. Piece Rendering (`piece`)

Generates audio files for sequential arrangements and dynamic segment-based music pieces.

```bash
annealmusic piece PIECE.json -o piece.wav [--seed 42] [--engine node|browser]
```

#### Options:

- `-o, --output <output>`: Output WAV path (default: `piece.wav`).
- `-s, --seed <seed>`: Deterministic seed (default: `42`).
- `--engine <engine>`: Rendering backend (`node` or `browser`) (default: `node`).

---

### 6. Schema Validation Utility (`validate`)

Validates a patch, piece, session, or sweep configuration file against the unified schema `manifest.json`. Extremely useful for CI/CD checks or prior to massive cluster sweeps.

```bash
annealmusic validate FILE.json
```

---

### 7. Parity Verification Tool (`verify-parity`)

Compares two audio files frame-by-frame and calculates sample-level similarity metrics (Mean Squared Error, Root Mean Squared Error, and maximum difference).

```bash
annealmusic verify-parity fileA.wav fileB.wav
```

---

## Filename Encoding Rules

To support high-throughput machine learning pipelines and dataset categorization, sweeps are encoded with descriptive filenames mapping simplified parameter keys:

- `ph.model` → `model`
- `rootFreq` → `root`
- `drift` → `drift`
- Pattern: `<param_key>=<value>_<param_key>=<value>_seed=<seed>.wav`

Example: `drift=0.1_root=110_seed=42.wav`
