/**
 * v6.3 — tiered lesson-progress client.
 *
 * Calm-by-design + privacy: an account user's progress is the server's (so it
 * follows them across devices); an anonymous user's progress stays *only* in
 * localStorage and is never written to the server (the server endpoints exist but
 * the client deliberately doesn't drive them for anon). On first sign-in the
 * buffered localStorage progress is imported once via {@link importLocalProgress}.
 *
 * There is nothing engagement-shaped here: no streak, no score — just enough to
 * resume a lesson and feed the (opt-in, offered-not-pushed) next-lesson picker.
 */

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

const LS_KEY = 'am_learn_progress';
export const IMPORT_FLAG = 'am_learn_progress_imported';
export const SYNC_NUDGE_FLAG = 'am_learn_sync_nudge_shown';

export type ProgressState =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'abandoned';

// Navigation actions carry time-on-step; v6.5 adds (additively) the
// engagement-signal actions the admin analytics surface reads. All are
// aggregate, anonymized signals — never per-user-exposed.
export type StepActionType =
  | 'started'
  | 'completed'
  | 'skipped'
  | 'clip_play'
  | 'clip_replay'
  | 'prompt_tried'
  | 'prompt_skipped';

export interface StepAction {
  step_position: number;
  action: StepActionType;
  ms: number;
  at?: string;
}

export interface LessonProgress {
  lesson_id: string;
  state: ProgressState;
  current_step_position: number;
  scroll_ratio: number;
  started_at?: string | null;
  last_active_at?: string | null;
  completed_at?: string | null;
  reflection_text?: string | null;
}

/** A partial update sent on a heartbeat / pause / completion. */
export interface ProgressPatch {
  state?: 'in_progress' | 'completed';
  current_step_position?: number;
  scroll_ratio?: number;
  step_actions?: StepAction[];
  reflection_text?: string | null;
}

function anonHeader(): Record<string, string> {
  const id =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('am_anon_id')
      : null;
  return id ? { 'x-anon-id': id } : {};
}

async function apiFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T | null> {
  try {
    const headers: Record<string, string> = { ...anonHeader() };
    let payload: string | undefined;
    if (opts.body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(opts.body);
    }
    const res = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: payload,
      credentials: 'include',
    });
    if (!res.ok) return null;
    if (res.status === 204) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// --- localStorage tier (anonymous) ------------------------------------------

function readLocal(): Record<string, LessonProgress> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LessonProgress>) : {};
  } catch {
    return {};
  }
}

function writeLocal(map: Record<string, LessonProgress>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {
    /* quota / disabled storage — progress is best-effort for anon */
  }
}

function mergeLocal(
  existing: LessonProgress | undefined,
  lessonId: string,
  patch: ProgressPatch,
): LessonProgress {
  const now = new Date().toISOString();
  const base: LessonProgress = existing ?? {
    lesson_id: lessonId,
    state: 'in_progress',
    current_step_position: 0,
    scroll_ratio: 0,
    started_at: now,
  };
  // State only advances; a completed lesson is never un-completed locally.
  let state = base.state;
  if (patch.state === 'completed') state = 'completed';
  else if (state === 'not_started') state = 'in_progress';

  return {
    ...base,
    state,
    current_step_position:
      patch.current_step_position ?? base.current_step_position,
    scroll_ratio: patch.scroll_ratio ?? base.scroll_ratio,
    started_at: base.started_at ?? now,
    last_active_at: now,
    completed_at:
      state === 'completed' ? (base.completed_at ?? now) : base.completed_at,
    reflection_text:
      patch.reflection_text !== undefined
        ? patch.reflection_text
        : base.reflection_text,
  };
}

// --- public client ----------------------------------------------------------

export class ProgressClient {
  private authenticated: boolean;

  constructor(authenticated: boolean) {
    this.authenticated = authenticated;
  }

  get isAuthenticated(): boolean {
    return this.authenticated;
  }

