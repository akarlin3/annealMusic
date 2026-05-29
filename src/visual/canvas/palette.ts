/** Warm-dark palette and visual tuning constants, ported from the prototype. */
export const PALETTE = {
  bg: '#0c0a09',
  trailFade: 'rgba(12, 10, 9, 0.10)',
  haloInner: 'rgba(245, 158, 11, 0.04)',
  haloOuter: 'rgba(245, 158, 11, 0)',
  glowCore: (a: number) => `rgba(254, 215, 170, ${0.55 + a * 0.35})`,
  glowMid: (a: number) => `rgba(251, 191, 36, ${0.3 + a * 0.25})`,
  glowEdge: 'rgba(251, 146, 60, 0)',
  spectrum: 'rgba(245, 245, 244, 0.16)',
  /** Faint amber ring around the halo, driven by live-input amplitude. */
  inputRing: (a: number) => `rgba(251, 191, 36, ${a})`,
  /** Per-slot loop rings: amber (A), warm rose (B), cool cyan (C). */
  loopRing: (slot: number, a: number): string => {
    const rgb = [
      [245, 158, 11],
      [248, 113, 113],
      [125, 211, 252],
    ][slot % 3] ?? [245, 158, 11];
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
  },
} as const;

export const VISUAL = {
  /** Base orbit radius as a fraction of min(w, h). */
  baseRadiusFactor: 0.3,
  /** Halo radius multiple of the base radius. */
  haloRadiusMultiple: 1.6,
  /** Vertical squash applied to orbits. */
  orbitSquash: 0.78,
  /** Reference frequency for visual phase advance (Hz). */
  visualRateRef: 220,
  /** Glow radius in px: min + amp * scale. */
  glowMinRadius: 5,
  glowAmpScale: 22,
  /** Default amplitude when no analyser data is available. */
  defaultAmp: 0.4,
  /** Fraction of spectrum bins drawn in the bottom trace. */
  spectrumUsableFraction: 0.45,
  spectrumHeight: 36,
  spectrumBottomPad: 10,
  /** Input ring: base radius multiple of baseR, swell, and opacity curve. */
  inputRingRadiusMultiple: 1.6,
  inputRingSwell: 0.25,
  inputRingBaseAlpha: 0.05,
  inputRingAlphaScale: 0.18,
  inputRingLineWidth: 1.5,
  /** Loop rings: orbital radius multiples of baseR (one per slot) + dynamics. */
  loopRingRadii: [1.78, 1.98, 2.18],
  loopRingSwell: 0.18,
  loopRingBaseAlpha: 0.06,
  loopRingAlphaScale: 0.22,
  loopRingLineWidth: 1.5,
  /** Arc sweep (radians) drawn per loop ring — partial arcs read as separable. */
  loopRingArc: 1.7,
} as const;
