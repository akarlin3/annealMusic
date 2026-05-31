# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [9.3.0] - 2026-05-31

**v9.3 Polish & Closeout.** This release completes the v9 multi-mode arc. It migrates all remaining deferred tail components (login dialogues, patch generation and modification dialogues, and admin moderation and curation surfaces) to dynamic design-system token primitives (`Input`, `Select`). It resolves key edge cases across modes: suppressing technical/sonification notifications under Meditation mode, persisting unsaved patch parameters and creative sub-modes (`sketch` vs. `drone`) during mode switches, and adding cross-mode relevance badges to recommended lessons in `NextLessonPicker`. Finally, it completes a comprehensive WCAG 2.1 AA accessibility and contrast review across all theme modes, checking prefers-reduced-motion triggers, and tags the final `v9.3.0` release.

### Added

- **Design System Primitives:** Shipped dynamic, token-based `Input.tsx` and `Select.tsx` primitives supporting dynamic colors and prefers-reduced-motion multiplier overrides.
- **Form Migrations:** Refactored `AccountSettingsPage.tsx`, `LoginDialog.tsx`, `GeneratePatchDialog.tsx`, `ModifyPatchDialog.tsx`, `LibraryCuration.tsx`, `MappingTemplateEditor.tsx`, and `AdminPage.tsx` to utilize the new primitives.
- **Cross-Mode Notification Filtering:** Updates the global toast listener inside `App.tsx` to automatically suppress technical render, MIDI, and AI notifications under Meditation mode.
- **Mid-Task Parameter Persistence:** Automatically caches active patch parameters to `am_unsaved_patch_state` in `localStorage` on parameter changes and hydrates on load if no URL hash exists.
- **Sub-Mode State Recovery:** Caches and recovers active creative sub-mode settings (`sketch` vs. `drone`) during transitions between Musician and Meditation modes.
- **Cross-Mode Lesson Relevance Badges:** Integrated mode-mismatch checks into `NextLessonPicker.tsx` to render a gentle helper badge explaining relevance across modes.
- **Accessibility & Contrast Audit:** Verified WCAG AA contrast ratio compliance (>= 4.5:1), visible keyboard focus rings, and prefers-reduced-motion media query transition disables.
- **Release Documentation:** Authored `docs/V9_RETROSPECTIVE.md`, finalized `docs/MODES.md` and the `docs/design/` catalog, updated `docs/ROADMAP.md` and created `docs/v9/TUTORIAL_AUDIT.md`.

## [9.2.0] - 2026-05-31

**v9.2 Tutorial Gap Audit + Authoring.** This release delivers a comprehensive educational surface audit and resolves tutorial coverage gaps across the entire platform. It introduces a database-backed, mode-aware curriculum filter, immersive skippable onboarding flows per focus mode, modular sliding parameter help drawers, and expanded scientific documentation.

### Added

- **Pedagogical Surface Audit:** Executed a systematic coverage audit across every user-facing surface (v0.1–v8.5) spanning discoverability, onboarding clarity, and tutorial availability. Documented findings and matrices in `docs/v9.2-PLAN.md`.
- **Database Schema & Alembic Migration:** Added SQLite and PostgreSQL compatible `modes` text array and `onboarding_mode` columns to the `lessons` table (`0030_v9_2_lesson_modes.py`).
- **Targeted Gap-Fill Lessons:** Seeded 6 detailed gap-fill lessons (`gallery-sharing`, `mindfulness-practice`, `midi-input-mapping`, `research-telemetry`, `python-sandbox`, `psychoacoustic-studies`) and 3 onboarding lessons to the curriculum database.
- **Original Audio Clips:** Expanded the audio library with 4 new original clips (`ref-solfeggio-528`, `ref-midi-sweep`, `ref-heart-pulse`, `ref-latin-square`) to support audio-clip steps in the new lessons.
- **Quiet, Skippable Onboarding:** Built elegant, non-intrusive onboarding lessons for Meditation (🧘), Musician (🎹), and Researcher (🔬) modes that play automatically upon first mode activation and persist dismissal state stickily to `localStorage`.
- **Active-Mode Curriculum Filters:** Integrated dynamic active-mode badge filters into the curriculum browser with an override toggle to display all lessons.
- **Inline "?" Help Tooltips & Sliding Drawers:** Authored a modular, glassmorphic Help drawer system and integrated it into synthesis coupling, target LUFS, and segment duration parameters.
- **Scientific API & Roadmap Updates:** Formalized detailed documentation for GATT biofeedback services, Williams Latin Square counterbalancing, reproducibility validation, and mode onboarding inside `docs/API.md`. Marked `v9.2` as successfully completed in `docs/ROADMAP.md`.

## [9.1.0] - 2026-05-31

**v9.1 Aesthetic System.** Establishes a comprehensive, unified design system with per-mode aesthetic variations. The warm-amber-dark identity is preserved across all modes, while color saturation, background depth, spacing density, motion duration, typography weight, and ornamentation scale dynamically based on the active mode (Meditation deeper dark, Musician standard, Researcher clinical). Features a complete canonical component library (`Button`, `Slider`, `Panel`, `Card`), automated prefers-reduced-motion transitions, minimum 44px touch-target bounds, customized WebGL/Canvas visualizer presets, and 2D text telemetry overlays.

### Added

- **Design Tokens System:** Implemented a single source-of-truth token registry (`tokens.ts`) defining colors, typography weights, line heights, spacing multipliers, motion durations, and icons.
- **Dynamic ModeAesthetic Provider:** Built `ModeAesthetic.tsx` to automatically compile tokens into scoped CSS variables on the document element, including media overrides for `prefers-reduced-motion` and global typography styling.
- **Canonical Components:** Added `Button.tsx`, `Slider.tsx`, `Panel.tsx`, and `Card.tsx` under `src/design/components/`, establishing standard visual signatures with complete touch-safe bounds.
- **Visualizer Presets & Overlays:** Enhanced WebGL and Canvas visualizers to scale orbit speeds, bloom radii, and background opacities per mode. Added a transparent 2D overlay canvas in `Visualizer.tsx` to render high-contrast frequency telemetry labels in Researcher mode.
- **Comprehensive Reference Manuals:** Documented all specifications, templates, and accessibility audits under a dedicated `docs/design/` catalog.
- **Robust Integration Testing:** Delivered unit tests in `modeAesthetic.test.tsx` and `components.test.tsx`, validating all visual modes, DOM attributes, and slider/button handlers.

### Changed

- **Component Migration:** Upgraded `CopyLinkButton.tsx` to consume the new canonical components.
- **Tabular Monospace Numerics:** Standardized class `.tabular-nums` across telemetry displays to enforce tabular monospace alignment.

## [9.0.0] - 2026-05-31

**v9.0 Mode Foundation & Audit.** Elevates the concept of "Focus" from a nested toggle inside the Sketch UI to a first-class, top-level navigation primitive: **Meditation Focus Mode** (🧘), **Musician Sandbox Mode** (🎹), and **Research Interface Console** (🔬). This release establishes the core mode-aware routing, layout, and metadata filtering foundations, with sticky per-device storage synchronization and strict adherence to a "soft gating" layout policy where direct bookmarks and URLs remain completely functional.

### Added

- **Sleek Segmented Switcher UI:** Built `ModeSwitcher.tsx` offering a responsive switcher displaying emojis (🧘 / 🎹 / 🔬) with absolute sliding-pill animations.
- **Onboarding Mode Picker:** Designed `FirstTimeModePicker.tsx`, a premium glassmorphic onboarding overlay showing glowing card layouts to direct new arrivals smoothly into their preferred focus mode.
- **Global Key Cycle Shortcut:** Registered a global `Shift+M` window keyboard listener to sequentially cycle focus modes with elegant transient toast feedback and landing redirects.
- **Unified Responsive Header:** Integrated `Header.tsx` to centralize logo, switcher, and account widgets, synchronizing layout visibility seamlessly across SPA boundaries.
- **Dynamic Curriculum Lesson Filters:** Configured `LearnApp.tsx` lesson lists with dynamic filters, instantly organizing curriculum items by track affinity tags matching the user's active focus.
- **State and Submode Enforcement:** Enforces the ambient visualizer to default strictly to `drone` mode when in Meditation Mode to keep visual and auditory elements calm.
- **Robust Integration Testing:** Delivered `src/mode/__tests__/mode.test.tsx` achieving complete automated test coverage of switcher transitions, mock storage persistence, cycle shortcuts, and picker events.

### Changed

- **Platform-Synchronized Storage:** Bound mode state to the `am_app_mode` persistence key, utilizing native Capacitor Preferences on iOS/Android and localStorage on web.
- **Soft Gated Route Redirects:** Initial root arrivals at `/` redirect Meditation to `/listen` and Researcher to `/research.html`, while bookmarking direct sub-paths (e.g. `/gallery`) preserves exact routing navigation.

## [8.5.0] - 2026-05-31

**v8.5 Test Coverage, CI Hardening, and v8 Release Closeout.** The final version 8 closeout milestone. Hardened validation and release infrastructure across all domains. Achieved and verified strict target test coverage metrics (>85% statement coverage on Audio Engine Core, >95% on Schema / State Management, and >80% on Server API endpoints). Automated the complete 10-flow E2E smoke test matrix into a robust Playwright suite, ensuring zero flakiness. Enforced a tight <8 minute PR runtime budget in CI through dynamic thread optimization, node/pip caching, and sharded nightly builds. Formulated the complete v8 Retrospective, finalized all v8 audit and threat model documentation, updated Contributing instructions with strict quality disciplines, consolidated multi-version Stability Commitments, and tagged the final `v8.5.0` release.

## [8.4.0] - 2026-05-31

**v8.4 Substantial Refactor.** A comprehensive structural optimization milestone consolidating redundant pathways and completing core interfaces. Successfully retired design debt across seven key target areas: consolidated six distinct render pathways into a single environment-agnostic `RenderEngine`, resolved all schema duplications with polymorphic validation in `schema/manifest.json`, unified all JSON-RPC 2.0 transport layers into a single `Transport` contract, modularized the audio engine interface via composition, shipped a shared native `CapacitorPluginBase` on iOS and Android, consolidated the session player modes into `SessionPlayer`, and introduced a robust `StorageBackend` abstraction layer.

### Added

- **Unified Render Paths:** Defined a core `RenderEngine` interface with concrete adapters for Browser-Offline (`BrowserOfflineRenderEngine`), Node-Offline (`NodeOfflineRenderEngine` using `node-web-audio-api`), and Playwright-Browser (`BrowserPlaywrightRenderEngine`).
- **Polymorphic Schema Centralization:** Centralized polymorphic schemas (sonification mappings, study export manifests, lesson steps, clinical responses) directly in `schema/manifest.json`.
- **JSON-RPC Bridge Transport Unification:** Built a unified `Transport` interface on top of `BroadcastTransport`, `PostMessageTransport`, `WebSocketTransport`, and `StdioTransport`.
- **Modular Audio Engines:** Modularized `AnnealEngine` through composable typeguards (`isStemExportable`, `isAssetLoadable`, `isDynamicModulatable`).
- **Capacitor Plugin Base:** Authored native mobile `CapacitorPluginBase` on iOS (Swift) and Android (Java) and migrated `BiofeedbackBridgePlugin`, `HealthBridgePlugin`, and `OSCBridgePlugin` to extend it.
- **Unified Session Player:** Created a single `SessionPlayer` that manages all playback and tick timelines, delegating custom modes to adapters.
- **Storage Abstraction:** Introduced `StorageBackend` contract with concrete `LocalStorageBackend`, `CapacitorPreferencesBackend`, and `HybridStorageBackend` adapters.

### Changed

- **Zero-Drift Sync Script:** Extended `scripts/sync-schemas.mjs` to auto-compile models and fail builds on schema drift.
- **Robust Storage Rehydration:** Awaits platform-specific storage rehydration on anonymous ID cookie recovery to prevent microtask race conditions.

## [8.3.0] - 2026-05-31

**v8.3 Observability & Safety.** Shipped a privacy-first diagnostics and safety hardening pass, implementing zero-telemetry first-run glassmorphic consent modals, client-side PII scrubbing, dynamic URL path filters, and self-hosted server error collection. Hardened security boundaries with strict route rate limiting, selective HTML Content-Security-Policy (CSP) headers, and Unix sandboxed execution memory limits (MAX_MEM = 512MB) with graceful cross-platform ValueError support.

### Added

- **Privacy-First Client Telemetry:** Created a centralized browser error reporting system (`errorReporter.ts`) that listens to unhandled exceptions, promise rejections, Web Audio dropouts, and WebSocket disconnects.
- **Glassmorphic Consent Prompt:** Implemented a premium, responsive first-run consent dialog (`consentDialog.tsx`) and added an easily accessible toggle in the Account Settings.
- **Self-Hosted Crash Reports:** Designed a dedicated, secure server route (`/api/v1/observability/crash-reports`) to capture and aggregate anonymized diagnostic reports.
- **SLO Latency Tracking & Alerting:** Instrumented FastAPI request middleware to track target API latencies and check breach durations, triggering out-of-band operator alerts.
- **Grafana & Prometheus Infrastructure:** Defined Grafana dashboards as code and Prometheus Alertmanager alerting rules as code.
- **STRIDE Architectural Threat Model:** Authored a formal threat assessment at `docs/v8/THREAT_MODEL.md`.
- **Responsible Disclosure & Policy:** Created RFC 9116 security contact (`security.txt`), a public disclosure policy (`SECURITY.md`), and researcher credits (`SECURITY_ACKNOWLEDGMENTS.md`).

### Changed

- **Client-Side Data Scrubbing:** Automatically strips email addresses, user IDs, and auth tokens, and replaces dynamic slugs with `:slug` or `:id` before sending crash reports.
- **SlowAPI Route Rate Limiting:** Applied strict IP-based rate-limiting decorators to sensitive ORCID verification (5/min) and gallery search (15/min) endpoints.
- **Selective CSP Headers:** Hardened HTML-serving routes (`/embed`, `/learn`, `/research`) with strict script boundaries, mixed content blocking, and frame-ancestors limits, while preserving standard JSON responses.
- **Sandboxed Execution Memory Caps:** Enforced a `MAX_MEM = 512MB` limit on custom Python validation runs using Unix `resource.setrlimit`, with a cross-platform ValueError exception wrapper.
- **Extended Study Audit Log:** Added Magic Link requests, OAuth link/unlink events, and explicit telemetry consent changes to the immutable `StudyAuditLog`.

