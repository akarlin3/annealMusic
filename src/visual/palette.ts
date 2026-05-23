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
} as const;
