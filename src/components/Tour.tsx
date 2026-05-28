import { useEffect, useLayoutEffect, useState } from 'react';
import { ABOUT_INTRO, getExplain } from '@/content/explanations';
import type { TourApi } from '@/hooks/useTour';

interface TourStep {
  /** `data-tour` attribute of the element to spotlight (omit for a centered card). */
  target?: string;
  /** Step heading. */
  title: string;
  /** Step body — sourced from the copy registry for control steps. */
  body: string;
}

/**
 * The walkthrough script. Substantive control explanations are pulled from the
 * single copy registry (`getExplain(...).tooltip`) so the tour can never drift
 * from the tooltips and captions. Only the welcome card and the final
 * action prompt are tour-specific (an instruction, not a control explanation).
 */
const STEPS: TourStep[] = [
  {
    title: 'Welcome to AnnealMusic',
    body: `${ABOUT_INTRO} This quick tour points out the handful of sliders that matter most.`,
  },
  { target: 'rootFreq', title: 'Root', body: getExplain('rootFreq')!.tooltip },
  { target: 'spread', title: 'Spread', body: getExplain('spread')!.tooltip },
  { target: 'density', title: 'Density', body: getExplain('density')!.tooltip },
  { target: 'drift', title: 'Drift', body: getExplain('drift')!.tooltip },
  {
    target: 'engine',
    title: 'The sound',
    body: getExplain('engine')!.tooltip,
  },
  {
    target: 'play',
    title: 'Press Begin',
    body: 'That’s it — press Begin and the sound fades in and drifts on its own. Tweak anything as it plays, or just listen.',
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function findTarget(target: string | undefined): HTMLElement | null {
  if (!target) return null;
  return document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
}

/**
 * Lightweight, dependency-free spotlight walkthrough. Dims the page and frames
 * the current target element, with a tooltip card and Next/Skip controls. The
 * spotlight transition is suppressed under `prefers-reduced-motion`.
 */
export default function Tour({ tour }: { tour: TourApi }) {
  const { active, step, next, prev, dismiss } = tour;
  const [rect, setRect] = useState<Rect | null>(null);
  const reduced = prefersReducedMotion();

  const current = STEPS[Math.min(step, STEPS.length - 1)];
  const isLast = step >= STEPS.length - 1;

  // Measure the current target and keep it in sync with layout changes.
  useLayoutEffect(() => {
    if (!active || !current) return;
    const measure = (): void => {
      const el = findTarget(current.target);
      if (!el) {
        setRect(null);
        return;
      }
      el.scrollIntoView({
        block: 'center',
        behavior: reduced ? 'auto' : 'smooth',
      });
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [active, current, step, reduced]);

  // Reset to no-rect when closed so a re-open re-measures cleanly.
  useEffect(() => {
    if (!active) setRect(null);
  }, [active]);

  if (!active || !current) return null;

  const pad = 8;
  const hole = rect
    ? {
        top: Math.max(0, rect.top - pad),
        left: Math.max(0, rect.left - pad),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // Place the card below the target, or above if it'd run off the bottom.
  const cardWidth = 300;
  let cardStyle: React.CSSProperties;
  if (hole) {
    const below = hole.top + hole.height + 12;
    const placeAbove = below + 160 > window.innerHeight;
    const top = placeAbove ? Math.max(12, hole.top - 12) : below;
    const left = Math.min(
      Math.max(12, hole.left),
      window.innerWidth - cardWidth - 12,
    );
    cardStyle = {
      position: 'fixed',
      top,
      left,
      width: cardWidth,
      transform: placeAbove ? 'translateY(-100%)' : undefined,
    };
  } else {
    cardStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      width: cardWidth,
      transform: 'translate(-50%, -50%)',
    };
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Getting-started walkthrough"
      className="fixed inset-0 z-[70]"
    >
      {/* Dimmer + spotlight cutout (big box-shadow punches the hole). */}
      {hole ? (
        <div
          aria-hidden="true"
          className={reduced ? '' : 'transition-all duration-300'}
          style={{
            position: 'fixed',
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            borderRadius: 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
            border: '1px solid #f59e0b',
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.72)',
          }}
        />
      )}

      <div
        className="rounded-lg p-5"
        style={{
          ...cardStyle,
          background: '#1c1917',
          border: '1px solid #44403c',
          boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
        }}
      >
        <div
          className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em]"
          style={{ color: '#78716c' }}
        >
          Step {step + 1} of {STEPS.length}
        </div>
        <h2 className="font-display text-xl" style={{ color: '#fef3c7' }}>
          {current.title}
        </h2>
        <p
          className="mt-2 text-[13px] leading-relaxed"
          style={{ color: '#a8a29e' }}
        >
          {current.body}
        </p>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={dismiss}
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: '#78716c' }}
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={prev}
                className="rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ border: '1px solid #44403c', color: '#a8a29e' }}
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={isLast ? dismiss : next}
              className="rounded-full px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ background: '#f59e0b', color: '#0c0a09' }}
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
