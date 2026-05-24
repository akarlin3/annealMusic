import type { AnnealMusicParams } from '@/state/params';

/** Which way a session runs: free-form ("open") or a scripted arc. */
export type SessionMode = 'open' | 'arc';

/** Runtime list of session modes (drives the share schema manifest). */
export const SESSION_MODES: readonly SessionMode[] = ['open', 'arc'];

/**
 * Orchestrator session lifecycle. `stopping` is a real state so the fade-out
 * (manual settle or arc-end crossfade) has a home; transitions never skip it.
 */
export type SessionState =
  | 'idle'
  | 'starting'
  | 'running-open'
  | 'running-arc'
  | 'stopping';

/** Easing functions available to arc segments (defined in `curves.ts`). */
export type CurveName = 'linear' | 'easeInOut' | 'exponential';

/** Sculptable shared params an arc may target (everything but volume). */
export type ArcTargetKey =
  | 'rootFreq'
  | 'spread'
  | 'density'
  | 'coupling'
  | 'drift'
  | 'brightness'
  | 'space';

/**
 * A target for one key within a segment. A number is a **multiplier on the
 * user's captured start value** (so pre-session sculpting is the neutral pose);
 * `'min'`/`'max'` resolve to the param's declared bound.
 */
export type TargetValue = number | 'min' | 'max';

/**
 * Per-key targets for a segment, or the sentinel `'restoreStart'` meaning "ease
 * every key the arc touches back to its captured start value."
 */
export type SegmentTargets =
  | Partial<Record<ArcTargetKey, TargetValue>>
  | 'restoreStart';

export interface ArcSegment {
  /** Share of the total duration. Fractions across an arc sum to 1.0 (±ε). */
  fraction: number;
  curve: CurveName;
  targets: SegmentTargets;
}

export interface Arc {
  id: string;
  name: string;
  description: string;
  segments: ArcSegment[];
}

/** One arc tick's output: the params to apply plus progress bookkeeping. */
export interface ArcFrame {
  params: Partial<AnnealMusicParams>;
  segmentIndex: number;
  progress: number;
  done: boolean;
}
