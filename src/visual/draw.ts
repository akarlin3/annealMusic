import { PALETTE, VISUAL } from '@/visual/palette';

export interface DrawState {
  /** CSS-pixel canvas size (transform already applies DPR). */
  w: number;
  h: number;
  /** Frame delta in seconds (clamped by the caller). */
  dt: number;
  /** Visual phase per partial, in radians. Advanced in place each frame. */
  phases: number[];
  /** Resolved frequency (Hz) per partial. */
  freqs: number[];
  /** Number of partials currently sounding (or the density fallback). */
  count: number;
  /** Latest analyser magnitude spectrum, or null when silent. */
  spectrum: Uint8Array | null;
  sampleRate: number;
  fftSize: number;
}

/** Sample an amplitude proxy (0..1) for a frequency from the spectrum. */
function ampForFreq(
  freqHz: number,
  spectrum: Uint8Array,
  sampleRate: number,
  fftSize: number,
): number {
  const binHz = sampleRate / fftSize;
  const bin = Math.min(
    spectrum.length - 1,
    Math.max(2, Math.round(freqHz / binHz)),
  );
  let s = 0;
  for (let k = bin - 1; k <= bin + 1; k++) {
    const idx = Math.max(0, Math.min(spectrum.length - 1, k));
    s += spectrum[idx] ?? 0;
  }
  return s / 3 / 255;
}

/**
 * Render one frame of the visualizer. Mutates `state.phases` in place to
 * advance each orbit; otherwise does not retain state between calls.
 */
export function drawFrame(ctx2d: CanvasRenderingContext2D, state: DrawState) {
  const { w, h, dt, phases, freqs, count, spectrum, sampleRate, fftSize } =
    state;

  // long-trail fade
  ctx2d.fillStyle = PALETTE.trailFade;
  ctx2d.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const baseR = Math.min(w, h) * VISUAL.baseRadiusFactor;

  // central dim halo
  const halo = ctx2d.createRadialGradient(
    cx,
    cy,
    0,
    cx,
    cy,
    baseR * VISUAL.haloRadiusMultiple,
  );
  halo.addColorStop(0, PALETTE.haloInner);
  halo.addColorStop(1, PALETTE.haloOuter);
  ctx2d.fillStyle = halo;
  ctx2d.fillRect(0, 0, w, h);

  for (let i = 0; i < count; i++) {
    const freqHz = freqs[i] ?? 0;

    const visualRate = freqHz / VISUAL.visualRateRef;
    const phase = ((phases[i] ?? 0) + visualRate * dt) % (Math.PI * 2);
    phases[i] = phase;

    const orbit = baseR * (0.45 + 0.55 * (i / Math.max(1, count - 1)));
    const x = cx + Math.cos(phase) * orbit;
    const y = cy + Math.sin(phase) * orbit * VISUAL.orbitSquash;

    const amp = spectrum
      ? ampForFreq(freqHz, spectrum, sampleRate, fftSize)
      : VISUAL.defaultAmp;

    const r = VISUAL.glowMinRadius + amp * VISUAL.glowAmpScale;
    const grad = ctx2d.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, PALETTE.glowCore(amp));
    grad.addColorStop(0.4, PALETTE.glowMid(amp));
    grad.addColorStop(1, PALETTE.glowEdge);
    ctx2d.fillStyle = grad;
    ctx2d.beginPath();
    ctx2d.arc(x, y, r, 0, Math.PI * 2);
    ctx2d.fill();
  }

  // subtle spectrum trace at the bottom
  if (spectrum) {
    ctx2d.strokeStyle = PALETTE.spectrum;
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    const bottom = h - VISUAL.spectrumBottomPad;
    const usable = Math.floor(spectrum.length * VISUAL.spectrumUsableFraction);
    for (let i = 0; i < usable; i++) {
      const x = (i / usable) * w;
      const v = (spectrum[i] ?? 0) / 255;
      const y = bottom - v * VISUAL.spectrumHeight;
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    }
    ctx2d.stroke();
  }
}
