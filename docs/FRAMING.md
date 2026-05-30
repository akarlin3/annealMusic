# Honest Clinical Framing & Disclaimers Guidelines

To preserve scientific integrity and foster deep user trust, **AnnealMusic** adheres strictly to the **Honest Framing Baseline** across all application interfaces, marketing materials, and technical documentation.

---

## 1. Core Principles

### 1.1 Support Generalities, Avoid Hyperbole

- **Permitted:** Broadly claiming that long-form, repetitive, or generative ambient audio can assist with focus, promote a sense of calm, support transition into sleep, or offer a soothing auditory backdrop.
- **Prohibited:** High-level claims that specific micro-tuning adjustments, solfeggio frequencies, resonant chimes, or exact algorithmic feedback loops have verified, target-specific therapeutic or medicinal outcomes.

### 1.2 Distinguish Ambient Calm from Medical Efficacy

- Ambient soundscapes act as wonderful atmospheric regulators that support the body's natural relaxation responses. They are **wellness aids**, not clinical devices or replacements for medical intervention.

### 1.3 Professional, Humble Tone

- Avoid clinical marketing jargon (e.g. "brainwave entrainment", "DNA-repair frequency", "clinically proven anxiety cure"). Use calm, humble, and plain-speaking language.

---

## 2. Standard Application Footprints

Every listening session view (`ListeningView.tsx`) displays a subtle, low-contrast disclaimer at the bottom of the viewport:

> **Disclaimer:** Ambient listens are calming, but specific tuning frequencies or chimes lack clinically validated efficacy.

### 2.1 Interface Implementation Rules

1. **Low Visual Weight:** Render the footprint using small, low-contrast typography (e.g. `text-stone-600` or `#57534e`, size `8px` / `text-[8px]`). It must read cleanly but not distract from the central visualizer orbits.
2. **Accessible Placement:** Place the footprint at the very bottom of the screen-space grid, ensuring it is present during active listening but does not encroach on HUD control elements.
3. **No Dismissal:** The clinical framing footprint must be persistent and not hideable by the user, serving as an ongoing structural grounding of the experience.

---

## 3. Tuning Systems & Microtonality

With the release of v4.1, selectable tuning systems are introduced. The following guidelines apply:

### 3.1 Audibility & Acoustic Differences

- **True:** Tunings produce audibly different musical colors, physical acoustic beats, and harmonic textures due to unevenly distributed intervals or pure integer ratios (Just Intonation, Pythagorean, Werckmeister, Kirnberger, meantone, Vallotti, Young).
- **True:** Custom Scala scale imports allow unique microtonal explorations of alternative intervals.

### 3.2 Debunking Healing Claims (Solfeggio and 432 Hz)

- **Myth Debunked:** Solfeggio frequencies (e.g. 528 Hz, 963 Hz) do not have clinical properties like DNA repair, cellular regeneration, or specific emotional healing. They are sparse, non-octave absolute pitch sets.
- **Myth Debunked:** 432 Hz is not a "cosmic tuning" or "natural frequency of the universe." It is a historical standard shift that produces a slightly lower overall pitch, changing overall timbre and reducing high-end brightness slightly (which some perceive as "warmer").

### 3.3 Active Interface Disclaimers

When these systems are active in the control panel or patch builder, the following disclaimers are persistently displayed to ensure honest scientific grounding:

- **Solfeggio:** _"These nine frequencies are a modern reconstruction often associated with healing claims. AnnealMusic supports them because they produce a distinct non-octave-equivalent texture. The peer-reviewed evidence for specific clinical effects of these frequencies is absent."_
- **432 Hz Reference:** _"The claim that 432 Hz possesses unique natural healing or acoustic properties is unsupported by scientific literature. AnnealMusic includes this option because the slight downward pitch shift produces a subtly warmer and different timbre."_
- **Historical Western / Pythagorean:** _"Historical Western temperaments give different keys unique 'colors' due to unevenly distributed intervals. They produce beautiful acoustic textures but do not offer targeted physiological or medical benefits."_
