import { PALETTE, VISUAL } from './palette';
import type { VisualState } from '../types';

/** Sample an amplitude proxy (0..1) for a frequency from the spectrum. */
export function ampForFreq(
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
export function drawFrame(ctx2d: CanvasRenderingContext2D, state: VisualState) {
  const {
    w,
    h,
    dt,
    phases,
    freqs,
    count,
    spectrum,
    sampleRate,
    fftSize,
    inputLevel,
    loops,
  } = state;

  // long-trail fade
  ctx2d.fillStyle = PALETTE.trailFade;
  ctx2d.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const baseR = Math.min(w, h) * VISUAL.baseRadiusFactor;

  // Faint input ring around the halo — present only when input is connected,
  // swelling with the live signal so it reads as part of the field.
  const calmAlphaScale = state.isCalm ? 0.6 : 1.0;
  const speedScale = state.isCalm ? 0.45 : 1.0;

  if (inputLevel !== undefined) {
    const lvl = Math.max(0, Math.min(1, inputLevel));
    const ringR =
      baseR *
      VISUAL.inputRingRadiusMultiple *
      (1 + lvl * VISUAL.inputRingSwell);
    const alpha =
      (VISUAL.inputRingBaseAlpha + lvl * VISUAL.inputRingAlphaScale) *
      calmAlphaScale;
    ctx2d.strokeStyle = PALETTE.inputRing(alpha);
    ctx2d.lineWidth = VISUAL.inputRingLineWidth;
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx2d.stroke();
  }

  // Per-slot loop rings: subtle partial arcs at distinct orbital radii, offset
  // in angle per slot so layered loops stay visually separable. Frozen slots
  // draw a fuller, slightly brighter ring (the texture is "held").
  if (loops) {
    for (const ring of loops) {
      const lvl = Math.max(0, Math.min(1, ring.level));
      const radius =
        baseR *
        (VISUAL.loopRingRadii[ring.slot] ?? 1.8) *
        (1 + lvl * VISUAL.loopRingSwell);
      const alpha =
        (VISUAL.loopRingBaseAlpha +
          lvl * VISUAL.loopRingAlphaScale +
          (ring.frozen ? 0.06 : 0)) *
        calmAlphaScale;
      const sweep = ring.frozen ? Math.PI * 2 : VISUAL.loopRingArc;
      const start = (ring.slot * (Math.PI * 2)) / 3;
      ctx2d.strokeStyle = PALETTE.loopRing(ring.slot, alpha);
      ctx2d.lineWidth = VISUAL.loopRingLineWidth;
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, radius, start, start + sweep);
      ctx2d.stroke();
    }
  }

  // central dim halo
  const halo = ctx2d.createRadialGradient(
    cx,
    cy,
    0,
    cx,
    cy,
    baseR * VISUAL.haloRadiusMultiple,
  );
  halo.addColorStop(
    0,
    state.isCalm ? 'rgba(245, 158, 11, 0.024)' : PALETTE.haloInner,
  );
  halo.addColorStop(1, PALETTE.haloOuter);
  ctx2d.fillStyle = halo;
  ctx2d.fillRect(0, 0, w, h);

  for (let i = 0; i < count; i++) {
    const freqHz = freqs[i] ?? 0;

    const visualRate = freqHz / VISUAL.visualRateRef;
    const phase =
      ((phases[i] ?? 0) + visualRate * dt * speedScale) % (Math.PI * 2);
    phases[i] = phase;

    const orbit = baseR * (0.45 + 0.55 * (i / Math.max(1, count - 1)));
    const x = cx + Math.cos(phase) * orbit;
    const y = cy + Math.sin(phase) * orbit * VISUAL.orbitSquash;

    const amp = spectrum
      ? ampForFreq(freqHz, spectrum, sampleRate, fftSize)
      : VISUAL.defaultAmp;

    const r = VISUAL.glowMinRadius + amp * VISUAL.glowAmpScale;
    const grad = ctx2d.createRadialGradient(x, y, 0, x, y, r);
    if (state.isCalm) {
      grad.addColorStop(0, `rgba(254, 215, 170, ${(0.55 + amp * 0.35) * 0.6})`);
      grad.addColorStop(0.4, `rgba(251, 191, 36, ${(0.3 + amp * 0.25) * 0.6})`);
    } else {
      grad.addColorStop(0, PALETTE.glowCore(amp));
      grad.addColorStop(0.4, PALETTE.glowMid(amp));
    }
    grad.addColorStop(1, PALETTE.glowEdge);
    ctx2d.fillStyle = grad;
    ctx2d.beginPath();
    ctx2d.arc(x, y, r, 0, Math.PI * 2);
    ctx2d.fill();
  }

  // subtle spectrum trace at the bottom
  if (spectrum) {
    ctx2d.strokeStyle = state.isCalm
      ? 'rgba(245, 245, 244, 0.096)'
      : PALETTE.spectrum;
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
