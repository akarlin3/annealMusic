/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { BELL_REGISTRY, getBellById } from './registry';
import { BellLoader } from './loader';
import { BellScheduler, type ResolvedBellTrigger } from './scheduler';

describe('bell registry', () => {
  it('ships 10–14 bells', () => {
    expect(BELL_REGISTRY.length).toBeGreaterThanOrEqual(10);
    expect(BELL_REGISTRY.length).toBeLessThanOrEqual(14);
  });

  it('every bell has a non-empty license', () => {
    for (const b of BELL_REGISTRY) {
      expect(b.license, `bell ${b.id} is missing a license`).toBeTruthy();
      expect(b.license.trim().length).toBeGreaterThan(0);
      expect(b.license).toBe('CC0-1.0'); // all synthesized bells are CC0
    }
  });

  it('every bell has a unique ID and valid details', () => {
    const ids = new Set(BELL_REGISTRY.map((b) => b.id));
    expect(ids.size).toBe(BELL_REGISTRY.length);
    for (const b of BELL_REGISTRY) {
      expect(b.name.length).toBeGreaterThan(0);
      expect(b.file).toBe(`bells/${b.id}.opus`);
      expect(b.description.length).toBeGreaterThan(0);
      expect(b.category.length).toBeGreaterThan(0);
    }
  });

  it('lookups by ID work', () => {
    for (const b of BELL_REGISTRY) {
      expect(getBellById(b.id)).toBe(b);
    }
    expect(getBellById('does_not_exist')).toBeUndefined();
  });
});

describe('BellScheduler', () => {
  let mockCtx: any;
  let mockDest: any;
  let mockSource: any;
  let mockGain: any;
  let scheduler: BellScheduler;

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock AudioBufferSourceNode
    mockSource = {
      buffer: null,
      connect: vi.fn().mockImplementation(() => mockSource),
      start: vi.fn(),
    };

    // Mock GainNode
    mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    // Mock AudioContext
    mockCtx = {
      currentTime: 10.0, // start clock at 10.0s
      createBufferSource: vi.fn().mockReturnValue(mockSource),
      createGain: vi.fn().mockReturnValue(mockGain),
    };

    mockDest = {};

    // Mock BellLoader to return a fake AudioBuffer instantly
    vi.spyOn(BellLoader, 'loadBell').mockResolvedValue({} as AudioBuffer);

    scheduler = new BellScheduler(mockCtx as any, mockDest as any);
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sorts and stores triggers', () => {
    const raw: ResolvedBellTrigger[] = [
      { offsetMs: 2000, bellId: 'zen_bell_rin', volume: 0.8 },
      { offsetMs: 500, bellId: 'tibetan_bowl_med', volume: 0.6 },
    ];
    scheduler.setTriggers(raw);
    const sorted = scheduler.getTriggers();
    expect(sorted[0]?.offsetMs).toBe(500);
    expect(sorted[1]?.offsetMs).toBe(2000);
  });

  it('schedules triggers in look-ahead window', async () => {
    const raw: ResolvedBellTrigger[] = [
      { offsetMs: 100, bellId: 'zen_bell_rin', volume: 0.8 },
      { offsetMs: 200, bellId: 'tibetan_bowl_med', volume: 0.6 },
      { offsetMs: 1500, bellId: 'crystal_bowl_c', volume: 0.5 },
    ];
    scheduler.setTriggers(raw);

    // Start playback. Elapsed is 0ms.
    // lookAheadMs is 300ms. Events at 100ms and 200ms should be scheduled!
    // Event at 1500ms should NOT be scheduled yet.
    scheduler.start(0);

    // Allow async microtasks (BellLoader resolve) to complete
    await vi.runOnlyPendingTimersAsync();

    expect(BellLoader.loadBell).toHaveBeenCalledWith(mockCtx, 'zen_bell_rin');
    expect(BellLoader.loadBell).toHaveBeenCalledWith(
      mockCtx,
      'tibetan_bowl_med',
    );
    expect(BellLoader.loadBell).not.toHaveBeenCalledWith(
      mockCtx,
      'crystal_bowl_c',
    );

    // Zen bell is at 100ms offset -> scheduled at 10.0s + 0.1s = 10.1s
    // Tibetan bell is at 200ms offset -> scheduled at 10.0s + 0.2s = 10.2s
    expect(mockGain.gain.setValueAtTime).toHaveBeenCalledWith(0.8, 10.1);
    expect(mockGain.gain.setValueAtTime).toHaveBeenCalledWith(0.6, 10.2);
    expect(mockSource.start).toHaveBeenCalledWith(10.1);
    expect(mockSource.start).toHaveBeenCalledWith(10.2);
  });

  it('does not double-schedule triggers', async () => {
    const raw: ResolvedBellTrigger[] = [
      { offsetMs: 100, bellId: 'zen_bell_rin', volume: 0.8 },
    ];
    scheduler.setTriggers(raw);
    scheduler.start(0);

    await vi.runOnlyPendingTimersAsync();
    expect(BellLoader.loadBell).toHaveBeenCalledTimes(1);

    // Advance clock by 50ms and trigger a scheduler tick manually (or via fake timer)
    mockCtx.currentTime += 0.05;
    vi.advanceTimersByTime(100);

    await vi.runOnlyPendingTimersAsync();
    // Should still have been called exactly once
    expect(BellLoader.loadBell).toHaveBeenCalledTimes(1);
  });
});
