# AnnealMusic v8.0 · Code Health Audit (AUDIT_CODE_HEALTH.md)

This audit establishes the internal structural hygiene of the AnnealMusic codebase, covering package freshness, dead-code maps, static typing density, and parameter schema versioning drift.

---

## 1. Outdated Dependencies Matrix

Core libraries were analyzed for freshness against upstream releases:

### Node.js Frontend Dependencies

| Package               | Active Version | Target Upgrade | Upgrade Difficulty | Impact / Risk                                            |
| --------------------- | -------------- | -------------- | ------------------ | -------------------------------------------------------- |
| `typescript`          | 5.9.3          | **6.0.3**      | High               | Compiler strictness variations, syntax checking shifts.  |
| `vite`                | 5.4.21         | **8.0.14**     | High               | Major builder refactor, plugin ecosystem migration.      |
| `react` / `react-dom` | 18.3.1         | **19.2.6**     | High               | Hooks, concurrent rendering behaviors, refs transition.  |
| `react-router-dom`    | 6.30.3         | **7.16.0**     | Medium             | Future flags, Splat route resolution changes.            |
| `tailwindcss`         | 3.4.19         | **4.3.0**      | Medium             | CSS-driven config compiler, theme imports syntax update. |
| `zustand`             | 4.5.7          | **5.0.14**     | Low                | Minor API deprecation sweeps.                            |
| `lucide-react`        | 0.469.0        | **1.17.0**     | Low                | Icon asset updates.                                      |

### Python Backend Dependencies

| Package              | Active Version | Target Upgrade | Upgrade Difficulty | Impact / Risk                        |
| -------------------- | -------------- | -------------- | ------------------ | ------------------------------------ |
| `starlette`          | 1.2.0          | **1.2.1**      | Low                | Minor routing correction updates.    |
| `pydantic_core`      | 2.46.4         | **2.47.0**     | Low                | Internal parsing speed enhancements. |
| `boto3` / `botocore` | 1.43.17        | **1.43.18**    | Low                | Object storage API corrections.      |

---

## 2. Dead-Code Catalog (Knip & Vulture Logs)

Unused modules and dead declarations were mapped programmatically.

### Client-Side Dead Code (`knip` Analysis)

A selection of the structural files and unused exports identified:

1. **Unused Exports**:
   - `historyApi` (in `src/history/api.ts`)
   - `clearAdminKey` (in `src/learn/admin/adminApi.ts`)
   - `isMoreAdvanced` (in `src/learn/progress/ProgressClient.ts`)
   - `isCaptureSupported` (in `src/loop/capture.ts`)
   - `DEFAULT_GLOBAL_CONFIG` (in `src/midi/storage.ts`)
   - `AKAI_MIDIMIX_DEFAULTS` (in `src/midi/knownControllers.ts`)
2. **Duplicate Exports**:
   - `DataLogger` duplicated in default exports.
   - `writeCSV` default export duplication in `src/datalog/writers/csv.ts`.

### Backend-Side Dead Code (`vulture` Analysis)

1. **Unused Router Endpoints**:
   - `create_user` (in `api/app/routers/users.py:25`)
   - `get_me` (in `api/app/routers/users.py:33`)
2. **Unused Service Functions**:
   - `seed_clips_from_manifest` (in `api/app/services/clip_seed.py`)
   - `lessons_by_track` (in `api/app/services/curriculum_content.py`)
   - `MockEmbeddingClient` (in `api/app/services/embeddings.py`)

---

## 3. Type Coverage Analysis

- **TypeScript Coverage (`src/`)**: **97.99%** (**118,495 / 120,918** typed nodes).
  - _Analysis_: Exceptional. The frontend is extremely type-safe. The remaining 2% is confined to lazy-loaded Web Worker imports and external Tone.js bindings that lack strict index mappings.
- **Node Configuration files**: **100.00%** (**53 / 53** typed nodes).
- **Python Typing (`api/`)**: `pyright` standard checks show high coverage across FastAPI routes, though minor validation assertions in Alembic database migrations use dynamic typings.

---

## 4. Schema Versioning & Parameter Drift

AnnealMusic maps its generation patches using versioned URL query string arrays:

### URL Schema Evolution List

- **v1 (v0.2)**: Scalar physical settings (frequency multipliers, envelope timings).
- **v2 (v0.3)**: Added synthesis engine select flag (`e=<sine|fm>`).
- **v3 (v0.4)**: Added session progression modes (`m=<open|arc>`).
- **v4 (v0.6)**: Added loop slot parameters (`l1_active`, `l1_size`).
- **v5 (v0.9)**: Granular engine state parameters (`gr_density`, `gr_size`).
- **v6 (v1.0)**: Physical modular modeling matrices (`ph_string`, `ph_tube`).

### Redundant Definitions (The Source-of-Truth Smell)

The core generation schema is currently re-declared in **four distinct places**:

1. **TypeScript Definitions**: `src/types/params.ts`
2. **FastAPI Schemas**: `api/app/schemas.py`
3. **OSC Addressing Space**: `src/research/osc/OSCNamespace.ts`
4. **Python SDK Engine**: `src/research/python/` Web Worker hooks.

_Implication_: Any future parameter addition requires synchronous manual updates across all four boundaries. This duplication increases the risk of schema drift and system crashes when legacy URLs are loaded.

---

## 5. Code Health Goals for v8.1

Key targets for the **v8.1** cleanup:

1. **Eliminate Dead Exports**: 100% removal of all unused elements flagged by `knip`.
2. **Upgrade Packages**: Safely transition frontend compiler layers to TypeScript 6 and Vite 8.
3. **Type Coverage**: Increase strict typescript coverage in `src/` to `>= 98.5%`.