## [8.2.0] - 2026-05-31

**v8.2 Performance Pass.** Shipped a comprehensive performance sweep across initial app boot latency, runtime CPU consumption, mobile BLE power thermals, and active memory retention. Route-level lazy loading and dynamic Yjs/CRDT code-splitting successfully reduced eagerly-loaded bundles by >250KB, beating all target budgets.

### Added

- **Dynamic Yjs Code-Splitting.** Decoupled Yjs and collaborative synchronization modules, dynamically loading CRDT synchronization libraries only when a jam session starts or is joined. This tree-shakes Yjs out of the eager main entrypoint bundle.
- **WebGL Uniform Update Caching.** Implemented a WebGL uniforms state cache (`uCache`) inside `WebGLRenderer.ts`, skipping redundant uniform uploads for static parameters to decrease GPU draw-overhead.
- **Strict 60-Second Loop Clamp.** Enforced strict 60-second limits in the loop pedal `loadBuffer` and `commit` routines using `getChannelData` subarray copying, capping loop audio memory allocations.

### Changed

- **Inner-Loop DSP Parallelization.** Refactored physical modeling `ModalBank` from biquad objects to flat parallel `Float32Array` buffers for `b0`, `b2`, `a1`, `a2`, `z1`, `z2`, and `gain` coefficients, bypassing object dereferencing overhead in sample-by-sample loops.
- **Modulo Operations Bypass.** Replaced index wrapping modulo calculations (`%`) in Karplus-Strong waveguide `string.ts` and waveguide clarinet `tube.ts` with ternary bounds checks.
- **BLE GATT State Throttling.** Configured Polar H10 BLE notify callbacks to space updates to at most once per 200ms with a leak-proof queueing mechanism, preventing rapid successive Zustand store updates while preserving uncorrupted R-R values for HRV.
- **Datalogger GC Pressure Reduction.** Eliminated double `JSON.stringify` calls on active tick logging in `DataLogger.ts`, introducing a constant-time O(1) footprint estimator.

## [8.1.0] - 2026-05-31

**v8.1 Code Health & Dependency Upgrades.** Resolve the code health audit findings from v8.0. Safely upgraded client stack (TypeScript 6, Vite 8, React 19, React Router 7, Tailwind 4, Zustand 5, Lucide-React 1.17), unified parameter schemas under a compile-time generator, removed dead exports and duplicate exports flagged by static analysis, and secured a strict frontend type-coverage benchmark of 98.68%.

### Added

- **Compile-Time Schema Syncing.** Authored `scripts/sync-schemas.mjs` to auto-compile parameters dynamically from a single canonical `schema/manifest.json` into client and CLI validation commands, failing builds on schema drift.

### Changed

- **Dependency Upgrades.** Upgraded frontend to Vite 8.0.14, TypeScript 6.0.3, React 19.2.6, React Router 7.16.0, Tailwind CSS 4.3.0, and Zustand 5.0.14, and backend to Starlette 1.2.1 and Boto3/Botocore 1.43.18.
- **Strict Frontend Type Coverage.** Refactored `PulseEngine` and `crdt.ts` to enforce uniform, strict type boundaries, increasing TypeScript type coverage across the client bundle from 98.00% to 98.68%.

### Removed

- **Dead-Code Catalog.** Cleaned up all unused and duplicate exports identified by static analysis across client-side and backend files (e.g. `historyApi`, `clearAdminKey`, `isMoreAdvanced`, `isCaptureSupported`, `lessons_by_track`).

## [8.0.0] - 2026-05-31

**v8.0 Audit + Plan.** The diagnosis slice. v8.0 produces no shipped product code changes, introducing only essential non-invasive baseline instrumentation and delivering the comprehensive primary audit reports and sequenced roadmaps for the entire subsequent v8 refactoring arc (v8.1–v8.5).

### Added

- **Detailed Scope Plan.** Authored the foundational checkpoint strategy (`docs/v8.0-PLAN.md`) detailing audit domains, analytical tools, measurement methodologies, and mathematical prioritization scoring.
- **Empirical Performance Audit.** Compiled baseline measurements (`docs/v8/AUDIT_PERFORMANCE.md`) detailing route-specific bundle weights, initial audio boot latencies, CPU and memory stress profiles, and mobile resource targets.
- **Observability & Safety Audit.** Formulated a STRIDE threat model document (`docs/v8/AUDIT_OBSERVABILITY_SAFETY.md`) spanning data storage boundaries, user-uploaded schemas, sandboxed execution limitations, and silent logging gaps.
- **Code Health Audit.** Documented package version matrices (`docs/v8/AUDIT_CODE_HEALTH.md`), dead-code catalogs via `knip` and `vulture`, TypeScript type coverage benchmarks (97.99%), and historical URL schema versioning drift analysis.
- **Architectural Refactor Proposals.** Proposed six targeted, high-impact structural designs (`docs/v8/REFACTOR_PROPOSALS.md`) covering render path unification, single-source schema syncing, unified transport bridges, modular audio engines, and local Pyodide caching.
- **Milestone Plan.** Synthesized the prioritized master work roadmap (`docs/v8/V8_PLAN.md`) for v8.1–v8.5 with concrete success criteria.

## [7.7.0] - 2026-05-31

**v7 Closeout & Collaboration Infrastructure.** v7.7 closes the v7 research-collaboration arc by establishing comprehensive onboarding, publishing guides, legal partnership templates, legal postures, retrospectives, stability commitments, and tag v7.7.0.

### Added

- **ICAD & Clinical Community Manuals.** Authored domain-specific onboarding and publishing guides for sonification researchers (`docs/community/icad/`) and clinical investigators (`docs/community/clinical/`), complete with recipes and case studies (physics coordinate sweeps, rainforest canopy, SecOps sync, HRV biofeedback, auditory fatigue).
- **Five Partnership Templates.** Formulated drop-in legal templates (`docs/templates/`): IRB Consent forms (physio opt-ins, GDPR data shredding), NSF/NIH Data Management Plan (DMP) boilerplates, secure Software Collaboration Agreements establishing a zero-strings infrastructure posture, Citation Guide, and peer-review Supplementary Materials Checklists.
- **Academic Legal Posture & Disclaimers.** Shipped a transparent legal posture document (`docs/LEGAL_POSTURE.md`) defining data ownership boundaries and co-authorship policies.
- **v7 Retrospective & Stability Commitments.** Published the v7 arc retrospective (`docs/V7_RETROSPECTIVE.md`) and API/Schema stability commitments (`docs/STABILITY.md`) covering relational database schemas, Pyodide worker environments, datalogger structures, and OSC namespaces.

## [7.6.0] - 2026-05-31

**Scientific Communication Tools.** v7.6 empowers researchers to publish, embed, and disseminate their sonifications and listening sessions as rich, accessible, and citable academic outputs alongside traditional figures and tables.

### Added

- **Headless Video & Image Render Services.** Built Playwright off-screen Chromium viewport orchestrations in `api/app/services/video_render.py` capturing synchronized visualizer canvas streams and Web Audio destinations. Includes non-blocking FFmpeg subprocess transcoding of WebM to standard H.264/AAC MP4.
- **Ultra-Compact Figure Embed Widget.** Developed a high-performance, plain Vanilla TypeScript iframe player route (`/embed-figure/:slugOrId`) under a strict `< 30 KB` gzipped bundle budget. Integrates real-time AudioContext waveform drawing, custom speed/tempo selectors, high-contrast visualizer options, and BibTeX/DOI citation modal overlays.
- **Presenter Slide Mode.** Designed a distraction-free Beamer-ready presentation route (`/talk/:slugOrId`) with a spacebar-triggered orbits visualizer, auto-hidden hover HUD controls, and robust pre-cached offline audio fallback resilience.
- **Accessibility Database & Audited Transcripts.** Implemented PostgreSQL/SQLite schemas (`AccessibilityDescription`) and auto-description engines parsing raw mapping specifications into textual descriptions, with a secure React `AccessibilityEditor` panel workspace for manual PI curations.
- **Social Card Packs (Outreach Cards).** Packaged CC-BY 15-second looping video abstracts, pinned citations, and descriptive summaries carrying dynamic Open Graph tags (`og:video`, `og:image`) for elegant Slack, Discord, and Twitter/X previews.
- **Comprehensive Documentation Guides.** Authored detailed researcher publishing guide `docs/PUBLISHING.md` and inclusive accessibility systems reference `docs/ACCESSIBILITY.md`.

## [7.5.0] - 2026-05-31

**Clinical Study Export & Reproducibility.** v7.5 enables clinical and sonification studies to be fully reproducible from a single self-contained export bundle. It bundles everything needed for peer review or replication — version locks, stimuli states, clinical protocols, optional anonymized participant logs with differential privacy, analysis scripts, sample data, and BibTeX citations — into a single archive with sufficient metadata to reproduce results months or years later.

### Added

- **Reproducible ZIP Assembler & Exporter Service.** Built backend `StudyExport` database model, migration, and export service (`study_export.py`) which compiles all linked stimuli, protocols, raw calibrated audio, researcher-authored Python scripts, and anonymized database records into a single `.zip` file.
- **Strict Asset SHA-256 Hashing & Version Locking.** The manifest registry records the exact hashes (SHA-256) of every stimulus, protocol, data record, and audio calibration asset, locking specific synth engine models, schemas, and whitelisted packages to completely prevent heuristic-drift over years of archive storage.
- **IRB & GDPR Compliance Anonymization Pipeline.** Implemented an anonymizer shifting all absolute timestamps to relative offsets in seconds from the session's start, masking direct participant IDs with random UUIDs, and optionally injecting **Differential Privacy (Laplace noise)** to subject response metrics with compliance PI attestation.
- **Premium Glassmorphic Auditor Portal.** An interactive auditor console at `/reproduce` with smooth micro-animations and glowing metrics, allowing peer-reviewers or auditors to upload ZIP bundles, validate schemas/hashes, re-render and compare wave files (via bit-identical, perceptually, or statistically equivalent metrics), execute Python analysis scripts in isolated processes, and review detailed checklists.
- **Extended Node CLI Command Suite.** Shipped new standalone CLI tools `export` (streams zipped bundles from backend API) and `reproduce` (local reproduction engine performing offline file unpacking, schema checks, offline stimulus audio rendering, and script execution), plus updated `validate` support for ZIP manifests.
- **Academic Research Documentation Guides.** Authored researcher handbook `docs/STUDY_EXPORT.md` (export configurations and GDPR details) and peer-reviewer guide `docs/REPRODUCIBILITY.md` (detailed explanation of the validation steps).

## [7.4.0] - 2026-05-31

**Biofeedback Ingest.** v7.4 bridges the dynamic data-mapping engine (v7.1) and clinical research framework (v7.2) with live, multi-modal physiological feedback streams (HRV, breath rate, EEG, GSR) driving real-time audio modulation and clinical session capture over WebSerial, Web Bluetooth, WebHID, and native iOS/Android BLE bridges.

### Added

- **Unified Biosignal Adapter Architecture.** Defined standard channel schema and custom asynchronous observable stream structures supporting both high-frequency raw telemetry (EEG, GSR) and event-based interval packets (HRV).
- **Consumer & Research Hardware Drivers.** Shipped production-ready, dependency-free decoding adapters for Polar H10 (Web Bluetooth Heart Rate Service with R-R intervals), Polar Verity Sense, OpenBCI Cyton (raw EEG packet parsing over WebSerial), Muse 2 (EEG delta telemetry over Web Bluetooth), and Empatica E4 placeholder.
- **Dynamic Sonification Bindings.** Registered `'live-biosignal'` source mapping type in the sonification player engine, enabling real-time physiological metrics to dynamically modulate synthesizer parameters (e.g. Kuramoto coupling, FM modulation index, or filter cutoff frequencies).
- **Zustand Telemetry Store & Connection UI.** Implemented `useBiofeedbackStore` for pairing, battery telemetry, signal quality, and live values, coupled with a premium glassmorphic, responsive pairing modal console.
- **Physiological Channel Opt-In.** Added GDPR-compliant per-channel opt-in checkboxes directly on the Clinical Runner Consent screen, ensuring explicit participant agreement before active ingestion.
- **Resting Baseline Calibration Wizard.** Integrated a step-by-step visual baseline calibration component (`CalibrationFlow.tsx`) into the clinical runner before active sound trials, calculating mathematical constants (e.g., SDNN for HRV) to calibrate synthesizer parameter modulation ranges.
- **Parquet Telemetry Stream Uploads.** Session runner logs and uploads compressed json stream packets on-the-fly to FastAPI, storing files securely on the server and linking them to `ClinicalSessionRecord`.
- **GDPR Cascade Shredding & Compliance.** If a subject withdraws and elects to "Discard All Telemetry", both the database record and the physical storage files are permanently deleted (cascade shredded) from S3/local storage, retaining only secure consent/withdrawal audit logs for ethics proof.
- **Native iOS & Android Capacitor Plugins.** Built native iOS Swift (`BiofeedbackBridge.swift`) and Android Java/Kotlin (`BiofeedbackBridgePlugin.java` / `BiofeedbackBridge.kt`) plugins wrapping BLE GATT Heart Rate peripherals, with integrated mock simulator streams for seamless device testing in virtual simulators.

## [7.3.0] - 2026-05-30

**Sonification Library & Recipes.** v7.3 establishes the content and content-tooling layer of AnnealMusic's interpretive sonification engine, exposing a curated catalog of 20 canonical mapping templates across 4 families (Time Series, Scalar Fields, Networks, Structured Events), complete with dynamic auto-calibration safeguards, a gorgeous interactive researcher console panel, curated editorial gallery blocks, and a compiled handbook `docs/SONIFICATION_RECIPES.md` based on rigorous academic citations and honest limitation disclosures.

### Added

