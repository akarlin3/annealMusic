import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ProgressClient,
  importLocalProgress,
  shouldShowSyncNudge,
  markSyncNudgeShown,
  IMPORT_FLAG,
} from '../progress/ProgressClient';
import {
  resumeLesson,
  readScrollRatio,
  applyScrollRatio,
} from '../progress/ResumeHandler';

const LESSON = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ProgressClient — anonymous (localStorage) tier', () => {
  it('saves progress to localStorage and never hits the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const client = new ProgressClient(false);
    await client.save(LESSON, {
      state: 'in_progress',
      current_step_position: 2,
      scroll_ratio: 0.5,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    const got = await client.get(LESSON);
    expect(got?.current_step_position).toBe(2);
    expect(got?.scroll_ratio).toBe(0.5);
    expect(got?.state).toBe('in_progress');
  });

  it('never downgrades a completed lesson', async () => {
    const client = new ProgressClient(false);
    await client.save(LESSON, { state: 'completed', current_step_position: 5 });
    await client.save(LESSON, {
      state: 'in_progress',
      current_step_position: 0,
    });
    const got = await client.get(LESSON);
    expect(got?.state).toBe('completed');
  });

  it('list() returns the local map keyed by lesson id', async () => {
    const client = new ProgressClient(false);
    await client.save(LESSON, {
      state: 'in_progress',
      current_step_position: 1,
    });
    const map = await client.list();
    expect(Object.keys(map)).toContain(LESSON);
  });
});

describe('ProgressClient — authenticated tier', () => {
  it('POSTs to the progress endpoint instead of localStorage', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));
    const client = new ProgressClient(true);
    await client.save(LESSON, {
      state: 'in_progress',
      current_step_position: 3,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0]!;
    expect(String(call[0])).toContain('/api/v1/lesson-progress');
    expect((call[1] as RequestInit).method).toBe('POST');
    // Nothing leaked to localStorage for an account user.
    expect(localStorage.getItem('am_learn_progress')).toBeNull();
  });
});

describe('importLocalProgress (anon → authed migration)', () => {
  it('uploads buffered local progress once, then clears it', async () => {
    const anon = new ProgressClient(false);
    await anon.save(LESSON, { state: 'in_progress', current_step_position: 2 });

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"items":[]}', { status: 200 }));

    const did = await importLocalProgress();
    expect(did).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]![0])).toContain(
      '/lesson-progress/import',
    );
    // localStorage progress cleared; import flag set so it won't re-run.
    expect(localStorage.getItem('am_learn_progress')).toBeNull();
    expect(localStorage.getItem(IMPORT_FLAG)).toBe('1');

    // A second call is a no-op (idempotent).
    const again = await importLocalProgress();
    expect(again).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not clear local progress if the import request fails', async () => {
    const anon = new ProgressClient(false);
    await anon.save(LESSON, { state: 'in_progress', current_step_position: 2 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 500 }),
    );

    const did = await importLocalProgress();
    expect(did).toBe(false);
    expect(localStorage.getItem('am_learn_progress')).not.toBeNull();
    expect(localStorage.getItem(IMPORT_FLAG)).toBeNull();
  });
});

describe('sync nudge — gentle, once per session', () => {
  it('shows only for anon users with local progress, and only once', async () => {
    expect(shouldShowSyncNudge(true)).toBe(false); // authed never nudged
    expect(shouldShowSyncNudge(false)).toBe(false); // no local progress yet

    await new ProgressClient(false).save(LESSON, { state: 'in_progress' });
    expect(shouldShowSyncNudge(false)).toBe(true);

    markSyncNudgeShown();
    expect(shouldShowSyncNudge(false)).toBe(false); // not again this session
  });
});

describe('resumeLesson', () => {
  it('returns null for a never-opened lesson', async () => {
    const client = new ProgressClient(false);
    expect(await resumeLesson(client, LESSON, 5)).toBeNull();
  });

  it('returns null for a completed lesson (re-opens at start)', async () => {
    const client = new ProgressClient(false);
    await client.save(LESSON, { state: 'completed', current_step_position: 4 });
    expect(await resumeLesson(client, LESSON, 5)).toBeNull();
  });

  it('resumes at the saved step and clamps a stale position', async () => {
    const client = new ProgressClient(false);
    await client.save(LESSON, {
      state: 'in_progress',
      current_step_position: 3,
      scroll_ratio: 0.4,
    });
    const point = await resumeLesson(client, LESSON, 6);
    expect(point?.stepIndex).toBe(3);
    expect(point?.scrollRatio).toBe(0.4);

    // If the lesson was shortened, the step index is clamped into range.
    const clamped = await resumeLesson(client, LESSON, 2);
    expect(clamped?.stepIndex).toBe(1);
  });
});

describe('scroll ratio helpers', () => {
  it('reads and applies a 0..1 ratio', () => {
    const el = {
      scrollHeight: 1000,
      clientHeight: 200,
      scrollTop: 400,
    } as HTMLElement;
    expect(readScrollRatio(el)).toBeCloseTo(0.5);

    const target = {
      scrollHeight: 1000,
      clientHeight: 200,
      scrollTop: 0,
    } as HTMLElement;
    applyScrollRatio(target, 0.25);
    expect(target.scrollTop).toBe(200);
  });

  it('is a no-op when content does not overflow', () => {
    const el = {
      scrollHeight: 100,
      clientHeight: 200,
      scrollTop: 0,
    } as HTMLElement;
    expect(readScrollRatio(el)).toBe(0);
  });
});
