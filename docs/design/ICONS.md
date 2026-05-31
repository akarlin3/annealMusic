# Iconography Styling Specification

This document details the icon variations and line weighting specifications used across different modes.

---

## 1. Icon Grammar

We leverage standard icons from `lucide-react` dynamically adjusted using the `getIconProps(mode)` helper inside `src/design/tokens.ts`:

- **Meditation Mode**: Thin stroke weights (`strokeWidth={1.2}`), softer rounded outlines.
- **Musician Mode**: Standard stroke weights (`strokeWidth={1.8}`), balanced outlines.
- **Researcher Mode**: High-contrast, thick stroke weights (`strokeWidth={2.2}`), blocky and geometric outlines.

---

## 2. Icon Variants

For specific concepts:

- **Play Action**:
  - Meditation: A soft rounded outline triangle or Wind/Breath icon.
  - Musician: Standard play triangle/note.
  - Researcher: Solid sharp triangle.
