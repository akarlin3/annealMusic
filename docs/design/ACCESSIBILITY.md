# Accessibility Audit & Standards

This document establishes the accessibility standards implemented across **AnnealMusic v9.1**.

---

## 1. Contrast Ratios (WCAG 2.1 AA)

All mode-specific token palettes are audited to guarantee color contrast ratios of **at least 4.5:1** for regular text and **3.0:1** for large text against their respective background bases.

- **Meditation**: Background `#090706` vs Text `#e7e5e4` (Contrast ratio ~ 16.5:1).
- **Musician**: Background `#0c0a09` vs Text `#f5f5f4` (Contrast ratio ~ 18.0:1).
- **Researcher**: Background `#0f0d0c` vs Text `#fafaf9` (Contrast ratio ~ 18.5:1).

---

## 2. Keyboard Navigability

All interactive custom sliders and buttons are accessible via the keyboard:

- Slider thumbs are actual `<input type="range">` elements, enabling left/right arrow adjustments naturally.
- Buttons are semantic `<button>` elements, supporting focus rings and `Enter`/`Space` selections.

---

## 3. Touch Targets (Min 44px)

Custom buttons and slider thumbs enforce a **minimum 44×44px hit-target area** to support touch targets on mobile:

- Smaller icon buttons are padded with an invisible touch frame inside `Button.tsx`.
- Range slider thumbs use absolute overlay sizes to ensure consistent hit-zones.

---

## 4. Reduced Motion

Media query `prefers-reduced-motion: reduce` instantly overrides all transition-duration variables to `0s` and disables keyframe animations.
