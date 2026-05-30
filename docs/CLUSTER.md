# High-Throughput Cluster Rendering Guide (`annealmusic` CLI)

Because each individual patch, piece, or listening session rendering is completely stateless and deterministic, the `annealmusic` CLI is extremely well-suited for high-throughput scaling on computing clusters (e.g., Slurm, PBS, or AWS Batch).

This document provides recipe scripts and design patterns to execute sweeps comprising thousands of variations in parallel.

---

## 1. Slurm Job Arrays (Recommended)

Slurm job arrays allow you to spawn hundreds or thousands of parallel workers using a single submit script. Each worker task receives a unique `$SLURM_ARRAY_TASK_ID` environment variable.

We can use the built-in CLI helpers:

- `sweep-get-payload`: Retrieves the overridden URL-encoded state string for index `$SLURM_ARRAY_TASK_ID`.
- `sweep-get-filename`: Retrieves the standard ML-friendly output filename for index `$SLURM_ARRAY_TASK_ID`.

### Example Slurm Submit Script (`submit_sweep.sh`)

```bash
#!/bin/bash
#SBATCH --job-name=anneal-sweep
#SBATCH --output=logs/render_%A_%a.out
#SBATCH --error=logs/render_%A_%a.err
#SBATCH --array=0-999             # 1000 parallel index tasks
#SBATCH --cpus-per-task=1         # Node engine is single-threaded
#SBATCH --mem=1G                  # Ultra-low memory consumption
#SBATCH --time=00:05:00           # Short timeout (rendering is extremely fast)

# 1. Load Node environment (adjust to your cluster modules)
module load node/20.0.0

# 2. Paths to our files
SWEEP_FILE="./sweep-config.json"
OUT_DIR="./results"

mkdir -p "$OUT_DIR"

# 3. Retrieve payload & filename for this task index
PAYLOAD=$(npx annealmusic sweep-get-payload "$SWEEP_FILE" "$SLURM_ARRAY_TASK_ID")
FILENAME=$(npx annealmusic sweep-get-filename "$SWEEP_FILE" "$SLURM_ARRAY_TASK_ID")

# 4. Execute stateless render task
npx annealmusic render "$PAYLOAD" \
  -o "$OUT_DIR/$FILENAME" \
  --duration 30s \
  --engine node
```

Submit it to your cluster queue:

```bash
sbatch submit_sweep.sh
```

---

## 2. PBS / Torq Job Arrays

For PBS-based clusters, the array variable is `$PBS_ARRAY_INDEX`.

### Example PBS Script (`submit_sweep.pbs`)

```bash
#PBS -N anneal-sweep
#PBS -o logs/render_out.$PBS_ARRAY_INDEX
#PBS -e logs/render_err.$PBS_ARRAY_INDEX
#PBS -t 0-999
#PBS -l nodes=1:ppn=1
#PBS -l mem=1gb
#PBS -l walltime=00:05:00

cd $PBS_O_WORKDIR

# Resolve metadata and run
PAYLOAD=$(npx annealmusic sweep-get-payload sweep-config.json $PBS_ARRAY_INDEX)
FILENAME=$(npx annealmusic sweep-get-filename sweep-config.json $PBS_ARRAY_INDEX)

npx annealmusic render "$PAYLOAD" -o "./results/$FILENAME" --duration 30s --engine node
```

---

## 3. AWS Batch & Containerized Sweeps

To execute sweeps on AWS Batch or Kubernetes:

1. Dockerize the CLI using `node:20-slim`.
2. Map the sweep configuration array via an environment variable index (e.g. `$AWS_BATCH_JOB_ARRAY_INDEX`).
3. Save resulting outputs to AWS S3 or shared Elastic File System (EFS) volumes.

### Example Dockerfile

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY dist ./dist
COPY schema ./schema

RUN npm link

ENTRYPOINT ["annealmusic"]
```
