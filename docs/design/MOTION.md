# Motion Grammar & Animation Specs

This document defines the animation specifications, transitions, and curves that form the visual grammar across modes.

---

## 1. Specifications

Transitions are mapped to `--motion-duration-multiplier` to scale speed:

### Meditation Mode

- **Goal**: Breathe, settle, calm.
- **Multiplier**: `1.2x` (slower, longer fades).
- **Easing Curve**: `cubic-bezier(0.4, 0, 0.2, 1)` (graceful, sine-like).

### Musician Mode

- **Goal**: High tactile feedback.
- **Multiplier**: `1.0x` (standard responsive speed).
- **Easing Curve**: `cubic-bezier(0.4, 0, 0.2, 1)`.

### Researcher Mode

- **Goal**: Zero distraction, efficiency.
- **Multiplier**: `0.8x` (snappier, immediate).
- **Easing Curve**: `cubic-bezier(0, 0, 0.2, 1)` (sharp linear-out).

---

## 2. Reduced Motion Support

When the user specifies a system preference for reduced motion (`prefers-reduced-motion: reduce`), the system overrides all transitions:

```css
--motion-duration-multiplier: 0 !important;
```

This forces all element transitions and states to update instantly.
