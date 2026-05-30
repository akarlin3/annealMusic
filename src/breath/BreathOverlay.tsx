/**
 * BreathOverlay — the slow-pulsing breath circle + phase-indicator ring (v4.4).
 *
 * Renders into its own absolutely-positioned canvas stacked above the v1.9
 * visualizer (the visualizer is dimmed slightly by the parent while breath is
 * active, so the circle reads). Phase comes entirely from `BreathController`,
 * driven by `getNow()` — the app passes `AudioContext.currentTime` so a
 * backgrounded tab resumes at the correct phase. Visual-only: no audio.
 *
 * Under `prefers-reduced-motion` (OS setting or the in-app pref), the circle
 * holds a fixed radius and cross-fades its colour between phases instead of
 * pulsing in size.
 */
import { useEffect, useRef } from 'react';
import { BreathController, type BreathPhase } from './BreathController';
import { BREATH, resolveTuple, type BreathPattern } from './patterns';
import { pulsePhaseTransition } from './hapticBridge';

interface BreathOverlayProps {
  pattern: BreathPattern | null;
  /** Whether the overlay is active (session past settle-in, drone on, etc.). */
  active: boolean;
  /** Absolute clock in seconds — pass `AudioContext.currentTime`. */
  getNow: () => number;
  /** Fire gentle haptics at phase transitions (mobile only; off by default). */
  haptics?: boolean;
  /** Force reduced-motion independent of the OS setting. */
  reduceMotion?: boolean;
}

function prefersReducedMotionOS(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const HOLD_LABELS: Partial<Record<BreathPhase, string>> = {
  'hold-full': 'hold',
  'hold-empty': 'hold',
};

export default function BreathOverlay({
  pattern,
  active,
  getNow,
  haptics = false,
  reduceMotion = false,
}: BreathOverlayProps): React.ReactElement | null {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<BreathController | null>(null);
  const rafRef = useRef<number | null>(null);
  // Keep latest props in refs so the RAF loop reads fresh values without restart.
  const getNowRef = useRef(getNow);
  const hapticsRef = useRef(haptics);
  const reduceRef = useRef(reduceMotion);
  getNowRef.current = getNow;
  hapticsRef.current = haptics;
  reduceRef.current = reduceMotion;

  const tuple = resolveTuple(pattern);
  const tupleKey = tuple ? tuple.join(',') : '';

  // (Re)build the controller whenever the resolved pattern changes.
  useEffect(() => {
    if (!tuple) {
      controllerRef.current = null;
      return;
    }
    const ctrl = new BreathController(tuple);
    ctrl.reset(getNowRef.current());
    controllerRef.current = ctrl;
  }, [tupleKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active || !tuple) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const ctrl = controllerRef.current;
      const parent = canvas.parentElement;
      if (ctrl && parent) {
        const dpr = window.devicePixelRatio || 1;
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr;
          canvas.height = h * dpr;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const frame = ctrl.frameAt(getNowRef.current());
        if (frame.transition && hapticsRef.current) {
          void pulsePhaseTransition(frame.phase);
        }

        const reduced = reduceRef.current || prefersReducedMotionOS();
        const cx = w / 2;
        const cy = h / 2;
        const minDim = Math.min(w, h);
        const rMin = minDim * BREATH.radiusMinFactor;
        const rMax = minDim * BREATH.radiusMaxFactor;

        let radius: number;
        let fillAlpha: number;
        if (reduced) {
          // Fade only: fixed radius, colour shifts with breath amplitude.
          radius = (rMin + rMax) / 2;
          fillAlpha =
            BREATH.fillAlphaMin +
            (BREATH.fillAlphaMax - BREATH.fillAlphaMin) * frame.amplitude;
        } else {
          radius = rMin + (rMax - rMin) * frame.amplitude;
          fillAlpha =
            BREATH.fillAlphaMin +
            (BREATH.fillAlphaMax - BREATH.fillAlphaMin) * frame.amplitude;
        }

        // Warm amber radial fill (matches the visualizer palette).
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, `rgba(254, 215, 170, ${fillAlpha})`);
        grad.addColorStop(0.6, `rgba(251, 191, 36, ${fillAlpha * 0.6})`);
        grad.addColorStop(1, 'rgba(251, 146, 60, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // Phase-indicator ring: a thin arc sweeping the whole cycle.
        const ringR = radius * BREATH.ringRadiusMultiple;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(245, 158, 11, ${0.18 + frame.amplitude * 0.12})`;
        ctx.lineWidth = BREATH.ringLineWidth;
        const start = -Math.PI / 2;
        ctx.arc(
          cx,
          cy,
          ringR,
          start,
          start + Math.PI * 2 * frame.cycleProgress,
        );
        ctx.stroke();

        // Optional faint lowercase "hold" label — no numerals, ever.
        const label = HOLD_LABELS[frame.phase];
        if (label) {
          ctx.fillStyle = `rgba(245, 245, 244, ${BREATH.holdLabelAlpha})`;
          ctx.font = `${Math.round(minDim * 0.035)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, cx, cy);
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [active, tupleKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active || !tuple) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}