- **20 Canonical Sonification Mappings.** Curated databases of 20 mappings spanning time series, spatial coordinates, network centralities, and categorical log events, seeded programmatically with academic origins (ICAD, Hermann, Worrall, Kuramoto) and step-by-step instructions.
- **Dynamic Auto-Calibration.** Server-side and client-side data inspection that scans uploaded CSV/JSON column min/max bounds and dynamically scales values into safe synthesizer ranges, preventing frequency saturation and auditory clipping.
- **Sonification Panel Dashboard.** An elegant glassmorphic researcher panel inside `/research` enabling CSV/JSON file uploads, column bindings, auto-calibration, and instant synthesis orchestration runs.
- **URL Hash Deep-Linking.** Standard URL hashes (e.g. `#template=slug`) automatically load template specifications, trigger tab switches to `/research#sonification`, and open the Instantiate dialog pre-populated for a seamless end-to-end sandbox transition.
- **Scientific Sonifications Gallery.** Curated scientific cards on the `/listen` (LibraryPage) editorial tab with click-to-sandbox links.
- **Academic Citation & Honest Limitations.** Full Markdown recipes for each template including a mandatory "Limitations" section describing what the display abstracts or obscures.
- **Compiler Script & Recipe Handbook.** Command line compilation script (`api/scripts/export_recipes.py`) exporting database configurations into a gorgeous `docs/SONIFICATION_RECIPES.md` reference guide.

## [7.2.0] - 2026-05-31

**Clinical Stimulus-Grade Audio.** v7.2 shifts AnnealMusic from basic behavioral studies (v5.6) to clinical research level rigor: precisely calibrated levels, cryptographically randomized double-blind/single-blind condition counterbalancing, sub-millisecond scheduled auditory onset timing, continuous breathing pacing feedback, and IRB-compliant withdrawals disposition audits.

### Added

- **Physical SPL Level Calibration.** Investigator calibration dashboard play tool playing a 1kHz sine reference tone at -20 dBFS, logging measured decibel values from headphones/speakers using physical SPL meters, and automatically multiplying subsequent participant stimulus playback gain parameters by $G_{cal} = 10^{(G_{offset}/20)}$ safely without digital clipping.
- **Williams Latin Square Randomization.** Seeded Counterbalancing engine deterministic mapping row distribution mathematically to enrollment counters on the server (`enroll_subject`), completely removing researcher selection bias in double-blind protocols. Supports simple cryptographic hashes and permuted block configurations of treatment sizes $2N$.
- **Time-Locked Onset Scheduling.** Web Audio `AudioContext.currentTime` scheduling of comfortable audio comfort safeguard signals and tone playbacks, monitoring event loop callbacks vs thread clock times to compile real-time latency and onset callback jitter reports.
- **Symptom Capture & Adverse Events.** Float overlay trigger allowing subjects to halt audio playbacks instantly, report category descriptors of discomfort (hearing strain, ringing, anxiety, headache), and log absolute timestamps with sub-second offsets relative to stimulus starts.
- **IRB-Compliant Telemetry Withdrawal.** If a subject terminates participation early, the console halts audio instantly and presents a clear post-withdrawal data choice: Discard All Telemetry (completely shreds subjective inputs, survey values, and physical level recordings from the database, retaining only secure consent/withdrawal audit logs for human-subjects ethics verification) or Retain Partial Data.
- **Stimulus Integrity Hashing.** Computes browser SHA-256 validation proof over active condition parameter arrays, registering the cryptographic checksum within the session record's `stimulus_sha256` column.
- **Outfitted Minimalist Glassmorphic UI.** Isolated, distraction-free clinical runner console (`src/clinical/SubjectRunner.tsx`) served at `/clinical/:slug` removing all standard app headers, footers, and menu navigations, styled with stone-dark backdrops, Outfit/Inter typography, and visual breathing pulse ring.
- **Documentation.** Created `docs/CLINICAL_DEFAULTS.md` and `docs/CLINICAL_TIMING.md` references outlining browser/driver hardware latency ceilings and IRB-approved default screening templates.

## [7.0.0] - 2026-05-31

**The v7 research-collaboration arc opens.** v7.0 ships the shared substrate that the clinical-research (v7.2/v7.4/v7.5) and sonification (v7.1) tracks build on: a multi-investigator **Study** model with provenance, immutable snapshots, and per-study Zenodo DOIs. No clinical or sonification features yet — only the collaboration primitives.

### Added

- **Studies — the unit of scientific work.** A **Study** (`/research` → **Studies** panel) is a versioned, citable bundle of investigators + linked resources (stimuli, protocols, datasets, analysis scripts) with full provenance. New tables (migration `0025_v7_0_studies`): `studies`, `study_investigators`, `study_resources`, `study_versions`, `study_audit_log`, plus `accounts.orcid` / `accounts.affiliation_ror`.
- **Multi-investigator workflows.** Roles `pi` / `co-investigator` / `analyst` / `viewer` with a strict permission matrix enforced by a single `require_study_role` helper: only a PI adds/removes investigators or publishes; co-investigators edit the study + link/unlink resources; analysts read everything and may add `analysis` resources only; viewers are read-only. A study always retains at least one PI (`409 last_pi`).
- **Provenance.** Every mutation is written to `study_audit_log` `(timestamp, account_id, action, before, after)` through one write-path (`app/study_provenance.py`) — the heuristic-drift guard. A per-study **audit sidebar** surfaces the trail; reads are never logged.
- **Snapshots & versions.** `POST /studies/:id/snapshot` freezes the study + investigators + **resolved resource metadata and content hashes** into an immutable `study_versions` row (binary payloads are never copied, so snapshots stay KB-scale and survive later deletion of a source resource). Versions are append-only and immutable.
- **Citations.** `GET /studies/:id/citation?format=bibtex|apa|chicago` renders citations server-side (`app/services/citation.py`, pure + unit-tested), PI-first author ordering with ORCID. Unpublished studies cite via their `/s/<slug>` URL. The CLI `annealmusic cite` gained a `--format` flag and `tools/cite/` gained APA + Chicago generators alongside BibTeX.
- **Zenodo DOI minting.** `POST /studies/:id/publish` (PI-only) runs a pre-flight checklist (abstract, ethics statement, ≥1 PI, every investigator has an ORCID) then mints a **concept DOI** (per study) + **version DOI** (per snapshot) via `app/services/zenodo.py`. Robust HTTP: bounded exponential backoff on 5xx/429/network errors (honoring `Retry-After`), no retry on 4xx. Defaults to the Zenodo **sandbox**; with no token configured it runs a deterministic **stub** so publish flows are testable offline/in CI.
- **Researcher identity.** `PATCH /api/v1/account/me` now accepts `orcid` (format-validated) and `affiliation_ror` (a `https://ror.org/<id>` URL); both flow into citations and Zenodo deposition metadata.
- **Studies UI** (`src/studies/`): `StudiesPanel` (list + create), `StudyView` (metadata editor + versions + audit sidebar), `InvestigatorManager`, `ResourceLinker` (multi-kind picker), `SnapshotDialog`, and `PublishFlow` (pre-flight checklist → DOI), wired in as a new **Studies** tab in the research console.

### IRB-friendly framing

- **Anonymous-first preserved.** Studies require an authenticated account, but a study marked `visibility='public'` (plus its citation) is readable by anyone, anonymously. Private studies return **404** (not 403) to non-investigators, so their existence is never leaked. The public study **gallery UI** is deferred (v7.6); the `visibility` flag + public read/cite ship now.
- **Controlled lifecycle.** `published` is reachable only via the publish flow (which mints the DOI) and `archived` only via `DELETE`; a direct `PATCH` cannot fake either state. AnnealMusic remains **not a data processor by default** — v7.0 ships the collaboration framework; subject-data instantiation lands in v7.2/v7.4/v7.5.

### Docs & release

- **`docs/STUDIES.md`** — multi-investigator workflow guide (roles, snapshots, publishing).
- **`docs/CITATION.md`** — per-study/per-version DOIs and the three citation formats, extended from the v5.7 project-citation tooling.
- `docs/v7.0-PLAN.md` — the CP0 design (data model, permission matrix, snapshot semantics, audit scope, Zenodo design, risks).
- `README.md` Studies subsection; `docs/ROADMAP.md` marks **v7.0 ✅**.

## [6.5.0] - 2026-05-31

**The v6 education arc closes.** v6.5 adds the admin analytics that let the curriculum be iterated, the in-app discoverability that lets lessons be found, and the retrospective + release that close v6.0–v6.5.

### Added

- **Lesson analytics (admin-only, aggregate, anonymized).** A new **Analytics** tab in the `#admin` console (`src/learn/admin/AnalyticsPage.tsx`), backed by `GET /api/v1/admin/analytics/lessons`, `/lessons/{id}`, `/tracks`, `/clips` and `POST /api/v1/admin/analytics/refresh` — all behind the existing `x-admin-key` gate.
  - **Per-lesson:** view count, completion rate, average time-to-complete, a step-by-step **drop-off curve**, per-step time-on-step distribution, prompt "I tried it" vs skip ratio, and reflection-presence rate.
  - **Per-track:** aggregate completion + **path popularity** — the lesson sequences learners actually walk, flagged on/off the curated prerequisite graph.
  - **Per-clip:** play / replay / skip / exposure counts.
  - **CSV export** for the lesson and clip tables.
- **Analytics service** (`api/app/services/analytics.py`): portable `GROUP BY` rollups + pure, unit-tested drop-off / time-on-step / prompt / clip helpers, computed from the existing `lesson_progress` data — **no new tracking**. A Postgres `lesson_analytics` **materialized view** (migration `0024_v6_5_lesson_analytics`, refreshed nightly + on demand) is the production performance / BI rollup; the endpoints compute live so there is one portable, tested code path (the test harness runs SQLite without migrations).
- **Additive engagement signals.** The lesson player now emits, additively, `clip_play` / `clip_replay` (audio-clip steps) and `prompt_tried` / `prompt_skipped` (prompt steps) into the existing bounded `step_actions` log, so per-clip and prompt analytics begin to flow. The `StepActionIn` action set was widened additively — no schema or public-API break.
- **In-app discoverability** built from one primitive, `LessonHintLink` (`src/components/LessonHintLink.tsx`): a muted "learn more" link or `?` icon that opens the relevant `/learn` lesson in a **new tab**. Wired into the **engine selector** ("Learn more about this engine →"), the **mode toggle** (links to the relevant track), and a single dismissable **first-time banner** ("New to AnnealMusic? Start with the intro lesson →"). The engine/param/mode→lesson maps live once in `src/components/lessonHints.ts` (the heuristic-drift guard).
- **Global "Show learning hints" toggle** in Account Settings (`src/components/LearningHintsSettings.tsx`), default **on** (opt-out). Flipping it off suppresses every hint and the banner reactively; the first-time banner's dismissal persists independently.

### Calm-by-design

- **No per-user analytics — for anyone, including the user about themselves.** Every analytics query aggregates before returning; no `user_id` or PII ever crosses the boundary (a server test asserts it). Analytics are admin-only and never linked from `/learn`. Surfacing a learner's own completion stats back at them stays on the permanent "never" list.
- **Discoverability is opt-out and understated:** one quiet primitive, a single dismissable banner, hints that open in a new tab and carry no counts/badges/urgency, and one global hide toggle. No outbound nudges ship or are stubbed. The `src/learn` calm-by-design CI gate stays green; the v6.5 checklist is recorded in `docs/CALM_BY_DESIGN.md`.

### Docs & release

- **`docs/V6_RETROSPECTIVE.md`** — the v6 education-arc retrospective (original thesis, what shipped v6.0–v6.5, LLM-generation cost reality vs forecast, an honest "known so far" on pedagogical effectiveness, where the LLM honored vs drifted on framing discipline, what was harder than expected, and the post-v6 thesis space).
- `docs/LEARN.md`, `docs/PRIVACY.md`, and `docs/CALM_BY_DESIGN.md` finalized for v6 (discoverability + analytics sections; aggregate-analytics privacy section; v6.5 calm checklist).

### Stability commitments (v6 close)

- Lesson schema → **stable**. Curriculum content → **versioned / seeded** in `curriculum_content.py`. Public lesson + progress APIs → **stable, additive-only** (v6.5 widened `step_actions` actions and added admin-only analytics routes without changing any existing contract).

## [6.4.0] - 2026-05-30

### Added

- **The curriculum.** Five tracks, **55 authored lessons**: Synthesis Fundamentals (15), Composition Technique (12), Ambient History & Listening (10), Production & DAW (8), and Music + Science Crossover (10). Every lesson is authored as a `LessonSpec` (objectives, step outline, constraints) in `api/app/services/curriculum_content.py` — the single, reviewable source for tracks, lessons, and the prerequisite graph. Lessons are seeded `generation_status='pending'` (migration `0023_v6_4_curriculum_seed`, deterministic uuid5 ids) and filled in by the v6.1 LLM pipeline at batch-generation time (~$1 on Haiku, cached). Two new tracks land in migration `0022_v6_4_curriculum_tracks`.
- **Prerequisite graph (a DAG).** Prerequisites are declared once as an edge list and resolved to lesson UUIDs at seed time. The graph is rooted at `synthesis-fundamentals/intro`, acyclic, depth ≤5, with cross-track edges (e.g. `harmonic-series` precedes the spectral engines; `phase-kuramoto` follows the drift-based `sculpt-model`). Every track has an ungated intro lesson so onboarding never blocks.
- **Curriculum authoring tooling** (`#admin` console, new tabs):
  - **Spec generator** — given a topic + outline, the LLM scaffolds a _starting_ spec (validated against `LessonSpec`, one retry, framing directive injected for sensitive topics) that the author always edits. `POST /api/v1/admin/curriculum/spec-generate`.
  - **Batch generation** — generate all pending/failed specs at once; unchanged specs are free cache hits. `POST /api/v1/admin/curriculum/batch-generate`.
  - **Review dashboard** — every lesson with its generation status + QA badge, alongside the per-step spec↔output editor; approve / revise / regenerate.
  - **Prerequisite-graph editor** — pick a prerequisite + a lesson, add an edge; the server validates the DAG and **rejects cycles**, so a cycle can never persist. `GET/PUT /api/v1/admin/curriculum/prereqs`.
  - **Quality checks** — `GET /api/v1/admin/curriculum/qa` runs nine pure, network-free rules over the whole curriculum.
- **Quality-check pipeline** (`api/app/services/curriculum_qa.py`): step-type coverage (every lesson must let you _hear_ something and _reflect_), audio-clip existence, demo-patch schema validity, SVG/mermaid sanitization, per-type word-count bands, prerequisite-DAG (cycle/self-edge/unknown-node detection), spec/id integrity, **framing compliance**, and difficulty monotonicity. Errors block publish; warnings are advisory.
- **Honest-framing lexicon** (`api/app/services/framing_lexicon.py`): the framing-trigger terms, prohibited claim phrases, and honest hedging signals live **once** and are shared by the spec generator, the QA pipeline, and CI. Framing-sensitive lessons (432 Hz, solfeggio, binaural, entrainment …) get the `docs/FRAMING.md` directive injected at generation and are asserted by QA — the `432-solfeggio` lesson must state the clinical evidence is absent.
- **Discoverability.** The curriculum browser gains search-by-topic, a track filter, a difficulty filter, a per-track lesson count, a **"Start here"** banner for brand-new learners (points at the first ungated intro lesson), and quiet **prerequisite hints** ("Suggested first: …") on lessons whose prerequisites aren't yet complete. Recommendations continue to pull from the real curriculum via the v6.3 picker.

