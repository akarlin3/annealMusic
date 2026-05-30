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
