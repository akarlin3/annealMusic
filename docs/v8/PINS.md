# Deliberate Package Pins & Justifications (PINS.md)

This document maps all deliberate package pins and compatibility restrictions in the AnnealMusic codebase, explaining why they are pinned and what triggers would qualify them for upgrades in future releases.

---

## 1. Python Backend Pins

### `pydantic-core` (v2.46.4)

- **Status**: Pinned exactly.
- **Justification**: Pydantic v2.13.4 requires exactly `pydantic-core==2.46.4`. Upgrading `pydantic-core` to `2.47.0` (as suggested by general health checklists) breaks the core validation framework and throws direct runtime errors on app start.
- **Upgrade Trigger**: An upgrade to a newer minor/major version of `pydantic` that explicitly supports a newer core runtime version.

### `starlette` (v1.2.1)

- **Status**: Upgraded to v1.2.1 (which maps to FastAPI compatible range `starlette>=0.46.0` / actual starlette release `1.2.1` or `0.41.x` as resolved).
- **Justification**: We use the highest available Starlette package compatible with FastAPI to ensure CORS and routing fixes are fully applied.

---

## 2. Client-Side Pins

### `pyodide` (v0.26.x / Pyodide SDK v5.4+)

- **Status**: Pinned at the current stable major/minor.
- **Justification**: Pyodide's scientific packages (NumPy, Pandas, etc.) are heavily tied to specific CPython WASM builds. Changing the version requires a complete audit of the Python Virtual File System (VFS) and REPL worker sandboxing rules to ensure scientific script sweeps keep running deterministically.
- **Upgrade Trigger**: Major upgrades to scientific dependencies in `v8.4`.

### `lucide-react` Brand Icons (Inline SVG Migration)

- **Status**: Inline SVG migration.
- **Justification**: Upgrading `lucide-react` to `1.17.0` deprecated or removed brand icons such as `Chrome` and `Github`. Rather than pinning the entire icon library to an outdated `0.469.0` release (preventing core icon freshness), we migrated all brand icons in `LoginDialog.tsx` to self-contained, inline SVG components.
- **Upgrade Trigger**: Permanent strategy; brand icons will remain inline to guarantee zero downstream compile errors.
