# Accessibility in Generative Sonification

Because sonifications map high-dimensional datasets into auditory streams, they are natural tools for inclusive science, providing blind or low-vision (BLV) researchers equal access to continuous data patterns.

---

## 1. Description Transcripts Schema & CRUD

Every scientific artifact contains a dedicated text description of its parameter mappings and data trends. PIs can curate these transcripts manually, or use auto-generated drafts.

### Database Table

```sql
CREATE TABLE accessibility_descriptions (
  artifact_kind   TEXT NOT NULL,
  artifact_id     UUID NOT NULL,
  description     TEXT NOT NULL,
  language        TEXT NOT NULL DEFAULT 'en',
  source          TEXT NOT NULL, -- 'auto' | 'manual' | 'reviewed'
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (artifact_kind, artifact_id, language)
);
```

### Auto-Generation Pipeline

When no manual transcript exists, the backend parses the `mapping_spec` parameter schema to generate a descriptive transcript:

- **Example**: _"A time-series sonification titled 'Water Temperature' representing data as sound. Parameter mappings include: temperature mapped to pitch; salinity mapped to granular density."_

---

## 2. Interactive Client Surfaces

### ARIA Screen Reader Integration

The embed figure widget (`/embed-figure/:id`) incorporates full screen-reader support:

- `aria-live="polite"` handles playback status changes.
- Focus on the visualizer wordmark triggers announcements containing the accessibility description transcript.
- Clear `aria-label` properties on play/pause and range controls.

### Playback Speed & Tempo Controls

For complex, high-density recordings, researchers can slow down the playback tempo (0.5x, 0.75x) to audit micro-variations, or speed it up (1.5x, 2.0x) to survey macro-trends:

- **Audio Scaling**: Controls `HTMLAudioElement.playbackRate` directly.
- **Visual Sync**: Automatically slows or speeds up the Canvas orbital coordinate animation loop accordingly.

### High-Contrast Visualizations

For low-vision researchers, selecting the **Contrast** theme switches the visualizer from dark ambient glow modes to a stark, high-contrast monochrome design (ratios > 7:1) using pure high-contrast values.

### Mobile Haptic Vibrations

Mobile devices utilize the Capacitor Haptics API, triggering gentle physical vibrations corresponding to significant sonification events (such as Kuramoto order parameter synchronization spikes).
