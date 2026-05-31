# AnnealMusic v8 Refactoring, Optimization & Validation Arc Retrospective

This retrospective marks the completion of the **v8 Refactoring, Optimization, and Validation Arc** (v8.0 → v8.5). Over this cycle, the codebase transitioned from a rich feature-set environment into a hardened, highly performant, and systematically validated production application. Technical debt accumulated across prior research cycles was systematically resolved.

---

## 1. Summary of Changes and Justifications

We review the version-by-version achievements and architectural rationale across the v8 cycle:

| Version  | Focus Area                        | Key Accomplishments & Architectural Rationale                                                                                                                                                                                                                                                                                                                                   |
| :------- | :-------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **v8.1** | Code Health & Dependency Upgrades | Cleared 80+ dead files and unused imports flagged by `knip`. Upgraded core infrastructure to **Vite 8.0**, **React 19 (Concurrent Mode)**, and **TypeScript 6.0**. Resolved implicit `any` type definitions to raise strict type-coverage to `>98.5%`.                                                                                                                          |
| **v8.2** | Bundle Splitting & Performance    | Implemented route-based dynamic code-splitting for heavy libraries (ToneJS, Yjs, visualizers) to reduce the initial cold load size to `< 500 kB`. Deferred Pyodide Web Worker load on the `/research` panel. Throttled BLE GATT callbacks to conserve mobile battery drainage.                                                                                                  |
| **v8.3** | Security, Safety & Observability  | Configured `slowapi` rate limiting on `/orcid-verify` and `/gallery/search`. Established explicit `512MB` CPython runner memory constraints to prevent engine freezes. Implemented bubbles-up event listeners for AudioWorklet failures. Hardened telemetry exports via Laplace differential privacy constraints.                                                               |
| **v8.4** | Major Architectural Refactoring   | Shipped `RenderEngine` consolidating 6 distinct rendering pathways. Replaced manual parameter typing with single-source TS/Python schema compilation (`sync-schemas.mjs`). Created `TransportBridge` (Broadcast/postMessage/WebSockets/stdio) and native `CapacitorPluginBase`. Consolidated players under `SessionPlayer` mode adapters. Shipped `StorageBackend` abstraction. |
| **v8.5** | Testing, CI Hardening & Closeout  | Shipped unit test suites for `SineEngine` and waveguide dsp components, achieving targets of `>85%` core engine and `>95%` schema statement coverage. Automated 10 E2E smoke flows with hermetic Playwright mocks. hard-capped CI execution runtime budgets.                                                                                                                    |

---

## 2. What Worked Exceptionally Well

- **Schema Unification via `sync-schemas.mjs`:** Eliminating duplicate parameter declarations in favor of a single compiled JSON schema dramatically simplified parameter syncing. It wiped out drift bugs between the FastAPI backend and the React frontend.
- **Composition over Inheritance for Audio Engines:** Splitting the heavy monolithic `AnnealEngine` interface into clean capability interfaces (`StemExportableEngine`, `AssetLoadableEngine`) reduced code duplication and allowed new engines to stay slim.
- **E2E Playwright Mock Layer:** Mocking the Web Audio Context and FastAPI network layers at the Playwright level made the E2E smoke tests incredibly fast and 100% deterministic, resolving the historical flakiness of headless audio interfaces.

---

## 3. Unexpected friction points & Surprises

- **Vite 8 / React 19 Peer Conflict Complexity:** Standard third-party packages (such as `@docsearch/react` and `@tailwindcss/postcss`) threw persistent peer dependency warnings during initial upgrades. Bypassing these conflicts safely required moving brand icons to self-contained SVG inline components and using `--legacy-peer-deps` rules.
- **Waveguide Delay Suspensions:** Implementing offline audio rendering under the unified `RenderEngine` initially introduced minor timing offsets relative to the real-time context. Reconciling this required enforcing strict sample-rate alignment and sample-precise time counters across the Node environment.

---

## 4. Remaining Design Debt & Backlog

- **Worklet Polyfills:** Web Audio Worklets are not fully supported on some legacy mobile Android WebView layers. Native Web Audio fallback structures are functional but produce lower voice densities.
- **Visual Regression Testing:** While the E2E smoke matrix asserts structure, canvas and visualizer animations are not visually diff-checked. Visual regression testing remains flagged for the v9 roadmap.

---

## 5. Post-v8 Thesis Space

With AnnealMusic now operating as a highly performant and stable instrument, we look forward to the next innovation cycle:

- **Thesis A (Instrument Company):** Deep physical integration with Eurorack hardware, MIDI 2.0, MPE, and custom high-fidelity physical controllers.
- **Thesis C (Performance Platform):** Shared collaborative streaming channels and online ambient listening rooms.
- **Thesis E (User-Uploaded Engines):** Enabling developers to securely upload and run custom AudioWorklet synthesis logic in our sandboxed runtime.
- **Thesis L (Accessibility-First Audio):** Refactoring the entire visual interface to support screen-reader-first generative compositions.