### Calm-by-design

- Discoverability stays descriptive: lesson counts, not percentages; prerequisite _hints_, not hard locks; a "Start here" offer, not a funnel. No certificates, no quizzes, no scores. The `src/learn` calm-by-design CI gate (now covering the admin tooling too) stays green.

### Notes

- Lessons ship `pending` — an admin with an API key runs **Batch → Generate all pending** to fill in per-step prose. Specs are the editorial deliverable; the per-step content is generated and cached.
- No URL schema bump — the curriculum lives server-side under the existing `/learn` route.

## [6.3.0] - 2026-05-30

### Added

- **Lesson progress tracking.** A private, per-account `lesson_progress` record (migration `0021_v6_3_lesson_progress`, composite PK `user_id+lesson_id`) tracks `not_started` / `in_progress` / `completed` state, the current step, a 0..1 scroll position, timestamps, a bounded per-step action log, and any reflection text. `abandoned` is **computed** (>30 days inactive) and never stored, so a lesson can always be resumed. New endpoints: `POST/GET /api/v1/lesson-progress`, `GET /api/v1/lesson-progress/{lesson_id}` (resume), `GET /api/v1/lesson-progress/me/track/{slug}` (per-track summary), and `POST /api/v1/lesson-progress/import` (anon→authed migration).
- **Pause + resume (cross-device).** The lesson player saves your step + scroll position on step change, on tab-hide (`visibilitychange`), and on close (`sendBeacon`), and silently resumes there on re-entry. Account progress is the server's (so it follows you across devices); anonymous progress stays in `localStorage` only and is migrated once on first sign-in via an idempotent **max-merge** import (completion is never downgraded).
- **Next-lesson picker.** `POST /api/v1/recommendations/next` runs a two-stage pick: Stage 1 deterministically filters candidates (prerequisites satisfied, ±1 difficulty band, track scope, not-already-completed, ≤8 candidates); Stage 2 ranks them with **Haiku 4.5** into an ordered 1–3 with a one-sentence "why this next" each. Output is validated against the candidate set (hallucinated ids dropped), retried once, and falls back to the deterministic order if the model is unavailable. A 5-minute per-process TTL cache returns identical state without an LLM call.
- **Onboarding picker.** Brand-new learners (no completions) get a deterministic set of intro lessons across tracks plus "explore a track" chips — no LLM call needed.
- **Curriculum-browser progress display.** A quiet completed checkmark per lesson, a descriptive "N of M lessons explored" per track, and a "Resume" hint for in-progress lessons. No bars, no percentages, no streaks.
- **Single source of truth for progress state.** `api/app/services/progress_state.py` is the one place effective-state derivation (the implicit `abandoned`), per-track aggregation, and the import max-merge live — the calm-by-design `compute_stats` heuristic-drift rule, applied to lessons.

### Calm-by-design

- This is the highest engagement-loop-risk slice, so the guardrails are explicit: progress is descriptive only (no streaks/scores/levels/%-pressure), the picker is an **offer** with a permanent "browse all lessons" escape (never a funnel, never autoplay-next), abandonment is invisible to the user, and the only outbound prompt is a single, dismissible, once-per-session "sign in to keep your progress" nudge.
- **Privacy:** reflection text is private — never published and **never sent to the LLM ranker** (only step-action metadata becomes a signal). The recommendation payload carries no PII; a unit test asserts no reflection content reaches the prompt.
- The calm-by-design CI lexical gate (`src/test/calm-by-design.test.ts`) now scans **`src/learn`**, refined to match banned terms as whole words and ignore CSS/code identifiers (e.g. a `difficulty-badge` class or a `StatusBadge` component) so it flags engagement-loop _copy_ only.

## [6.2.0] - 2026-05-30

### Added

- **Audio clip library.** A curated library of short audio examples (5–60 s) that lessons reference by `slug`: engine archetypes, physical sub-models, FM ratios, granular textures, composition shapes, ambient-history homages, production demos, and psychoacoustic phenomena (Shepard tones, Risset rhythms, the tritone paradox, beating, just-vs-equal tuning). 49 clips across the five curriculum tracks, defined in `api/data/clip_library.json` and rendered to `public/clips/*.opus` (96 kbps mono) by `tools/gen_clips.py`.
- **`audio_clips` data model + API.** New table (migration `0020_v6_2_audio_clips`) with slug, metadata, `track_affinity`/`concept_tags`, license, and a 1536-dim `description_embedding`. Public `GET /api/v1/clips/:slug` (metadata) and `GET /api/v1/clips/:slug/audio` (streams Opus, redirecting to the static asset for shipped clips). Admin `POST/PATCH/DELETE /api/v1/admin/clips` + `GET /api/v1/admin/clips/search`.
- **`audio-clip` lesson step type.** `AudioClipStep` shows intro text, a waveform + play/pause/seek/loop transport, and outro text on completion, with the clip license surfaced on hover/focus. The embedded engine's `AudioContext` is suspended for the duration (new bridge methods `suspendEngine`/`resumeEngine` → `Orchestrator.suspendAudio`/`resumeAudio`) so clips don't fight the live engine, and resumed only if the player suspended it.
- **Shared clip retrieval.** One `search_clips` service blends embedding similarity (0.6), tag intersection (0.3), and track affinity (0.1), used by **both** admin search and the LLM pipeline. Generating an `audio-clip` step retrieves the top 3 candidates and the LLM picks one (or declines, preferring no clip over a weak match) and writes the framing. `LESSON_PROMPT_VERSION` → `v6.2.0`.
- **Admin clip manager.** `ClipManager` (in the `#admin` console) lists clips, uploads with a **required license** (attribution required for non-original), and tests retrieval.
- **License CI gate.** `tools/check-clip-licenses.mjs` fails the build if any clip lacks a license or a non-`original-by-you` clip lacks an attribution. Canonical ambient works are not CC-licensed, so the library ships 100% original homages + 2 CC0 acoustic reference recordings; paid licensed material is deferred.

### Notes

- The clip Opus binaries are generated from the committed manifest, not hand-committed; run `python tools/gen_clips.py` (requires ffmpeg) to (re)produce `public/clips/`. The two CC0 reference recordings must be dropped in manually with their source recorded in `docs/AUDIO_CLIPS.md`.

## [6.1.0] - 2026-05-30

### Added

- **LLM Lesson Generation Pipeline.** Lesson content is now generated from authored **specs** rather than hand-seeded. An admin POSTs a spec (id, track, objectives, difficulty, prerequisites, and a `step_outline`) to `POST /api/v1/admin/lessons/generate`; the server runs one LLM call per step, validates, and persists the result. Reuses the v1.7 `LLMClient`, schema-in-prompt machinery, and validate-and-retry loop (up to 2 retries with the validation errors fed back to the model).
- **Six system prompts + few-shot library.** Dedicated prompts for `text`, `demo`, `prompt`, `reflection`, `svg`, and `mermaid` generation sharing a warm/precise preamble, plus a curated example library (`api/data/lesson_examples.json`: 4 text, 5 demo, 3 prompt, 3 reflection, 3 svg, 3 mermaid) — every SVG passes the sanitizer, every mermaid passes the linter, every demo patch validates against the schema manifest. Versioned by `LESSON_PROMPT_VERSION` (`v6.1.0`).
- **Allowlist SVG sanitizer (`api/app/services/svg_sanitizer.py`).** Stdlib, deny-by-default. Hard-rejects `<script>`, `<image>`, `<foreignObject>`, external `href`/`url()`, `on*` handlers, and `DOCTYPE`/`ENTITY` (no silent stripping → retry). Caps the viewBox at 800×400. The client re-checks on render as defence-in-depth.
- **Mermaid validation.** Lightweight server-side lint (allowlisted diagram types — `flowchart`, `graph`, `sequenceDiagram`, `stateDiagram-v2` — plus injection guards); full compile stays client-side.
- **Schema-valid demo patches.** Demo steps generate a patch JSON that is clamped and validated through the existing v1.7 patch validator before persistence; the player loads the parsed patch.
- **Immutable per-step caching.** Cache keyed on `sha256(prompt_version | schema_version | spec_id | step_index | step_type | model_id | diagram)`, stored in `ai_generations` (`cache_key` unique, `lesson_step_id` backref, `kind = lesson-*`, nullable `user_id`). Cache hits cost nothing and decrement no quota; a prompt-version bump invalidates only new generations.
- **Manual per-step override.** `PUT/DELETE /api/v1/admin/lesson-steps/{id}/override` stores `manual_override_content`, which wins over generated content everywhere and is never regenerated (demo overrides are re-validated against the schema).
- **Monthly budget ceiling.** `lesson_gen_monthly_budget_usd` (default `$10`) refuses fresh generation once trailing-30-day lesson spend exceeds it. A typical 6-step lesson costs ~$0.01–0.02; the full ~100-lesson curriculum ~$1–2.
- **Admin generation console (`/learn#admin`).** Spec editor with "Generate now", a status dashboard (pending / generating / ready / failed), per-step preview, and a manual-override editor. Admin key held in tab `sessionStorage` only.
- **Diagram rendering in the lesson player.** `TextStep` renders generated SVG inline (server-sanitized) and mermaid as a labelled block.
- **Data model + migration `0019_v6_1_lesson_generation`.** `lessons.spec/generation_status/generation_error`; `lesson_steps` generation provenance + `manual_override_content`; `ai_generations.lesson_step_id/cache_key` + nullable `user_id`. Spec-based lessons stay hidden from learners until `ready`; hand-authored (spec-less) lessons remain always visible.

### Docs

- `docs/LESSON_GENERATION.md` (new): how the pipeline works, prompt versions, cache model, cost, manual override.
- `docs/CURRICULUM_AUTHORING.md`: added the v6.1 spec-authoring guide.

## [6.0.0] - 2026-05-30

### Added

- **Pedagogical Tracks Surface (`/learn`).** Stands up a completely decoupled and optimized education bundle (`dist-learn/`) outputting a microscopic budget (under 51KB gzipped) and preventing synthesis engine bloat for reading users.
- **Relational Tracks, Lessons, and Steps Data Models.** Creates SQLAlchemy database models and Pydantic validation schemas for Tracks, Lessons, and Steps, registered with FastAPI endpoints and seeded dynamically during Alembic migration (`0018_v6_0_lessons.py`) with 3 complete, interactive placeholder lessons.
- **Same-Origin postMessage JSON-RPC 2.0 Bridge Transport.** Decouples communication across the education player and embedded app iframe using a secure, same-origin `postMessage` transport layer.
- **Store-Level Parameter Sandboxing.** Introduces a reactive `constraints` array in the main Zustand parameters store. If active, standard parameter changing actions intercept and drop updates to any locked sliders, instantly disabling inputs in the ControlPanel and showing a `lesson` lock icon.
- **Temporary Visual glows.** Shipped bridge method `anneal.lesson.highlight` which dispatches custom window events, causing target sliders on the synth panel to pulse with a beautiful amber glow for 3 seconds to guide focus.
- **High-Fidelity Lesson Player UI.** Designed a premium split-pane workspace (40% lesson chrome, 60% live app iframe) on desktop, transitioning to a vertical collisional stack on mobile with an "Expand App" / "Minimize App" toggle.
- **Calm by Design Progress Alignment.** Adheres strictly to anti-engagement tenets: no streaks, levels, XP, confetti, or celebratory chimes. Steps use low-contrast progress dots (`• • ◦ ◦ ◦`), and participant reflection textareas are open-ended, optional, and saved completely privately in local state for a clean session summary.

## [5.7.0] - 2026-05-30

### Added

- **Unified Research Documentation Site.** Consolidated every research-surface API (JSON-RPC Bridge, OSC Address Namespace, CLI Commands, Python whitelisted modules, Datalogger Schema, and Experiment Framework) into a highly navigable, client-side searchable VitePress doc site served at `https://docs.annealmusic.org/research/`.
- **Comprehensive 16-Recipe Cookbook.** Shipped 16 fully self-contained, working examples covering composer, music technologist, cognition researcher, MIR/ML, and computational science adjacent personas, including biofeedback and diffusion equations.
- **Academic Citation Infrastructure.** Implemented programmatic print commands in both the CLI (`annealmusic cite`) and Python sandbox runtime (`anneal.cite()`), returning version-locked APA and BibTeX blocks, coupled with persistent ORCID, ROR, and `.zenodo.json` metadata configurations.
- **Headless CI Notebook Verification.** Added automated cell-execution test runner hooks into the GitHub Actions CI pipeline, guaranteeing zero regression or API drift across Jupyter notebooks on tagged releases.
- **SemVer Stability Matrix.** Formulated a formal API stability commitment matrix across all 6 research layers, establishing strict 6-month deprecation grace periods.
- **v5 Engineering Retrospective.** Published a transparent review (`docs/V5_RETROSPECTIVE.md`) evaluating abstract successes, performance strains, cost realities, and next post-v5 thesis horizons.

## [5.6.0] - 2026-05-30

### Added

- **Auditory Perceptual Experimentation Framework.** Introduced a dedicated, purpose-built surface for music cognition and Music Information Retrieval (MIR) researchers to programmatically define, counterbalance, and run perceptual studies.
- **`anneal.experiment` Python API Bindings.** Shipped canonical, sandboxed Python APIs allowing researchers to define experiments as Python scripts containing consent gates, blocks of randomized trials, breaks, and customizable demographic intakes.
- **Modular Participant UI Runner.** Created a highly focused, clinical-aesthetic React runner (`ExperimentRunner.tsx`) served at `/experiment/:slug` and `/experiment/preview` with strict zero-data-processor architectures to simplify IRB and legal approvals.
- **Six Integrated Response Input Modalities.** Implemented highly optimized React response components for standard inputs:
  - `LikertResponse`: High-contrast, tactile rating scales.
  - `ForcedChoice`: Accessible option grids and dropdown selectors.
  - `FreeText`: Formatted, character-capped text areas.
  - `AdjustValue`: Live parameter adjustment sliders that directly modulate synthesizer voices in real time.
  - `ReactionTime`: Keyboard-anchored response latency logs accurate to browser event loops.
  - `Continuous`: Real-time tracking samplers logging parameter adjustment values at `30Hz` over active stimulus playback.
