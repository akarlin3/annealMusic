import { useCallback, useEffect, useState } from 'react';
import { getOptInStatus } from '@/observability/errorReporter';

/** localStorage key recording that the first-run tour has been dismissed. */
export const TOUR_STORAGE_KEY = 'annealmusic.tour.v1';

export interface TourApi {
  /** Whether the walkthrough is currently showing. */
  active: boolean;
  /** Current step index. */
  step: number;
  /** Total step count (set by the Tour component via `setCount`). */
  start: () => void;
  next: () => void;
  prev: () => void;
  /** Dismiss and remember the dismissal so it never auto-runs again. */
  dismiss: () => void;
}

function alreadySeen(): boolean {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) != null;
  } catch {
    // Private mode / storage disabled: treat as seen so we don't nag.
    return true;
  }
}

function remember(): void {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, '1');
  } catch {
    // Ignore — dismissal simply won't persist across reloads.
  }
}

/**
 * Drives the first-run walkthrough. Auto-starts once on first visit (unless the
 * dismissal flag is already set), and exposes manual start/next/prev/dismiss for
 * the "Replay tour" affordance. Persistence uses `localStorage` — correct here
 * because this is the real deployed app, not a sandboxed artifact.
 */
export function useTour(): TourApi {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  // First-run auto-start, after mount so the target controls exist in the DOM.
  // Delay until the privacy consent dialog has been resolved (status is non-null).
  useEffect(() => {
    if (alreadySeen()) return;

    let timerId: ReturnType<typeof setTimeout> | null = null;

    const checkStart = () => {
      const optInChosen = getOptInStatus() !== null;
      if (optInChosen) {
        setStep(0);
        setActive(true);
      } else {
        timerId = setTimeout(checkStart, 500);
      }
    };

    timerId = setTimeout(checkStart, 500);
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  const start = useCallback(() => {
    setStep(0);
    setActive(true);
  }, []);

  const next = useCallback(() => setStep((s) => s + 1), []);
  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  const dismiss = useCallback(() => {
    setActive(false);
    remember();
  }, []);

  return { active, step, start, next, prev, dismiss };
}
