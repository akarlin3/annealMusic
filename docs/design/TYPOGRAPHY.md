# Typography Scale & Mode Rules

This document specifies the font-families, scale hierarchies, and weights per mode.

---

## 1. Primary Families

We leverage the following font-family declarations:

- **Display (Serif)**: `'Instrument Serif', Georgia, serif`
- **Body (Sans-Serif)**: `'Geist', system-ui, sans-serif`
- **Telemetry (Monospace)**: `'Geist Mono', ui-monospace, monospace`

---

## 2. Per-Mode Weight Scales

### Meditation Mode

- Body Weight: `300` (Light, highly elegant)
- Heading Weight: `400` (Classic elegant serif)
- Line Height: `1.75` (Spacious and breathable)

### Musician Mode

- Body Weight: `400` (Standard)
- Heading Weight: `600` (Semibold display)
- Line Height: `1.50` (Standard readable)

### Researcher Mode

- Body Weight: `450` (Slightly heavier for prolonged screen reading)
- Heading Weight: `700` (Bold display)
- Line Height: `1.40` (Highly compact grid reading)
- Monospace Numbers: All telemetry displays and data figures explicitly enforce `font-variant-numeric: tabular-nums` to guarantee perfect vertical alignment.