- **Williams Latin Square Row Counterbalancing.** Added deterministic row generators to counterbalance and randomize block conditions, eliminating carryover bias across participants.
- **Lossless In-Memory Data Exporter.** Compiles participant intake, responses, and high-resolution `30Hz` acoustic/synthesizer telemetry into an uncompressed ZIP archive containing standard metadata `manifest.json`, clean tabular `responses.csv`, and comprehensive `datalogger.jsonl` ticks.
- **Experiments Dashboard Console Tab.** Designed an elegant, glassmorphic researcher cockpit inside `/research`, allowing researchers to manage completed definitions, copy participant recruitment links, and trigger local sandbox previews.
- **Pre-Curated Scientific Templates.** Shipped high-value experiment script templates (e.g. Dyad Consonance Rating, Spectral Brightness Tuning) in the example scripting library for immediate deployment.

## [5.5.0] - 2026-05-30

### Added

- **Scientific Python Environment Integration.** Introduced a curated, high-performance Scientific Python whitelist in the background Web Worker (`scipy`, `matplotlib`, `pandas`, `scikit-learn`). Preloads standard packages from the CDN in 1-5 seconds using a dynamic preloader.
- **Magic AST-Scan Auto-Import Interceptor.** Shipped an AST-based parser that scans user Python scripts on execution. If a whitelisted package (e.g. `pandas` or `scipy`) is imported but not yet loaded, it halts execution, displays a dynamic console message, auto-loads the package dynamically from the CDN, and seamlessly executes the script.
- **Curated Whitelist Guard.** Implemented an ironclad JS-level import guard inside `pyodide-worker.js` that checks all import statements against our curated whitelist before execution, raising a clear and secure error for arbitrary third-party packages.
- **matplotlib Virtual Web Worker WebAgg-Style Backend.** Created a virtual image-render bridge that allows headless matplotlib execution inside a background Web Worker. Overrides `plt.show()` to render active figures into high-density PNG bytes (using the stable `Agg` backend), sends the bytes to the UI thread, and draws them on an in-page canvas.
- **Multi-Figure Tabbed Plot Canvas UI.** Designed a premium glassmorphic, tabbed Matplotlib Plot display widget in the scripting panel, showing sequential figures with a clean header switch, a toolbar, and clear actions.
- **Extended `anneal` Python Library.** Added five new high-value scientific methods to the custom module:
  - `anneal.session_log()`: Ingests active ticks and flattens them using `pandas.json_normalize` into a clean tabular DataFrame.
  - `anneal.stream_log()`: Implemented as an async generator that yields pandas DataFrames in real time without blocking.
  - `anneal.sweep()`: Asynchronously drives multi-dimensional parameter grids and returns consolidated summary matrices.
  - `anneal.features()`: Extracts real-time audio features (`rms`, `spectralCentroid`, `spectralFlux`, `zcr`) over target intervals.
  - `anneal.render()`: Asynchronously runs offline audio rendering, returning a 2D NumPy array of samples or encoding a 16-bit PCM WAV written directly to MEMFS.
- **Pyodide Virtual Filesystem (VFS) Panel.** Created a beautiful VFS explorer panel in the workspace displaying all files saved inside Pyodide's virtual `/tmp` MEMFS directory. Connects actions to download virtual files directly to the host filesystem via Object URLs or unlink/delete them to free browser memory.
- **Robust VFS and Whitelist Test Suite.** Shipped Vitest unit test suites (`whitelist.test.ts` and `vfs.test.ts`) achieving 100% coverage on import detection, whitelisting validation, VFS actions, and plot rendering callback bridges.

## [5.4.0] - 2026-05-30

### Added

- **Web Worker isolated Pyodide scripting foundation.** Shipped a background Web Worker execution environment (`src/research/python/pyodide-worker.js`) running Pyodide `0.26.4` and packaging CPython `3.12`. It lazily loads standard libraries and NumPy from a pinned CDN, maintaining a microscopic production bundle size.
- **Strict Sandbox Boundary overrides.** Re-implements and overrides `pyfetch` and standard Python HTTP, Socket, and URL APIs (`urllib`, `requests`, `socket`) inside the worker thread to securely raise a `PermissionError` and block all arbitrary network egress.
- **Synchronous Cross-Thread Caching Bridge.** Implements a real-time parameters sync cache (`src/research/python/bridge.ts`) inside the worker, synced continuously at 50Hz via a `BroadcastChannel` subscription to parameter store updates. Allows Python-side script calls (e.g., `state.get()`, `engine.get_spectrum()`) to run instantly and synchronously without blocking the browser UI.
- **Custom `anneal` Python Library.** Exposes a full-fidelity custom Python module providing seamless observation and control bindings for the parameter store (`state.get`/`set`), active engines (`engine.get_spectrum`/`get_partials`), session lifecycle (`session.start`/`stop`), and the session datalogger (`datalog.start`/`snapshot`/`stop`).
- **Premium Glassmorphic Coding Workspace UI.** Shipped a rich composite dashboard panel (`src/research/python/ScriptingPanel.tsx`) under `/research` containing a CodeMirror 6 Python editor with syntax highlighting, basic completions, an asynchronous print output stream console with tracebacks, a persistent interactive REPL console terminal, and prebuilt scripting examples (LFO Parameter Sweep, Coherence Audit, Organic Frequency Drifter).
- **Backend user scripts CRUD endpoints.** Implements secure REST API endpoints under `/api/v1/scripts` (`models.py`, `schemas.py`, `routers/user_scripts.py`) to create, list (`/me`), fetch, edit, and cascade delete private user scripts, backed by an Alembic migration (`0016_v5_4_user_scripts.py`) that merges the database split heads and creates the `user_scripts` table.
- **Robust test suites.** Shipped detailed Vitest unit tests (`worker.test.ts`) validating coordinates cache synchronization and 100% backend endpoint test coverage in Pytest (`test_user_scripts.py`) asserting script quotas and private visibility boundaries.

## [5.3.0] - 2026-05-30

### Added

- **High-Performance Observability & Session Datalogger.** Shipped a high-resolution session datalogger (`src/datalog/DataLogger.ts`) recording full runtime state at configurable rates (up to 100Hz, default 50Hz) directly into a pre-allocated, memory-capped 100MB ring buffer to protect performance and prevent memory exhaustion.
- **Native In-Browser CSV and JSONL Serializers.** Implements lossless JSONL and dot-flattened tabular CSV writers natively in-browser, adding a microscopic bundle footprint (~5KB gzipped) and ensuring zero WebAssembly/npm bloat for standard users.
- **Glassmorphic Datalogging Dashboard UI.** Shipped a gorgeous, glowing dark-mode UI panel (`src/datalog/DataloggerPanel.tsx`) integrated directly under `/research`. Includes a live observed tick counter, real-time memory usage estimation, configuration selectors (sample rate, datalog detail mode), and native file downloads.
- **Deterministic Offline Rendering Datalogging.** Integrated the datalogger seamlessly into `renderStemsOffline` offline stem export, matching live browser analysis metrics sample-for-sample.
- **Scientific Formats CLI Converter Utility.** Shipped command-line `convert` utility and Python converter bridge (`tools/cli/src/output/converter.py` / `converter.ts`) wrapping Pandas and PyArrow to translate JSONL logs into highly optimized scientific data formats (**CSV, HDF5, and Parquet**) for downstream analysis in pandas, NumPy, MATLAB, Julia, R, and PyTorch.
- **Format Cross-Equivalence Test Harness.** Created a Python test harness (`tools/cli/src/output/verify_equivalence.py`) verifying that the native TS CSV flattener and Python Pandas/PyArrow converters produce 100% equivalent tabular columns, rows, and datatypes.
- **Bidirectional OSC Packet Recording.** Added `--log-out` flags to the standalone OSC-over-WebSocket bridge helper console (`tools/osc-bridge/src/index.ts`) to log bidirectional processed OSC packet captures to standard JSONL format.
- **Python Programmatic JSON-RPC Bridge APIs.** Shipped four new JSON-RPC 2.0 preview methods (`anneal.datalog.start`, `stop`, `snapshot`, `stream`) in `BridgeServer.ts` enabling programmatic session controls and real-time datalog tick streaming via Pyodide.
- **Rich Documentation & Ingestion Examples.** Created formal JSON Schema definitions (`docs/DATALOG_SCHEMA.md`), comprehensive developer guides (`docs/DATALOG.md`), and complete starter Python recipes (`examples/session_analysis.py`) demonstrating Pandas loading, filtering, and plotting with Matplotlib.

## [5.2.0] - 2026-05-30

### Added

- **Standalone Headless CLI (`annealmusic`).** Shipped a powerful standalone Node command-line interface (`tools/cli/`) that compiles to native binary executables. Reuses the production offline audio engines and ensures sample-level rendering parity.
- **Node Audio Synthesis Engine.** Implements a pure-Node rendering pipeline wrapping `node-web-audio-api` and shimming browser-like Web Audio contexts and AudioWorklets.
- **Chromium Playwright Rendering Backend.** Shipped an absolute parity fallback engine using headless Chromium via Playwright, programmatically driving a local static micro-server loading `dist/render.html` and returning base64 PCM frames.
- **Multi-Dimensional Cartesian Sweeps.** Implements batch parameter sweeps, computing linear expansions (`range`) and Cartesian products across any number of varies parameters and seeds.
- **Automatic Pieces & Sessions Rendering.** Auto-calculates durations from piece segment lists and structures listening session settle-in, integration, and Zen mindfulness bell schedule triggers.
- **High-Performance Job Concurrency Pools.** Implements parallel queueing worker scheduler (`--jobs N`) for high-throughput sweeps.
- **Intelligent Skip-Resume Mechanics.** Adds `--resume` resume capabilities that verify previously computed renders in `manifest.json` and skips redundant work.
- **Reproducibility Manifest & SHA-256 Checksums.** Writes `manifest.json` detailing execution metadata and exact cryptographically secure SHA-256 checksums on all outputs.
- **Sample-Level Parity Auditing.** Shipped `verify-parity` command that loads WAV files, decodes PCM float frames, and computes frame-by-frame Mean Squared Error (MSE), Root Mean Squared Error (RMSE), and maximum difference.
- **High-Throughput Cluster Scheduling.** Exposes `sweep-get-payload` and `sweep-get-filename` commands allowing stateless Slurm job arrays to run large-scale sweeps.

## [5.1.0] - 2026-05-30

### Added

- **Bidirectional Open Sound Control (OSC).** Integrates comprehensive state broadcasts (elapsed session time, spectrum FFTs, phase-coupled partial lists, and core parameters) and control actions (sweeping root frequencies, volume, and engine-specific parameters) to seamlessly bridge AnnealMusic with SuperCollider, Max/MSP, and external DAWs.
- **Localhost WebSocket Bridge Helper.** Standalone Node CLI (`tools/osc-bridge/`) serving a loopback WebSocket server on port `8766` and translating packets bidirectional with UDP sockets (listen on `8765`, send to `9000`), packaged for npm (`annealmusic-osc-bridge`) and compilable into single-file binary executables.
- **Apple Modern Network UDP Sockets.** High-performance iOS Capacitor plugin (`OSCBridge.swift`/`OSCBridge.m`) utilizing Apple's modern `Network` framework (`NWConnection` and `NWListener`) for lightweight local-network UDP routing with zero external Objective-C dependencies.
- **Android DatagramSockets Plugin.** Low-overhead Android Capacitor native plugin (`OSCBridgePlugin.java`) opening `java.net.DatagramSocket` listeners inside background executor worker threads.
- **Premium Glassmorphic OSC Panel UI.** High-fidelity configuration panel mounted inside `/research`, featuring glowing status badges, a canonical clipboard-copy address catalog, a scrollable live terminal log, port customizers, and an interactive rate-limiting filter rules editor.
- **Deterministic Bandwidth Throttling.** Implement client-side filter engine (`OSCFilter.ts`) with custom millisecond-based rate throttling to keep network overhead extremely low (~7.7 KB/s) during high-frequency spectrum streams.
- **Strict Security Boundaries.** Hardens the loopback bridge helper with loopback default bindings (`127.0.0.1`), strict UDP size limits (65,535 bytes), argument counters, regex address verification, and source IP burst rate limit thresholds.
- **Bridge Binary Parse Test Suites.** Introduces comprehensive test cases for Web OSC routing, whitelisting, and the custom Node bridge binary encoder/decoder round-trips.

## [5.0.0] - 2026-05-30

### Added

- **Standalone Research Console Route (`/research`).** Stands up a completely decoupled and sandboxed research route `/research` to serve advanced users, maintaining a strict physical bundle boundary to prevent heavy scripting engines from polluting the standard meditation client app.
- **Decoupled Research Vite Build Bundle.** Dedicated build config `vite.config.research.ts` emitting optimized outputs exclusively to `dist-research/`, achieving a microscopic bundle footprint (under 52KB gzipped) and ensuring zero impact on standard user load times.
- **Transport-Agnostic JSON-RPC 2.0 Bridge Contract.** Standardizes all client-server interface operations using the official JSON-RPC 2.0 protocol format, supporting flexible observation subscriptions (`anneal.state.subscribe`), parameter mutations, system health audits, and lifecycle management.
- **Same-Origin BroadcastChannel Transport.** Implements standard, secure same-origin browser messaging wrapping the JSON-RPC wire format, enabling any custom web console scripts or adjacent pages on the same origin to drive the live synthesizer parameters in real-time.
- **Dynamic Research console UI.** A premium stone-themed dashboard built with native CSS, featuring tabbed layouts, chronological live RPC traffic logs, quick-sculpt state sliders, and an interactive Web Audio FFT spectrum analyzer canvas.
- **FastAPI Backend Research Router.** Creates backend routing targets and wildcards in the FastAPI controller to seamlessly serve the minimal HTML shell from `/research` in both development and production server environments.

## [4.6.0] - 2026-05-30

### Added

