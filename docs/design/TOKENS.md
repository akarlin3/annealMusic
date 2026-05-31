# Design System Tokens Reference

This document catalogs the unified token system for **AnnealMusic v9.1**. The system persistent colors are warm-amber-dark, styled across three distinct voices.

---

## 1. Global Tokens

These tokens are common across all modes and define the typography stack:

```css
--font-family-display: 'Instrument Serif', Georgia, serif;
--font-family-body: 'Geist', system-ui, sans-serif;
--font-family-mono: 'Geist Mono', ui-monospace, monospace;
```

---

## 2. Per-Mode Token Values

| Token Variable                                    | Meditation          | Musician            | Researcher          |
| ------------------------------------------------- | ------------------- | ------------------- | ------------------- |
| **Background Base** (`--bg-base`)                 | `#090706`           | `#0c0a09`           | `#0f0d0c`           |
| **Accent Hue** (`--color-accent`)                 | `hsl(38, 90%, 45%)` | `hsl(38, 92%, 50%)` | `hsl(38, 70%, 48%)` |
| **Text Color** (`--color-text`)                   | `#e7e5e4`           | `#f5f5f4`           | `#fafaf9`           |
| **Muted Text** (`--color-muted`)                  | `#a8a29e`           | `#78716c`           | `#d6d3d1`           |
| **Surface Base** (`--color-surf`)                 | `#141210`           | `#1c1917`           | `#1f1c1a`           |
| **Borders** (`--color-border`)                    | `#1c1917`           | `#292524`           | `#3c3633`           |
| **Spacing Scale** (`--spacing-multiplier`)        | `1.15`              | `1.00`              | `0.85`              |
| **Body Font Weight** (`--font-weight-body`)       | `300`               | `400`               | `450`               |
| **Heading Weight** (`--font-weight-head`)         | `400`               | `600`               | `700`               |
| **Line Height** (`--line-height-body`)            | `1.75`              | `1.50`              | `1.40`              |
| **Motion Scale** (`--motion-duration-multiplier`) | `1.20`              | `1.00`              | `0.80`              |
| **Ornament Opacity** (`--ornament-opacity`)       | `0.08`              | `0.40`              | `0.80`              |
| **Chrome HUD Opacity** (`--chrome-opacity`)       | `0.15`              | `1.00`              | `1.00`              |

---

## 3. Dynamic Compilation

The design tokens are compiled dynamically at runtime by `<ModeAesthetic>` and mapped to standard custom CSS variables on `document.documentElement` scoped by `data-mode` attribute selectors.
