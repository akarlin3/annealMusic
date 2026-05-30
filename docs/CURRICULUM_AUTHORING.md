# Curriculum Authoring & Data Models

This guide documents the data models, API schema payload standards, and seeding strategies for authoring and managing curriculum tracks, lessons, and steps in AnnealMusic v6.0.

---

## 1. Relational Database Schema

The curriculum structure is divided into a three-tier hierarchy: **Tracks** (pedagogical pillars) ➔ **Lessons** (guided concepts) ➔ **Steps** (individual interactive screens).

```
 ┌────────────────┐
 │     TRACKS     │ (e.g. Synthesis Fundamentals)
 └───────┬────────┘
         │ 1
         │
         │ *
 ┌───────▼────────┐
 │    LESSONS     │ (e.g. Drift and Coupling)
 └───────┬────────┘
         │ 1
         │
         │ *
 ┌───────▼────────┐
 │  LESSON_STEPS  │ (e.g. Step 1: Text, Step 2: Sandbox Prompt)
 └────────────────┘
```

### 1.1 `tracks` Table

Represents high-level topics or pedagogical pillars.

- `id` (UUID, Primary Key): Unique track identifier.
- `slug` (Text, Unique): URL-friendly string used in routing (e.g. `synthesis-fundamentals`).
- `title` (Text): The public name of the track.
- `description` (Text, Optional): Introductory text for the track card.
- `position` (Integer): Order in which the track appears on the dashboard (0-indexed).
- `color` (Text, Optional): HSL/Hex color value used for dynamic highlights and badges in the UI.

### 1.2 `lessons` Table

Represents structured interactive units within a track.

- `id` (UUID, Primary Key): Unique lesson identifier.
- `track_id` (UUID, Foreign Key): Reference to the parent track.
- `slug` (Text): URL-friendly string (e.g. `drift-coupling`).
- `title` (Text): Lesson title.
- `description` (Text, Optional): Concise summary.
- `difficulty` (Text): Categorized as `intro`, `intermediate`, or `advanced`.
- `estimated_minutes` (Integer): Average time required to complete the lesson.
- `position` (Integer): Sort position within the track (0-indexed).
- `prerequisites` (UUID Array): Optional array of other lesson IDs that must be completed first.

### 1.3 `lesson_steps` Table

Represents specific interactive screens/step cards.

- `id` (UUID, Primary Key): Unique step identifier.
- `lesson_id` (UUID, Foreign Key): Reference to the parent lesson.
- `position` (Integer): Order within the lesson (0-indexed).
- `type` (Text): One of `text`, `demo`, `prompt`, or `reflection`.
- `config` (JSONB): Structured configuration payload tailored to the step type.

---

## 2. Step Configuration Payloads (`config`)

The `config` column contains JSON payloads validating against specific JSON Schemas based on `type`.

### 2.1 `text` Step

Renders a reading and comprehension card.

```json
{
  "title": "Phase Synchronization & Coupling",
  "content": "A detailed explanation paragraph using double newlines for paragraph spacing.",
  "key_points": ["Key takeaway point 1", "Key takeaway point 2"]
}
```

### 2.2 `demo` Step

Loads a synthesizer patch automatically and highlights target sliders.

```json
{
  "title": "Hearing Synchronization",
  "description": "Explains what patch properties to listen to.",
  "patch": {
    "coupling": 0.8,
    "drift": 0.1,
    "brightness": 0.5,
    "space": 0.4,
    "speed": 0.3
  },
  "highlights": ["coupling", "drift"]
}
```

### 2.3 `prompt` Step

Locks standard controls and locks the user into a specific sandbox.

```json
{
  "title": "Break the Lock",
  "prompt": "Adjust the drift parameter up and observe how the sync breaks.",
  "constraints": ["drift", "brightness"],
  "hint": "Try turning drift up to 0.9 while coupling stays high."
}
```

### 2.4 `reflection` Step

Provides an open-ended review card.

```json
{
  "title": "Analysing the Friction",
  "prompt": "How does the tone change when the system is on the verge of breaking synchronization?",
  "placeholder": "Describe the beating speed and harmonic tension..."
}
```

---

## 3. Database Seeding & Migration Strategy

For predictability across testing, local development, and production runs, the initial curriculum is seeded directly in the Alembic migration step.

- **Migration File:** `api/alembic/versions/0018_v6_0_lessons.py`
- **Seeding Mechanism:** Uses Alembic’s `op.bulk_insert()` on pre-constructed tables.
- **Dialect Agnosticism:** To support both PostgreSQL (production) and SQLite (testing/local), JSON config values are serialized as standard string literals on SQLite, and array types are converted to SQLite-friendly string stubs (`[]`).

### Adding a New Track/Lesson via Migration

To add a new track or lesson in a future version:

1. Generate a new migration using `alembic revision -m "add_my_lesson"`.
2. Construct the track/lesson/steps dictionary payloads with deterministic UUID strings (using `uuid.uuid4()` locally once to generate them).
3. Call `op.bulk_insert` inside the `upgrade()` block of the new migration file.
