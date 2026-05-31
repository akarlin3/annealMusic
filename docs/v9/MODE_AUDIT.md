# AnnealMusic v9.0 — Top-Level Modes Audit

This document is the official mapping of every URL route, landing redirection, header item, visualizer layer, and educational curriculum module across **Meditation**, **Musician**, and **Researcher** modes.

---

## 1. URL Routing Mapping

All routes are fully accessible in all modes (soft-gating policy). However, each mode determines the **default foregrounded routing layout** and the landing path when launching or switching.

| URL Route        | Target Component          | Meditation Default                           | Musician Default                                         | Researcher Default                               | Notes                        |
| :--------------- | :------------------------ | :------------------------------------------- | :------------------------------------------------------- | :----------------------------------------------- | :--------------------------- |
| `/`              | `App.tsx`                 | ❌ Hiding creative tools, Drone-mode submode | `[Landing]` Full Creative Sandbox (Sketch/Compose/Drone) | ❌ Redirects to `/research.html`                 | The main generative sandbox  |
| `/listen`        | `LibraryPage.tsx`         | `[Landing]` Curated libraries list           | ❌ Hiding from navigation bar                            | ❌ Hiding from navigation bar                    | Ambient curated tracks       |
| `/gallery`       | `GalleryPage.tsx`         | ❌ Hiding links to public gallery            | `[Foregrounded]` Public sharing gallery                  | ❌ Hiding links to public gallery                | Shared community patches     |
| `/midi`          | `MidiSettingsPage.tsx`    | ❌ Hidden                                    | `[Foregrounded]` MIDI routing dashboard                  | ❌ Hidden                                        | MIDI I/O mapping controls    |
| `/piece`         | `PiecePage.tsx`           | ❌ Hidden                                    | `[Foregrounded]` Arranger view / timelines               | ❌ Hidden                                        | Structural composition       |
| `/timer`         | `MeditationTimerPage.tsx` | `[Foregrounded]` Custom breath pace & bells  | `[Foregrounded]` Timer tools                             | ❌ Hidden                                        | Mindfulness bell paced timer |
| `/me/sessions`   | `SessionHistoryPage.tsx`  | `[Foregrounded]` Listening session archives  | `[Foregrounded]` Recording session archives              | ❌ Hidden                                        | Personal user history        |
| `/feed`          | `FeedPage.tsx`            | ❌ Hidden                                    | `[Foregrounded]` Social feed                             | ❌ Hidden                                        | Social community updates     |
| `/research.html` | `ResearchApp.tsx`         | ❌ Hidden                                    | ❌ Hidden                                                | `[Landing]` Complete research console            | Datalog, OSC, REPL, studies  |
| `/learn.html`    | `LearnApp.tsx`            | `[Foregrounded]` Meditation-focused tracks   | `[Foregrounded]` Musician-focused tracks                 | `[Foregrounded]` Science-focused crossover track | dynamic interactive lessons  |

---

## 2. Main Sandbox UI Elements (within `App.tsx`)

When loading the main sandbox (`/`), components are selectively visible based on the active mode:

| Component UI Element              | Meditation Mode  |  Musician Mode   | Researcher Mode |
| :-------------------------------- | :--------------: | :--------------: | :-------------: |
| **Drone view**                    | `[Default View]` |  `[Supported]`   |  `[Supported]`  |
| **Sketch / Piano roll / Compose** |    ❌ Hidden     | `[Default View]` |  `[Supported]`  |
| **Bells & Breath pacing panel**   | `[Foregrounded]` |  `[Supported]`   |    ❌ Hidden    |
| **Presets panel & source picks**  |  `[Supported]`   |  `[Supported]`   |  `[Supported]`  |
| **Loop Pedal slots**              |    ❌ Hidden     | `[Foregrounded]` |    ❌ Hidden    |
| **MIDI configuration actions**    |    ❌ Hidden     | `[Foregrounded]` |    ❌ Hidden    |
| **AI Patch Generator**            |    ❌ Hidden     | `[Foregrounded]` |    ❌ Hidden    |
| **Recording & Stems Export**      |    ❌ Hidden     | `[Foregrounded]` |  `[Supported]`  |

---

## 3. Curriculum Tag Filtering (within `LearnApp.tsx`)

Lessons loaded from the database include metadata tags. The curriculum browser dynamically filters the visible tracks depending on active mode:

- **Meditation Focus**:
  - Tags matching: `meditation`, `mindfulness`, `focus`.
  - Hides production guides, physics equations, and raw syntaxes.
- **Musician Focus**:
  - Tags matching: `musician`, `composition`, `synthesis`, `production`, `arrangement`.
  - Hides advanced research protocols.
- **Researcher Focus**:
  - Tags matching: `science`, `psychoacoustics`, `sonification`, `clinical`, `statistics`.
  - Crossover track focusing on data mapping and physical systems.