- **iOS & Android Native Health Bridges.** Custom lightweight native Swift (`HealthBridge.swift`/`HealthBridge.m`) and Java (`HealthBridgePlugin.java`) Capacitor plugins to securely log mindful sessions (mindful minutes) to Apple Health and Google Health Connect on a strictly opt-in basis.
- **Premium Privacy & Integrations UI.** A gorgeous settings section under Account Settings to toggle iOS HealthKit, Android Health Connect, and include/exclude standalone bell timers with first-time permission requests.
- **WCAG 2.1 AA Accessibility Remediations.** Thorough visual and structural audit across all v4 surfaces, elevating text contrast ratios, expanding touch targets to a minimum of 44x44 CSS pixels, and introducing descriptive `aria-label` and `aria-expanded` attributes on all interactive controls.
- **Dynamic Reduced Motion Support.** Integrates `prefers-reduced-motion` detection directly into the WebGL visualizer and breathing LFO loops, instantly freezing particle orbital motion and breathing expansions to hold a steady, static focus state.
- **Secure CSV History Streaming.** Secure endpoint (`GET /me/sessions/export`) and frontend integration to stream a clean comma-separated backup spreadsheet of the user's complete played history, respecting auth identity boundaries.

## [4.5.0] - 2026-05-30

### Added

- **Session History.** A private, per-account record of every Listening Session play, at the new route **`/me/sessions`** (also in the account menu). A play is logged on session start and finalized on completion — or when ended early, recording the _actual_ duration listened. Each entry shows the date, session title, time listened, and an optional reflection (≤500 chars) you can add, edit, or remove; click an entry to replay the session. A deliberately understated summary reads "_N sessions, H hours total this month_" + "_average M min_" — no streaks, no goals, no comparisons. History requires an account and is **cross-device**; anonymous listeners see a single gentle, dismissible "sign in to keep your history" prompt that never recurs. Strictly private: no public surface, no sharing, fully user-deletable, and cascade-removed on account deletion. Stats are computed in exactly one place (`compute_stats`) and the payload intentionally omits any engagement-signal field.
- **Curated Listening Library.** A new curated meditation entry point at **`/listen`**, separate from the creator-side `/gallery`. Browse an editorial catalog of Listening Sessions by **length** (Short/Medium/Long/Extended), **intention** (Morning/Evening/Sleep/Difficult day/Focus/Open practice/Closing the week), and **audio character** (Drone/Composed/No spoken word/With bells/With tunings), with an **Editor's recent picks** strip. Each card carries title, tags, an optional curator note, a server-rendered audio **Preview** (reusing the v0.8 pipeline via the source Piece/Patch), and a **Listen** button into the v4.0 listener. Editorial-only in v4.5: listings are authored/selected by editors; user-published sessions remain in `/gallery`.
- **Admin Library Curation.** A new `/admin` section to add sessions to the library (set intention, length, character tags, curator note), manage editor's picks, and archive listings — gated by the v0.8 admin key.
- **Calm-by-Design CI gate.** New `docs/CALM_BY_DESIGN.md` review framework plus a lexical test (`src/test/calm-by-design.test.ts`) that fails the build if engagement-loop language (`streak`, `level up`, `achievement`, `daily goal`, `badge`, …) appears in the history/library UI. No notifications, emails, or reminders ship — calm-by-design is non-negotiable.
- **Data model.** Two additive tables via Alembic migration `0015` (`session_plays`, `library_listings`), with portable GUID/JSON types and Postgres partial indexes for active listings and picks. No URL schema bump — history is server-side per-user state, the library is server-side editorial data (schema stays **v20**).

## [4.4.0] - 2026-05-30

### Added

- **Breath Pacing Visuals.** Optional, silent, visual-only breath-pacing overlay during Listening Sessions, Drone Mode, and the Standalone Timer. A slow-pulsing amber circle (expand on inhale, hold at peak/trough, contract on exhale) ringed by a cycle-progress indicator, composed over the v1.9 visualizer (which dims slightly so the circle reads). No numerals, no audio cues — the music stays the only audio surface. Ships four built-in patterns (Box 4-4-4-4, 4-7-8, Coherent 5.5/min, Resonance 4.5/min) plus a bounded custom pattern, each with honest evidence framing. Phase math lives once in a pure `BreathController` driven by `AudioContext.currentTime`, so backgrounded tabs resume without drift. Honors `prefers-reduced-motion` (fade instead of size pulse) and offers an optional mobile haptic cue at phase transitions (off by default). URL/storage schema bumps to **v20** with a nullable `breath_pattern` field on Listening Sessions (Alembic migration `0014`).
- **Digital Waveguide Fractional-Delay String Core.** Replaces 1st-order linear delay interpolation in `KarplusStrong` (plucked) and `BowedString` (bowed) physical modeling engines with a high-fidelity 3rd-order Lagrange FIR interpolator.
- **Feedback Loop Group-Delay Compensation.** Subtracts the exact frequency-dependent phase delay of the feedback low-pass filter dynamically as brightness varies, achieving sub-cent tuning accuracy across the entire frequency range (measured error $<1.4$ cents at 55 Hz and $<0.005$ cents at 1760 Hz!).
- **Spectral Correctness Test Suite.** Integrates Cooley-Tukey radix-2 FFT and log-magnitude parabolic peak interpolation helpers directly into `dsp.test.ts` to assert that string frequencies remain within $\pm$2 cents of their microtonal and standard pitch targets.

## [4.3.0] - 2026-05-30

### Added

- **12 Curated Bell Library.** Programmatically synthesizes high-fidelity CC0-licensed Opus bell assets (3 Tibetan Bowls, 2 Crystal Singing Bowls, Zen Rin, Deep Temple Gong, 2 Carillons, and 3 Synthesized FM/pluck resonators) lazy-loaded and cached dynamically.
- **Concurrent Punctuation Scheduler & Resolver.** Replaces legacy sequential chimes and pauses with sample-accurate, dry-routed concurrent bell scheduling mapped to absolute session and piece time offsets, including support for movement-relative boundary triggers.
- **Interactive Bell Schedule Editor.** Introduces a rich accordion card editor (`src/listening/BellScheduleEditor.tsx`) allowing users to pick bell instruments, play previews, adjust volume levels, and map triggers.
- **Dynamic Progress Timeline with Bell Markers.** Renders an interactive horizontal progress timeline during active listens with glowing markers positioned at scheduled bell triggers, supporting hover tooltips for bell metadata.
- **Standalone Meditation Timer.** Mounts `/timer` as a standalone breathe visualizer using an LFO-driven expanding circle (inhale, hold, exhale, hold) coupled with local dry bell punctuation schedules.
- **SQLAlchemy v19 & Alembic JSONB Migration.** Automatically migrates legacy boolean chime flags to rich structured `bell_schedule` JSON lists inside SQLite and Postgres database containers.

## [4.0.0] - 2026-05-30

### Added

- **True Phase-Coupled Kuramoto Model.** Replaces the mean-field detune approximation with a physically accurate Kuramoto model. Tracks individual partial phases ($\theta_i$) and natural frequencies ($\omega_i$), computing the emergent order parameter $r(t) \in [0, 1]$ to drive a lockable **Detune Contraction** effect and visual orbital synchronization across both Canvas 2D and WebGL visualizers.
- **First-Class Listening Sessions.** Introduces the third top-level ambient artifact: Listening Sessions, fully optimized for deep immersion on the listener side instead of creator sculpting.
- **Synthesized Dual-Resonator Bell Chimes.** Implements high-quality opening and closing chime bells fully synthesized in real time in Web Audio using bandpass-filtered noise plucks with exponential decay.
- **Immersive Fullscreen Listening View.** Creates a gorgeous fullscreen HUD featuring prominent elapsed/remaining timer dials, double attribution layers, and tucked-away "Escape Hatch" sculpting drawers for creators.
- **Clinical disclaimer footprints.** Adheres strictly to the Honest Framing Baseline by persistently displaying professional and humble wellness disclaimers.
- **Linear Settle-in and Integration Fades.** Automatically fade-in piece volume from absolute silence over custom Settle-In periods, and fade back to silence during Integration closeouts.
- **Calm Visualizer Preset.** Slows visual orbits by `0.45` and reduces glow brightness by `0.6` across Canvas 2D and WebGL pixel shaders when in calm mode.
- **Offline Rendering Fades.** Seamlessly bakes chimes and automated gain fades directly into wav multi-stem exports during offline rendering passes.
- **URL Schema Version 16.** Enhances binary serialization to support compact, secure Listening Session representations.

## [3.2.0] - 2026-05-29

### Added

- **Monophonic Piano-Roll Notation Editor.** Introduces a scrollable vertical grid (C0-C8) and timeline supporting monophonic note overlay sequencing, pitch tracking, and edge-resizing.
- **Priority-Override DSP Scheduling.** Active notation notes completely override segment-driven root frequency changes, with a sustain mode that holds the pitch after release unless the active segment introduces an explicit root change.
- **Robust MIDI Import & Export.** Integrates the `@tonejs/midi` package to support importing custom `.mid` files with a glassmorphic multi-track picker, automatic monophonic conversion (highest pitch/last note wins), and optional grid-snapping. Enables exporting the notation track as a standard Type-0 MIDI file.
- **URL Schema Version 10.** Updates the URL serialization to support the compact representation of notation tracks (`notation=onset,dur,pitch;...`), preserving original URL limits by dynamically generating unique note IDs at decode-time.
- **Instant vs. Smooth Pitch Transitions.** Surfaces a toggle to allow users to bypass the engine's linear/exponential glide parameters and gate constraints for instant frequency changes.

## [3.0.0] - 2026-05-29

### Added

- **First-Class Pieces Top-Level Artifact.** Introduces Pieces as a new horizontal arrangement composition timeline running parallel to legacy Patches.
- **Ordered Timeline Segments.** Supports arranging and sequencing segment behaviors (`fixed`, `arc`, `open`, `transition`) to compose time-varying sonic arcs.
- **Smooth Transition Interpolation.** Smoothly transitions sound variables and parameters between segments, offering Linear, EaseInOut, and Exponential easing curves.
- **Indefinite Hold-Open Segments.** Enables active playback to sustain in place at custom 'open' timeline points, surfacing a transport next-advance key.
- **Premium Arranger Timeline Editor.** Features a state-integrated visual horizontal sequencer at `/piece` with color-coded segment states, edge resizing, reordering, and properties inspector.
- **URL Schema Version 8.** Serializes piece-level metadata, defaults, and multi-segment timeline parameters with root-level discrimination.
- **Offline Pieces Render.** Expands offline stem rendering support to seamlessly sweep and render full multi-segment pieces.
- **Full SQLAlchemy & Alembic Persistence.** Persists pieces and piece segments inside PostgreSQL (and SQLite test targets) via CRUD REST APIs.

## [1.8.0] - 2026-05-29

### Added

- **Real-Time Collaborative Sessions (Jam Mode).** Two users can sculpt a single sound field together in real time. State changes are synchronized synchronously while audio synthesis remains purely local.
- **Dual Transport Protocol.** Attempts zero-latency WebRTC P2P direct connectivity using public STUN servers and automatically falls back to secure WebSocket relaying through FastAPI if NAT traversal fails.
- **Yjs CRDT Synchronization.** Coordinates parameter, engine, session, and loop modifications dynamically with conflict-free replication and Zustand store integrations.
- **Collaborative Loop Sharing.** Uploads loop captures seamlessly as WAV binaries to Captures storage and synchronizes references via Yjs to automatically load and decode buffers on remote partner devices.
- **"Save as Shared Collab" Toggle.** Detects active jam sessions inside the Save Patch flow, attributing authorship co-creations dynamically to both users via a database junction table.
- **Sleek Invite Dashboard.** Includes a beautiful glassmorphic invite drawer rendering high-contrast QR Codes and one-click copy links for quick guest joins.
- **Interactive Remote Glow Cursors.** Projects subtle halo outlines and remote username flags on sliders and parameter controls when partners tweak them.

## [1.6.0] - 2026-05-29

### Added

- **MIDI CC Parameter Mapping.** Connects physical faders, dials, and sliders to automate global or engine-specific parameters with custom min/max bounds.
- **Response Curves.** Provides Linear, Exponential, and Logarithmic curves for high-resolution tactile sweep control.
- **Monophonic Pitch Keyboard Tracking.** Tracks incoming note-on MIDI keys monophonically using last-note-priority, preserving your starting pitch.
- **Flexible Note-Off Release.** Configures notes to either Sustain the last struck key indefinitely (ambient style) or Return immediately back to the pre-MIDI manual UI slider value.
- **Dynamic Strike Velocity.** Maps strike velocity dynamically to target properties (e.g., mallet strike force in Physical Modeling, brightness, or spatial balance).
- **Master MIDI Sync Clock.** Streams high-precision 24 PPQN clock ticks and Start/Stop transport commands to physical output ports, synced automatically to session play/stop events.
- **60Hz Throttled CC Streaming.** Outputs manual fader movements or drift-driven automated parameter sweeps, throttled to 60Hz to prevent MIDI congestion or driver locks.
- **Interactive MIDI Dashboard.** Features a stunning glassmorphic interface at `/midi` with live "wiggler" input value wiggles, dynamic mapping table editors, import/export buttons for backup JSONs, and default maps for Push 2, Launch Control XL, Akai Mix, and nanoKONTROL2.
- **Browser Compatibility Warnings.** Gracefully detects WKWebView (iOS) or Safari desktop environments and displays a beautiful fallback card prompting users to use Chrome/Firefox/Edge.

## [1.5.0] - 2026-05-29

### Added

- **Multi-Stem Session Export.** Enables users to render and export high-fidelity, sample-accurate, time-aligned multi-stem lossless WAV files suitable for direct import into professional DAWs (Logic, Ableton, Pro Tools, Reaper).
- **Broadcast Wave Format (BWF) and iXML Metadata.** Embeds standard Broadcast Audio Extension (`bext` version 0) headers and `iXML` semantic XML chunks within exported WAV stems for project/track metadata identification inside the DAW.
- **Seeded Mulberry32 PRNG Determinism.** Implements a seeded Mulberry32 pseudo-random number generator for offline renders, guaranteeing absolute, byte-level SHA-256 replication across identical renders.
- **Sequential Offline Render Contexts.** Runs rapid sequentially managed `OfflineAudioContext` passes to maintain a strict memory ceiling on heavy stems, coupled with dynamic player lookahead ticking.
- **Live Realtime Stems Capture.** Connects parallel, synchronized `AudioWorkletNode` PCM sample accumulators to tap live audio graph components (engine raw output, processed input feeds, loop slots) concurrently during live performances.
- **Premium Glassmorphic Export Interface.** Introduces a gorgeous glassmorphic prompt letting creators configure sample rates (44.1/48/96 kHz) and bit depths (24-bit PCM / 32-bit Float), estimate export sizes dynamically, and view sequential progress checklists.
- **Capacitor Mobile Native Export.** Automatically scales durations (10-minute mobile cap vs 30-minute web) and integrates Capacitor Filesystem cache saving and native system share sheets.

