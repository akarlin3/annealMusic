# Contributing to AnnealMusic

Thank you for contributing to AnnealMusic! As a clinical-grade research instrument and collaborative generative music system, maintaining absolute code health, performance, and validation rigor is our highest priority.

Every contribution to `main` must adhere strictly to the following architectural disciplines:

---

## 1. Strict Typing Discipline

- **No Implicit `any`:** Implicit type conversions are banned. All new variables, parameters, and returned types must be fully declared or inferred cleanly.
- **Type Coverage Threshold:** The application must maintain **`>= 98.5%` type coverage**. Verify this locally before committing:
  ```bash
  npm run typecheck
  npx type-coverage --project tsconfig.app.json
  ```

---

## 2. Schema Source-of-Truth

- **Single Schema Contract:** The central parameter definition lives exclusively within `schema/manifest.json`. Direct manual alterations to TS type declarations, React state variables, or Pydantic backend models are strictly forbidden.
- **Schema Compiler Synchronization:** To propagate changes across the TypeScript client and Python backend, run the schema synchronization script during development and check for any drift:
  ```bash
  npm run sync-schemas
  npm run check-schemas
  ```

---

## 3. Zero-Flaky-Tests Policy

We hold a zero-tolerance policy for flaky, timing-sensitive, or non-deterministic tests in `main`.

- **Deterministic Timing:** Banish all arbitrary `setTimeout` delays or `asyncio.sleep` hacks from test suites. Programmatic timing assertions must leverage proper mock clocks, event-driven awaits, or virtual time steps.
- **Behavior-Driven Assertions:** Tests must assert verified behaviors (e.g. correct output amplitude sweeps, exact microtonal frequencies) rather than line counts or internal implementation details.
- **Failures block releases:** Any PR that drops coverage below target thresholds or introduces an intermittent failure will be automatically blocked by CI.

---

## 4. Coding & Style Standards

- **Linting & Formatting:** Ensure code is fully formatted under Prettier and passing standard ESLint criteria prior to staging:
  ```bash
  npm run lint
  npm run format
  ```
- **Commit Messages:** Follow standard semantic commit guidelines:
  - `feat(audio): ...` for new synthesis engines or mapping options.
  - `test(v8): ...` for testing suite expansion.
  - `ci(v8): ...` for CI workflow changes.
