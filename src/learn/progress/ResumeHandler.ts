/**
 * v6.3 — resume mechanics. Restores the step a user paused on and their scroll
 * position within that step's body, cross-device for account users (the server
 * is the source of truth) and on-device for anon users (localStorage).
 *
 * Calm-by-design: resume is silent. There is no "Welcome back!" modal and no
 * nag — at most a quiet inline note that fades.
 */
import type { LessonProgress, ProgressClient } from './ProgressClient';

export interface ResumePoint {
  /** Step index to open at (clamped to the lesson's step range by the caller). */
  stepIndex: number;
  /** 0..1 scroll position within the step body. */
  scrollRatio: number;
  state: LessonProgress['state'];
}

/**
 * Compute where to resume a lesson. Returns null when there's nothing to resume
 * (never opened, or a completed lesson — which re-opens at the start).
 *
 * @param stepCount total steps in the lesson, used to clamp a stale position.
 */
export async function resumeLesson(
  client: ProgressClient,
  lessonId: string,
  stepCount: number,
): Promise<ResumePoint | null> {
  const row = await client.get(lessonId);
  if (!row) return null;
  // A completed lesson re-opens at the start (re-reading is fine, never "locked").
  if (row.state === 'completed') return null;
  const pos = row.current_step_position ?? 0;
  if (pos <= 0) return null;
  // Clamp to the current step range in case the lesson was edited since.
  const stepIndex = Math.min(Math.max(pos, 0), Math.max(stepCount - 1, 0));
  return {
    stepIndex,
    scrollRatio: row.scroll_ratio ?? 0,
    state: row.state,
  };
}

/** Apply a 0..1 scroll ratio to a step-body element (after it has rendered). */
export function applyScrollRatio(el: HTMLElement | null, ratio: number): void {
  if (!el || !ratio) return;
  const max = el.scrollHeight - el.clientHeight;
  if (max > 0) el.scrollTop = Math.round(max * Math.min(Math.max(ratio, 0), 1));
}

/** Read the current 0..1 scroll ratio of a step-body element. */
export function readScrollRatio(el: HTMLElement | null): number {
  if (!el) return 0;
  const max = el.scrollHeight - el.clientHeight;
  if (max <= 0) return 0;
  return Math.min(Math.max(el.scrollTop / max, 0), 1);
}