## [1.4.0] - 2026-05-29

### Added

- **Capacitor Mobile Packaging.** Packages the existing desktop-grade generative meditation sandbox into premium native iOS and Android shells using Capacitor 6.x.
- **Unified PlatformBridge Architecture.** Decouples and abstracts all platform-dependent storage, app redirection, permissions, and audio session operations behind a statically typed, cross-platform bridge.
- **Custom Native Audio Session Shims.** Implements highly lightweight native shims (Swift for iOS, Java for Android) that claim executive audio focus, configures the `.playback` background audio category to continue synthesis on screen lock, and captures native interruptions (calls, notifications) to transition the Web AudioContext state gracefully.
- **Seamless Universal and App Links.** Serves Apple `apple-app-site-association` and Google `assetlinks.json` configurations dynamically from `.well-known` and implements global `DeepLinkHandler` interception to route short links (/p/_, /r/_, /u/\*) and email magic links natively.
- **Cookie Sharing and Transparent Sessions.** Leverages native `CapacitorCookies` and `CapacitorHttp` fetch interception inside native WebView containers to share session storage cookies cross-origin.
- **Vite Mobile Bundler & Route Tree-Shaking.** Adds `vite.config.mobile.ts` compiling assets with relative pathing and strips the `/admin` and `/embed` pages from the final native app packages using build-time tree-shaking flags.
- **Dynamic Version Control.** Syncs Gradle and Xcode targets to automatically inherit the single source of truth version in `package.json` and generate increasing build numbers from Git commit depth.

## [1.3.0] - 2026-05-29

### Added

- **User Accounts and Identity.** Adds email magic-link auth and secure Google & GitHub OAuth providers, supporting full cross-device patch, recording, and custom user source synchronization while keeping guest credentials completely private and offline-first.
- **Manual Device Claiming.** Introduces a manual, confirm-only guest claiming flow via an elegant banner CTA. Multi-device claims safely link multiple guest `anon_id` references under a single unified user profile.
- **Conflict Resolution and Enumeration Protection.** Implements robust server-side security, preventing email enumeration via universal 202 requests, and handles device claim conflicts with distinct warning cues.
- **Deterministic Lissajous SVG Avatars.** Generates beautifully resonant phase-portrait wave patterns inside circular concentrics derived dynamically from an account's unique avatar seed.
- **Public Creator Profile Pages.** Adds public profile pages (`/u/:account_id`) summarizing public patch and recording tallies alongside their deterministic phase-portrait wave signature.
- **Legal Compliance Pages.** Integrates beautifully styled Terms of Service (`/legal/terms`) and Privacy Policy (`/legal/privacy`) pages tailored for the generative meditation sandbox.

## [1.2.0] - 2026-05-29

### Added

- **User-Uploaded Granular Sources.** Enable users to upload their own audio files (WAV, MP3, FLAC, AAC, OGG, Opus) up to 25MB to use as custom granular engine sources. Features a client-side downsampling and HSL-styled bounds cropping Trim Dialog (up to 60 seconds) with interactive loop previewing before upload. Server-side ffmpeg decodes and transcodes the segment to mono Opus (96kbps) in S3 storage.
- **My Sources Panel.** Premium drawers with account-level quota progress tracking ("X of 20 slots used"), loop-preview playback via a shared AudioContext, inline rename capability with banned-word validation, and confirmation warning modals if deleting sources actively referenced by other public patches.
- **Double-Tabbed Source Picker.** Adds a dual-pane UI in the source picker ("Bundled" vs "Mine") with file upload triggering and trim dialog integration.
- **Publish Consent Flow.** Strict consent gating when publishing public patches that reference unlisted user sources, transitioning them safely to `shared` with a 409 conflict requirement.
- **Dedicated Preview Renderer Endpoints.** Allows headless Chromium rendering agents to resolve `shared` user sources anonymously without auth tokens via `/api/v1/render/user-sources/{id}`.
- **Moderation and Direct Admin Flags.** Adds `"source-content"` reason in public report flow, auto-flagging of user sources when upholds occur, and direct admin toggle visibility endpoint (`PATCH /api/v1/admin/user-sources/{source_id}/visibility`).
- **Dynamic Client Fallback.** Implements loader interception of 404/451 errors, falling back seamlessly to the ambient `glasspad` bundled source and firing custom `anneal-toast` warning messages in the application toast system.

## [1.0.0] - 2026-05-24

The v1.0 release. Completes the roadmap (v0.1 → v1.0): a physics-driven ambient
sandbox with four synthesis engines, live input + a granular loop pedal, session
arcs, anonymous persistence, a public gallery with server-rendered previews, and
now recording export and an embeddable player.

### Added

- **Physical modeling engine** (4th engine, `e=physical`). Three continuously
  excited sub-models selected by `ph.model`: **string** (Karplus-Strong with a
  filtered-noise sustain extension), **tube** (cylindrical digital waveguide with
  a Smith-style reed), and **plate** (a ~20-mode bandpass modal bank). Per-partial
  AudioWorklet processors over the harmonic lattice; the DSP is pure TypeScript
  (single source of truth, unit-tested) bundled into one self-contained worklet
  script. Params: `ph.excitationLevel`, `ph.damping`, `ph.brightness`, `ph.reed`,
  `ph.inharm`. Platforms without AudioWorklet refuse the swap with a toast (never
  a silent failure). See `docs/MODELS.md`.
- **Recording export.** Realtime session capture (tapped post-fx, so it includes
  engine + input + loops) to **Opus** (MediaRecorder) or lossless **WAV** (PCM
  worklet), capped at 60 min with a 50-min warning. Client-side **offline render**
  of a saved patch via `OfflineAudioContext`, reusing the real engine DSP, drift
  math, ArcRunner, and IR. A **My Recordings** drawer (inline play, download,
  delete, share) and a public `/r/<slug>` player. Backend gains a real multipart
  upload pipeline, recording short slugs, and gated public access, against the
  existing v0.7 quota. See `docs/RECORDING.md`.
- **Embed route.** A tiny (~1.6 KB gz), React-free `/embed/<slug>` player that
  streams a public patch's preview audio — play/pause, scrub, title, wordmark —
  with dark/light themes. Served as a separate Vite entry; the embed surface is
  the only one allowed to be iframed (`frame-ancestors *`) while every other route
  stays `X-Frame-Options: DENY`. "Get embed code" affordances on gallery and My
  Patches cards. A CI gate enforces the < 50 KB budget. See `docs/EMBED.md`.

### Changed

- **URL schema v6**: adds `e=physical` and the `ph.*` engine namespace.
  Backward-compatible — v1–v5 links still decode.
- Security headers are now route-aware (embed exemption); `firebase.json` mirrors
  the policy for static hosting.

### Docs

- New: `docs/MODELS.md`, `docs/RECORDING.md`, `docs/EMBED.md`,
  `docs/RETROSPECTIVE.md`, `docs/v1.0-PLAN.md`.

## [0.9.0] - 2026-05-24

### Added

