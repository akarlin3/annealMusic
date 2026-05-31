/**
 * v6.5 — discoverability maps + the "show learning hints" preference.
 *
 * The maps are the SINGLE source of truth for "which lesson explains this
 * surface" so the heuristic lives in one place (the rules-of-engagement
 * "lesson-hint primitive is one component used everywhere"). Lesson targets are
 * `track-slug/lesson-slug` paths into the curriculum seeded by
 * `api/app/services/curriculum_content.py`.
 *
 * Learning hints are opt-out: on by default, suppressed globally when the user
 * turns them off in Account Settings. The preference is device-local
 * (localStorage), matching the `useBreathPrefs` pattern.
 */
import { useCallback, useSyncExternalStore } from 'react';

import type { EngineId } from '@/audio/engines/types';
import type { CreativeMode } from '@/components/ModeToggle';

/** Engine → the synthesis-fundamentals lesson that explains it. */
export const ENGINE_LESSONS: Record<EngineId, string> = {
  sine: 'synthesis-fundamentals/sine-engine',
  fm: 'synthesis-fundamentals/fm-engine',
  granular: 'synthesis-fundamentals/granular-engine',
  physical: 'synthesis-fundamentals/physical-string',
  pulse: 'synthesis-fundamentals/pulse-engine',
};

/** `data-lesson-hint` value → the concept lesson it points at. */
export const PARAM_HINT_LESSONS: Record<string, string> = {
  filter: 'synthesis-fundamentals/additive-engine',
  harmonics: 'music-science-crossover/harmonic-series',
  spread: 'synthesis-fundamentals/sculpt-model',
  drift: 'synthesis-fundamentals/sculpt-model',
  tuning: 'music-science-crossover/harmonic-series',
  tempo: 'synthesis-fundamentals/pulse-engine',
};

/** Creative mode → the track most relevant to it. */
export const MODE_TRACKS: Record<CreativeMode, string> = {
  sketch: 'synthesis-fundamentals',
  compose: 'composition-technique',
  drone: 'ambient-history-listening',
};

/** The intro lesson surfaced by the first-time-user banner. */
export const INTRO_LESSON = 'synthesis-fundamentals/intro';

/** A `/learn` deep link (new-tab target) for a `track-slug/lesson-slug` path. */
export function lessonHref(lessonPath: string): string {
  return `/learn#lesson/${lessonPath}`;
}

const SHOW_HINTS_KEY = 'am_learn_hints';
const BANNER_DISMISSED_KEY = 'am_learn_banner_dismissed';

function readShowHints(): boolean {
  if (typeof localStorage === 'undefined') return true;
  // Opt-out: only an explicit '0' disables hints.
  return localStorage.getItem(SHOW_HINTS_KEY) !== '0';
}

// A tiny external store so every hint host re-renders the instant the toggle
// flips, without prop-drilling the flag through the whole main app.
const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}

export function setShowLearningHints(value: boolean): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SHOW_HINTS_KEY, value ? '1' : '0');
  }
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Reactive read of the global "show learning hints" preference (default on). */
export function useShowLearningHints(): boolean {
  return useSyncExternalStore(subscribe, readShowHints, () => true);
}

/** Imperative read for non-React callers. */
export function getShowLearningHints(): boolean {
  return readShowHints();
}

export function isBannerDismissed(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(BANNER_DISMISSED_KEY) === '1';
}

export function dismissBanner(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(BANNER_DISMISSED_KEY, '1');
  }
  emit();
}

/** Hook returning the banner's current visibility + a stable dismiss callback. */
export function useFirstTimeBanner(): { show: boolean; dismiss: () => void } {
  const showHints = useShowLearningHints();
  const dismissed = useSyncExternalStore(
    subscribe,
    isBannerDismissed,
    () => true,
  );
  const dismiss = useCallback(() => dismissBanner(), []);
  return { show: showHints && !dismissed, dismiss };
}
