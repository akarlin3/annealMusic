# Component Library Catalog

This catalog outlines the canonical visual elements constructed for the **v9.1 design system**. Each primitive automatically adapts its borders, fonts, spacing, and transitions based on the active mode context via dynamic CSS variables.

---

## 1. Components Catalog

### A. Button (`Button.tsx`)

A flexible command action element:

- **Primary Variant**: Amber background with black text. Scaled slightly on press.
- **Secondary Variant**: Thin stone/accent borders, transparent/amber-tinted background.
- **Ghost Variant**: Unadorned text button. Inherits surrounding colors.
- **Destructive Variant**: Deep red text and border outlining for safe warning.

### B. Slider (`Slider.tsx`)

Accessible precision value slider:

- Fully continuous.
- Enforces an invisible `44×44px` hit-target layout on the thumb element.
- Enforces monospace tabular numbers (`.tabular-nums`) for clean visual output.

### C. Panel (`Panel.tsx`)

Overlay windows and floating dialogue widgets:

- Supports `modal`, `drawer`, `popover`, and `tooltip` variants.
- High-fidelity glassmorphism using `backdrop-blur-md` and semi-transparent surfaces.

### D. Card (`Card.tsx`)

Structured containers for lessons, studies, and tracks:

- Support for hover states (glow, scale, borders).
- Interactive mode shifts borders slightly on hover.

### E. Input (`Input.tsx`)

Unified text input and text area fields:

- Scaped styling adapting to standard, multiline, and placeholder layouts.
- Built-in theme-driven labels, borders, and high-visibility focus indicators.
- Transition timings scale automatically based on motion speed multiplier.

### F. Select (`Select.tsx`)

Sleek, customizable dropdown picker primitive:

- Completely hides generic browser select UI using standard token aesthetics.
- Supports native-aligned drop indicators, dynamic list options, and robust accessibility targets.