- **Granular engine.** A third selectable synthesis engine: granular synthesis
  from a curated source bank. N grain clouds over the harmonic lattice (one per
  partial), each reading the same source buffer; the partial's pitch sets the
  grain playback rate (cents relative to the source's reference pitch), and the
  drift loop's per-partial detune rides on top via the same `setPartialDetune`
  path as sine/FM. Per-bank grain params: **Grain** size (30–300 ms), **Density**
  (4–40 grains/s per partial), **Jitter** (position 0–1), **Pitch Jit** (0–100¢),
  **Center** (0–1) — which also drifts autonomously so static patches keep moving.
  A soft live-grain ceiling degrades gracefully under extreme settings.
- **`GrainCloud` core (`src/audio/granular/`).** The v0.6 loop-freeze granular
  code was refactored into a reusable, policy-free core (look-ahead scheduler +
  Hann window math moved here too), consumed by **both** the loop freeze and the
  new engine — one granular implementation, two consumers. The v0.6
  `GranularPlayer` is now a thin wrapper; freeze behavior is unchanged.
- **Curated source bank.** 8 ambient sources (glass pad, bowed metal, tape organ,
  pine wind, deep drone, choir air, rain glass, warm tape), all **original works
  released CC0**, synthesized deterministically by `scripts/gen-sources.ts` and
  shipped as ~3 MB of Ogg/Opus (~96 kbps) in `public/sources/`. A typed,
  append-only registry (`src/audio/sources/registry.ts`) + a lazy fetch/decode
  loader with per-session caching and graceful failure. `LICENSES.md` +
  `docs/SOURCES.md` record per-source licensing; a test enforces a license on
  every source.
- **Source picker UI.** A card-grid picker (ARIA radiogroup) with a per-source
  icon, a hover/focus license + description footer, and a loading spinner while a
  freshly-selected source decodes during playback.
- **URL schema v5.** `e=granular` plus `gr.source` (a stable source **index**),
  `gr.size`, `gr.density`, `gr.posJitter`, `gr.pitchJitter`, `gr.posCenter`.
  Granular params serialize under a short per-engine URL namespace (`gr`), while
  the engine id stays `granular`. Schemas v1–v4 still load unchanged.

### Changed

- **Per-engine crossfade window.** Engines may advertise a preferred crossfade
  duration via a new optional `crossfadeMs` capability; the orchestrator uses it
  for the incoming engine. Granular requests 800 ms (to mask grain start-up
  jitter); sine/FM keep the 600 ms default.
- **Schema manifest + validator.** `engines` is keyed by URL namespace (so `gr.*`
  validates), and the `e=` selector is validated against `engineOrder` (so
  `e=granular` is accepted while its params live under `gr`). Server-side preview
  rendering is unchanged — Option B (headless Chromium) fetches sources
  same-origin, so granular previews render with the exact client DSP.

## [0.8.0] - 2026-05-24

### Added

- **Public gallery (`/gallery`).** A browsable, deep-linkable page of
  `visibility: public` patches — the first surface where other users' content
  renders in the app. Anonymous browsing works fully; saving/publishing still uses
  the v0.7 anon-ID flow. Responsive card grid, sort (newest / oldest /
  most-loaded), filters (engine, mode, has-captures), debounced full-text search,
  and explicit "Load more" keyset pagination (stable under inserts).
- **`GET /api/v1/gallery`.** Sort/filter/search over public patches with
  `(published_at, id)` / `(load_count, …)` keyset cursors bound to their sort
  mode. Postgres `tsvector` search (title weighted over description) with a
  portable `LIKE` fallback for the SQLite test DB. `Cache-Control: max-age=30,
stale-while-revalidate=60`.
- **Server-side preview rendering.** A short (20 s) Opus audio thumbnail is
  rendered when a patch is published, by driving the **real** engine in **headless
  Chromium** (Option B) — Chromium is the production runtime, so previews use the
  exact client DSP with no parity risk. An in-process `asyncio` queue with bounded
  concurrency (2) and retries renders asynchronously; the card shows a "preview
  rendering" placeholder until ready. `GET /patches/:id/preview` 302s to the
  immutable Opus (`max-age=31536000`), 202s while rendering, 503s on failure.
  Previews are write-once (state is immutable).
- **Card visualizer art.** Each card shows a deterministic, static single frame of
  the visualizer geometry derived from the patch params (same param → same image),
  reusing the in-app `drawFrame` — doubles as the fallback when a preview hasn't
  rendered.
- **Load counts.** "Load into app" increments `load_count` (rate-limited per
  IP+patch; over-limit is a silent no-op so loading is never blocked).
- **Moderation.** Publish-time auto-screening of title/description against a static
  banned-word list (env-extensible via `MODERATION_EXTRA_TERMS`) + spam heuristics;
  a rejected publish returns `422 content_rejected` and does not publish. A public
  **report flow** (`POST /reports`, card `…` → Report) flags patches for review.
- **Minimal admin (`/admin`).** Key-gated (`x-admin-key`/`ADMIN_KEY`, stored in
  sessionStorage) view of open reports with dismiss / uphold; uphold sets a patch
  to `flagged`, hiding it from the gallery and short links (`403 under_review`)
  within the gallery cache TTL.
- **Routing.** Introduced `react-router-dom`: `/` and `/p/:slug` (sandbox),
  `/gallery`, `/admin`. A subtle "Gallery" link in the app header.

### Changed

- `patches` gains `preview_status`/`preview_storage_key`/`preview_duration_ms`,
  `load_count`, `published_at`, and derived `engine`/`mode`/`has_captures` filter
  columns (set at insert; state is immutable). `visibility` admits `'flagged'`.
  New `reports` table. Migration `0002_gallery` backfills existing public patches.
- API Docker image bundles headless Chromium + ffmpeg for preview rendering.

### Deferred

- Comments / likes / follows / profiles, algorithmic feeds, collections,
  staff-picks, public OG share images, semantic search, and any third-party
  moderation service — see `docs/ROADMAP.md`.

## [0.7.0] - 2026-05-24

### Added

- **Backend service (`api/`).** A FastAPI + PostgreSQL + S3-compatible service
  that persists user content: **patches** (the full encoded URL state + optional
  title/description), **captures** (loop-pedal audio buffers), and **recordings**
  (schema + endpoints only; the export pipeline is v1.0). Anonymous-first
  identity — every browser gets a stable `anonId` (UUID) on first save; no login.
  The existing client keeps working fully with the backend offline.
- **Anonymous identity.** `x-anon-id` header is authoritative on every
  authenticated request; a missing header mints a UUID (echoed back via header +
  a soft-recovery cookie). `localStorage['am_anon_id']` is the client home.
- **Patches CRUD + short links.** `POST/GET/PATCH/DELETE /api/v1/patches`; every
  patch is minted a `short_slug` and is reachable at `/p/<slug>`. `state` is
  immutable (a new state is a new patch); PATCH only edits metadata/visibility.
  Patches default to `unlisted` (link-only); `public` opt-in feeds the v0.8
  gallery. Deletion is real deletion.
- **Single-source-of-truth validation.** The URL schema lives once, in
  TypeScript. `schema/gen-manifest.ts` compiles it to `schema/manifest.v4.json`,
  which the server validates patch payloads against (strictly — reject, not
  clamp, unlike the lenient client decoder). A CI contract test fails on drift.
- **Captures.** `POST /api/v1/captures` (multipart WAV upload → server transcode
  to Opus via ffmpeg → object storage), `GET` (302 to a presigned URL), `DELETE`.
  Patches reference captures by id with server-side **ref-counting**; orphaned
  captures (`ref_count = 0`, older than 24 h) are swept on a schedule. Saving a
  patch defaults to **params-only**; "include captures" is an explicit opt-in.
- **Rate limits + quotas.** Per-anonId hourly limits (60 patches, 20 captures,
  5 recordings, 600 GETs) with a stricter per-IP fallback; quotas (100 patches,
  50 captures, 10 recordings, 1 GB) returning typed `409`/`413`, rate limits
  `429`.
- **Client integration (`src/api/`).** Typed API client, anonId manager, and a
  WAV encoder, plus a **Save** dialog (title / description / visibility /
  include-captures) and a **My Patches** drawer beside Copy Link. **Copy Link**
  stays the offline-capable inline `#s=` URL; **Save** mints a server short link.
  `/p/<slug>` resolves a saved patch, re-hydrating loop slots (incl. frozen, with
  remembered grain params) from their captures.
- **Migrations, Docker, CI, docs.** Alembic from day one; `docker compose up`
  brings up Postgres + MinIO + API + web with hot reload; `.github/workflows/api.yml`
  runs pyright + pytest, applies migrations against a real Postgres, guards
  against schema drift, and verifies `/readyz` post-deploy. New `docs/API.md` and
  `docs/DEPLOY.md`.

### Notes

- The audio engine code is unchanged in v0.7 — this slice adds a parallel
  backend. New, additive client primitives only: `LoopSlot.loadBuffer`,
  `Orchestrator.decodeAudio` / `loadLoopBuffer`, and a recognized runtime-only
  `cap` loop flag (save links carry it; buffers are never in the URL).
- The web app stays on Firebase Hosting; only the API runs on Railway. Object
  storage is Cloudflare R2 (zero egress, S3 API) — rationale in `docs/v0.7-PLAN.md`.

## [0.6.0] - 2026-05-24

### Added

- **Loop pedal.** Three independent loop slots (A / B / C) capture the live
  input, play it back seamlessly, layer it, and **freeze** it into an endless
  granular drone. Slots are ambient (no tempo/quantization) and sum into the
  same post-fx as the engines + input.
- **`src/loop/` module**:
  - **`LoopSlot`** — per-slot state machine
    (`empty → armed → capturing → playing → frozen | muted → empty`), routing a
    captured buffer through a per-slot mute gain into a shared loop bus, with a
    post-mute analyser for the meter + visualizer.
  - **Capture** (`capture.ts`) — lossless PCM into an `AudioBuffer` via an
    `AudioWorklet` (Blob-URL module; streams blocks to the main thread). Taps
    the input's post-processing point (independent of the monitor gate), arms
    and starts on first sound, and auto-stops at the 60-second cap. Sub-250 ms
    captures are discarded.
  - **`SeamLoopPlayer`** — seamless looping via two alternating
    `AudioBufferSourceNode`s with an equal-power crossfade at the seam
    (`min(120 ms, len × 0.15)`); playback rate fixed at 1.0.
  - **`GranularPlayer`** — freeze engine: Hann-windowed grains scheduled
    `currentTime`-accurately via a look-ahead loop (`scheduler.ts`), from
    wandering positions around a slow-scanning center. Per-slot **grain size /
    density / position-jitter / pitch-jitter**, plus an optional
    **drift-coupled** mode (mean drift widens grain wander).
  - **`windows.ts`** — single home for the Hann + equal-power curves (referenced,
    never redefined).
- **Loop pedal UI** (`LoopPedal`, `LoopSlotCard`, `WaveformThumbnail`): three
  compact warm-dark slot tiles with state-keyed amber glow, a captured-buffer
  waveform thumbnail, a per-slot level meter, freeze / mute / clear affordances,
  and inline grain sliders when frozen.
- **First-class hotkeys**: `1`/`2`/`3` drive the context-aware primary action
  for slots A/B/C; `Shift+1/2/3` toggle freeze. Ignored while a form control is
  focused or a non-Shift modifier is held; a `?` legend documents them in-app.
- **Visualizer loop rings**: each playing/frozen slot adds a subtle orbital arc
  at a distinct radius + hue (frozen draws a fuller, brighter ring).
- **Drift fan-out**: the orchestrator's mean-drift loop now also feeds the loop
  slots (normalized), so drift-coupled frozen slots breathe on the same field.

### Changed

- **URL schema → v4**: per-slot loop config (`L<id>.m/f/c` flags + frozen-slot
  grain params `L<id>.gs/gd/gp/gx`) rides along in share links. Buffer audio is
  never encoded. v1–v3 links still decode (loop keys ignored before v4); a v4
  link with frozen slots but no buffers loads the slots empty with the config
  remembered for the next capture.
- **`InputVoice`** gains a stable **capture tap** (`getCaptureTap()`) off the
  drift filter — post-processing, independent of the monitor gate — so loops
  capture the processed voice whether or not monitoring is on.
- The orchestrator keeps the audio core alive while any loop is active (like a
  connected input), so loops survive Settle / engine swaps / arc end.

### Notes

- Loop capture requires **`AudioWorklet`** (all evergreen browsers; see
  `COMPAT.md`). Three 60 s stereo buffers cap at ~70 MB — fine on desktop; a
  low-`deviceMemory` hint logs a console warning rather than crashing.
- Deferred (per roadmap): pitch-shift / reverse playback, >3 slots,
  tempo-quantized loops (never), slot chaining, buffer-level URL sharing
  (v0.7 backend), and capture-to-file export (v1.0).

## [0.5.0] - 2026-05-24

### Added

- **Live instrument input.** A mic / line-in / audio interface can be brought
  into the texture as a sibling voice alongside the engine. Opt-in via a
  **Connect input** affordance that calls `getUserMedia`; permission denial is
  handled gracefully with per-browser fix instructions and a retry.
- **`InputVoice`** (`src/input/InputVoice.ts`): owns the per-voice processing
  chain — high-pass @ 80 Hz, a gentle `DynamicsCompressor` (−24 dB / 3:1 / soft
  knee), an optional (default-off) soft-clip shaper, the user **Input Level**,
  and a **drift-modulated peaking filter** whose center frequency tracks the
  drift loop's mean detune, so the live voice breathes on the same field as the
  engine partials. Output feeds the shared post-fx chain.
- **Music-friendly capture**: `echoCancellation`, `noiseSuppression`, and
  `autoGainControl` are disabled so the signal reaches the engine clean.
- **Monitoring is muted by default** (feedback-safe). A pre-gate analyser drives
  the level meter and visualizer ring even when monitoring is off.
- **Input panel UI**: device picker (handles empty labels pre-grant), warm-amber
  LED **level meter** (~30 Hz, peak + clip indicators), Input Level slider,
  monitoring toggle (with a feedback warning), a latency estimate readout, and a
  disconnect affordance. The panel stays controllable in every mode — the arc
  never touches input.
- **Visualizer input ring**: input amplitude pulses a faint ring around the
  central halo (absent entirely when no input is connected).
- **Feedback guard**: while monitoring, sustained hot RMS (>0.9 for >2 s) dims
  monitoring and surfaces a toast.
- **Resilience**: stereo input is summed to mono; device-change / unplug
  gracefully reconnects to the default device without crashing the audio graph;
  the audio core (context + post-fx) is decoupled from the session lifecycle so
  input can be live before Begin and survives engine swaps and arc start/stop.

### Notes

- Input is a **runtime/hardware concern** and is intentionally **absent from the
  URL schema** — sharing a link never carries input state. No schema bump.
- Input latency is surfaced as a labeled **estimate**: Web Audio does not expose
  true mic→node latency, so the readout uses `baseLatency` + `outputLatency`
  (formula in `src/input/latency.ts`, documented in `COMPAT.md`).
- v0.5 is a single mono routed voice; pitch detection / harmonization, the loop
  pedal, multi-input, and sidechain/ducking are out of scope (see ROADMAP).

## [0.4.0] - 2026-05-24

### Added

- **Session modes.** Two ways to run a session, chosen with a **Mode** toggle:
  **Open** (drift forever, sculpt at will — the prior behavior) and **Arc** (a
  fixed-duration session that scripts the parameters along a preset envelope and
  automates itself to completion).
- **Session state machine** in the orchestrator:
  `idle → starting → running-open | running-arc → stopping → idle`, with a
  subscribe API for React and clean abort from any state. `stopping` is the home
  for the fade-out; an arc's last 4 seconds fade master to 0 (`RETURNING`).
- **`ArcRunner`** (`src/session/ArcRunner.ts`): a pure driver that resolves an
  arc's targets at construction and computes the live parameter values for any
  elapsed time. Arc progress rides on `AudioContext.currentTime`, not wall
  clocks, so long sessions (20+ min) stay accurate.
- **Three preset arcs** (`src/session/arcs.ts`): **Bell Curve** (open, deepen,
  return), **Dawn** (sparse→open), **Dusk** (open→closing). Targets are
  multipliers on the user's starting values; `restoreStart` eases back to the
  captured pose; `min`/`max` resolve to a param's bound.
- **Arc UI**: preset picker (cards), duration slider (3–60 min, default 10), a
  `Begin · MM:SS` button label, a progress bar with segment markers across the
  visualizer, a `MM:SS LEFT` readout, and locked (read-only, live-updating)
  sculpt + engine controls during an arc.
- **URL schema v3**: adds `m=<open|arc>` and, for arcs, `arc=<id>&dur=<sec>`.
  v1/v2 links load as `mode=open`; unknown arc ids fall back to open with a
  notice; out-of-range durations are clamped.
- Store gains `sessionMode` / `arcId` / `arcDurationSec`; the `useAudioEngine`
  hook is superseded by `useSession`.

### Notes

- Both shipped engines lock density while playing, so the `density` target in
  Dawn/Dusk is dropped (with a console warning and an inline `density held`
  note); those arcs sweep brightness + spread. Density motion arrives with an
  unlocked engine.

## [0.3.0] - 2026-05-24

### Added

- **Engine-swap abstraction.** A new `AnnealEngine` interface
  (`src/audio/engines/types.ts`) defines the contract every synthesis engine
  implements; the new `Orchestrator` (`src/audio/orchestrator.ts`) owns the
  audio context, shared physics, post-fx chain, drift loop, and engine
  lifecycle. Engines are registered in `src/audio/engines/index.ts`.
- **FM engine** (`fm`): two-operator FM per partial — sine carrier, modulator at
  `carrier × Ratio`, depth `Index × carrier` Hz, plus optional modulator
  self-**Feedback**. Engine params: `modRatio` (0.5–4), `modIndex` (0–10),
  `feedback` (0–1).
- **Hot engine swap with crossfade.** Each engine routes through its own bus
  gain; switching engines equal-gain crossfades over ~600ms (no page reload, no
  click), coalescing rapid switches to the latest target.
- **Engine selector** segmented control (Sine / FM) under the header, with an
  ARIA radiogroup + arrow-key navigation, and an **Engine** group in the control
  panel rendering the active engine's params (hidden when an engine has none).
- **URL schema v2**: adds the engine selector (`e=<id>`) and namespaced engine
  params (`fm.modRatio`, …). v1 links still load, interpreted as `engine=sine`.
- Store gains `engineId` + per-engine `engineParams` (retained across switches),
  with `setEngine` / `setEngineParam` actions.
- Tests: FM lifecycle + frequency/detune tracking, orchestrator boot/swap/drift,
  crossfade overlap (no gap/clip) via a new Web Audio test mock, and schema-v2
  round-trip + v1 back-compat.

### Changed

- The monolithic `AnnealMusicEngine` was refactored into `Orchestrator` +
  `SineEngine` with identical sine behavior; the global fade now lives on
  per-engine bus gains rather than the master node.

## [0.2.0] - 2026-05-24

### Added

- URL state sharing: the full sculptable parameter set (volume excluded) is
  encoded in the URL fragment under a versioned, human-readable schema
  (`#s=1:<key=value…>`, schema version `1`).
- `src/share/` module: `schema` (version, shared keys, bounds derived from
  `CONTROL_DEFS`), `encode`/`decode` (never throws; clamps out-of-range values,
  ignores unknown keys, collects warnings), and `url` (hash read/write +
  debounced `replaceState` sync).
- App boot hydration: valid URL state is applied (via a new `setMany` batch
  store action) before the audio engine is constructed.
- **Copy Link** button in the header, using `navigator.clipboard` with an
  `execCommand` fallback and a manual-prompt last resort.
- Single-slot `Toast` component for "Loaded shared session" / copy feedback /
  newer-version notices.
- Tests: round-trip property test, decoder fuzz (1000 strings, never throws),
  bounds clamping, unknown-key/version handling, `CONTROL_DEFS` drift guard, and
  clipboard component tests.

## [0.1.0] - 2026-05-23

### Added

- Initial project scaffold: Vite + React 18 + TypeScript (strict) + Tailwind CSS.
- Web Audio engine (`AnnealMusicEngine`): coupled sine bank over a harmonic
  lattice, Ornstein–Uhlenbeck + Kuramoto-style detune drift, convolution reverb,
  lowpass tone control, and analyser-driven visuals.
- Pure, testable `driftStep` (injectable RNG) and `makeIR` modules.
- Zustand parameter store with typed control definitions and bounds clamping.
- Canvas 2D visualizer (`drawFrame`) with audio-reactive orbiting partials and a
  spectrum trace.
- `ControlPanel` (Pitch / Physics / Tone groups + volume) and collapsible
  `ArchitectureDiagram`.
- Unit tests for drift physics and parameter bounds (Vitest + jsdom).
- Tooling: ESLint + Prettier, Husky + lint-staged pre-commit, CI workflow.
- Docs: `INIT_PLAN`, `ROADMAP`, `COMPAT`, and the preserved prototype.

[0.5.0]: https://github.com/akarlin3/annealMusic/releases/tag/v0.5.0
[0.4.0]: https://github.com/akarlin3/annealMusic/releases/tag/v0.4.0
[0.3.0]: https://github.com/akarlin3/annealMusic/releases/tag/v0.3.0
[0.2.0]: https://github.com/akarlin3/annealMusic/releases/tag/v0.2.0
[0.1.0]: https://github.com/akarlin3/annealMusic/releases/tag/v0.1.0
