import { afterEach, describe, expect, it, vi } from 'vitest';
import { LookaheadScheduler } from '@/loop/scheduler';

afterEach(() => {
  vi.useRealTimers();
});

describe('LookaheadScheduler', () => {
  it('pumps immediately on start with currentTime + lookAhead', () => {
    const clock = { currentTime: 5 };
    const seen: number[] = [];
    const s = new LookaheadScheduler(
      clock,
      (until) => seen.push(until),
      0.1,
      25,
    );
    s.start();
    expect(seen).toEqual([5.1]);
    s.stop();
  });

  it('keeps pumping on the timer until stopped', () => {
    vi.useFakeTimers();
    const clock = { currentTime: 0 };
    const seen: number[] = [];
    const s = new LookaheadScheduler(
      clock,
      (until) => seen.push(until),
      0.1,
      25,
    );
    s.start();
    for (let i = 0; i < 4; i++) {
      clock.currentTime += 0.025;
      vi.advanceTimersByTime(25);
    }
    expect(seen.length).toBe(5); // 1 immediate + 4 timer ticks
    s.stop();
    const after = seen.length;
    vi.advanceTimersByTime(100);
    expect(seen.length).toBe(after); // no more pumps after stop
  });

  it('reports running state', () => {
    vi.useFakeTimers();
    const s = new LookaheadScheduler({ currentTime: 0 }, () => undefined);
    expect(s.isRunning()).toBe(false);
    s.start();
    expect(s.isRunning()).toBe(true);
    s.stop();
    expect(s.isRunning()).toBe(false);
  });
});