  /** Persist a progress update. Account → server; anon → localStorage only. */
  async save(lessonId: string, patch: ProgressPatch): Promise<void> {
    if (this.authenticated) {
      await apiFetch<LessonProgress>('/api/v1/lesson-progress', {
        method: 'POST',
        body: { lesson_id: lessonId, ...patch },
      });
      return;
    }
    const map = readLocal();
    map[lessonId] = mergeLocal(map[lessonId], lessonId, patch);
    writeLocal(map);
  }

  /**
   * A fire-and-forget save for tab-close (`visibilitychange`/`beforeunload`).
   * Uses `sendBeacon` for account users so a closing tab still flushes; anon
   * users just write localStorage synchronously.
   */
  saveBeacon(lessonId: string, patch: ProgressPatch): void {
    if (!this.authenticated) {
      const map = readLocal();
      map[lessonId] = mergeLocal(map[lessonId], lessonId, patch);
      writeLocal(map);
      return;
    }
    try {
      const body = JSON.stringify({ lesson_id: lessonId, ...patch });
      const url = `${API_BASE}/api/v1/lesson-progress`;
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      } else {
        void apiFetch('/api/v1/lesson-progress', {
          method: 'POST',
          body: { lesson_id: lessonId, ...patch },
        });
      }
    } catch {
      /* best-effort */
    }
  }

  /** Read one lesson's progress (resume). Returns null if none / not started. */
  async get(lessonId: string): Promise<LessonProgress | null> {
    if (this.authenticated) {
      const row = await apiFetch<LessonProgress>(
        `/api/v1/lesson-progress/${lessonId}`,
      );
      if (!row || row.state === 'not_started') return null;
      return row;
    }
    const local = readLocal()[lessonId];
    return local && local.state !== 'not_started' ? local : null;
  }

  /** All progress rows, keyed by lesson_id, for curriculum-browser checkmarks. */
  async list(): Promise<Record<string, LessonProgress>> {
    if (this.authenticated) {
      const res = await apiFetch<{ items: LessonProgress[] }>(
        '/api/v1/lesson-progress',
      );
      const out: Record<string, LessonProgress> = {};
      for (const r of res?.items ?? []) out[r.lesson_id] = r;
      return out;
    }
    return readLocal();
  }
}

/**
 * One-shot anon→authed migration: upload buffered localStorage progress on first
 * sign-in, then clear it (the server is now the source of truth). Idempotent: the
 * import flag and the server-side max-merge make a re-run a no-op.
 */
export async function importLocalProgress(): Promise<boolean> {
  if (typeof localStorage === 'undefined') return false;
  if (localStorage.getItem(IMPORT_FLAG)) return false;
  const map = readLocal();
  const items = Object.values(map);
  if (items.length === 0) {
    localStorage.setItem(IMPORT_FLAG, '1');
    return false;
  }
  const res = await apiFetch('/api/v1/lesson-progress/import', {
    method: 'POST',
    body: {
      items: items.map((p) => ({
        lesson_id: p.lesson_id,
        state: p.state === 'abandoned' ? 'in_progress' : p.state,
        current_step_position: p.current_step_position,
        scroll_ratio: p.scroll_ratio,
        started_at: p.started_at,
        last_active_at: p.last_active_at,
        completed_at: p.completed_at,
        reflection_text: p.reflection_text,
      })),
    },
  });
  if (res === null) return false; // import failed; keep local for a later retry
  localStorage.setItem(IMPORT_FLAG, '1');
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
  return true;
}

/**
 * Gentle sync nudge: show at most once per browser session, and only for an
 * anon user who actually has local progress worth syncing. Never recurring,
 * never guilt-framed (the copy lives in the component).
 */
export function shouldShowSyncNudge(authenticated: boolean): boolean {
  if (authenticated) return false;
  if (typeof sessionStorage === 'undefined') return false;
  if (sessionStorage.getItem(SYNC_NUDGE_FLAG)) return false;
  return Object.keys(readLocal()).length > 0;
}

export function markSyncNudgeShown(): void {
  try {
    sessionStorage?.setItem(SYNC_NUDGE_FLAG, '1');
  } catch {
    /* ignore */
  }
}
