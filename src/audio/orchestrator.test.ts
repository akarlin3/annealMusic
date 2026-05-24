import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Orchestrator } from '@/audio/orchestrator';
import { DEFAULT_PARAMS } from '@/state/params';
import { MockAudioContext, type MockNode } from '@/test/audioMock';
import type { AnnealEngine } from '@/audio/engines/types';

beforeEach(() => {
  vi.stubGlobal('AudioContext', MockAudioContext);
  vi.useFakeTimers();
  MockAudioContext.instances.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  MockAudioContext.instances.length = 0;
});

/** True if a node's gain has a `linearRampToValueAtTime(value, t)` call. */
function hasGainRamp(node: MockNode, value: number, t: number): boolean {
  return node.gain.calls.some(
    (c) =>
      c.method === 'linearRampToValueAtTime' &&
      c.args[0] === value &&
      c.args[1] === t,
  );
}

describe('Orchestrator — lifecycle', () => {
  it('boots, swaps to sine (no-op), and stops cleanly', async () => {
    const orch = new Orchestrator(DEFAULT_PARAMS);

    orch.start();
    expect(orch.isRunning()).toBe(true);
    expect(orch.getEngineId()).toBe('sine');
    expect(orch.getPartialCount()).toBe(DEFAULT_PARAMS.density);

    // Swapping to the already-active engine is a no-op: still running, same count.
    orch.setEngine('sine');
    expect(orch.isRunning()).toBe(true);
    expect(orch.getPartialCount()).toBe(DEFAULT_PARAMS.density);

    const stopped = orch.stop();
    expect(orch.isRunning()).toBe(false);
    vi.advanceTimersByTime(2200);
    await stopped;
    expect(orch.getPartialCount()).toBe(0);
  });

  it('start() is idempotent while running', () => {
    const orch = new Orchestrator(DEFAULT_PARAMS);
    orch.start();
    // A second start must not throw or rebuild.
    expect(() => orch.start()).not.toThrow();
    expect(orch.isRunning()).toBe(true);
  });
});

describe('Orchestrator — drift fan-out', () => {
  it('pushes per-partial detune to the active engine via setPartialDetune', () => {
    const calls: Array<[number, number]> = [];
    let output: AudioNode | null = null;

    const mockEngine: AnnealEngine = {
      id: 'sine',
      capabilities: { densityLockedWhilePlaying: true, params: [] },
      start(ctx) {
        output = ctx.createGain();
      },
      stop() {
        return Promise.resolve();
      },
      getOutputNode() {
        if (!output) throw new Error('not started');
        return output;
      },
      setSharedParams() {},
      setEngineParams() {},
      setPartialDetune(index, cents) {
        calls.push([index, cents]);
      },
      getPartialCount() {
        return 3;
      },
      getPartialFrequencies() {
        return [];
      },
    };

    const orch = new Orchestrator(
      { ...DEFAULT_PARAMS, drift: 1, coupling: 0 },
      'sine',
      undefined,
      { sine: () => mockEngine },
    );

    orch.start();
    vi.advanceTimersByTime(150); // three 50ms drift ticks

    // 3 ticks × 3 partials = 9 detune pushes, all to valid indices.
    expect(calls.length).toBeGreaterThanOrEqual(9);
    for (const [index, cents] of calls) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(3);
      expect(Number.isFinite(cents)).toBe(true);
    }

    const stopped = orch.stop();
    vi.advanceTimersByTime(2200);
    void stopped;
  });
});

describe('Orchestrator — engine selection while stopped', () => {
  it('remembers the selected engine for the next start', () => {
    const orch = new Orchestrator(DEFAULT_PARAMS);
    orch.setEngine('fm');
    expect(orch.getEngineId()).toBe('fm');
  });
});

describe('Orchestrator — crossfade', () => {
  it('fades the first engine in over the long bloom', () => {
    const orch = new Orchestrator(DEFAULT_PARAMS, 'sine');
    orch.start();
    const ctx = MockAudioContext.instances.at(-1)!;

    // Exactly one bus ramps 0 → 1 over the 3s fade-in.
    const fadeInBuses = ctx
      .nodesOfKind('gain')
      .filter((g) => hasGainRamp(g, 1, 3.0));
    expect(fadeInBuses).toHaveLength(1);

    orch.stop();
    vi.advanceTimersByTime(2200);
  });

  it('equal-gain crossfades between distinct engines (overlap, no gap/clip)', () => {
    const orch = new Orchestrator(DEFAULT_PARAMS, 'sine');
    orch.start();
    const ctx = MockAudioContext.instances.at(-1)!;

    orch.setEngine('fm');
    expect(orch.getEngineId()).toBe('fm');

    const gains = ctx.nodesOfKind('gain');
    const incoming = gains.find((g) => hasGainRamp(g, 1, 0.6));
    const outgoing = gains.find((g) => hasGainRamp(g, 0, 0.6));

    // Both buses ramp over the same [0, 0.6] window → they overlap.
    expect(incoming).toBeDefined();
    expect(outgoing).toBeDefined();
    expect(incoming).not.toBe(outgoing);

    // Incoming rises 0 → 1; outgoing is anchored at its current 1 then → 0.
    // An equal-gain linear pair sums to 1 across the window: no gap, no clip.
    expect(
      incoming!.gain.calls.some(
        (c) =>
          c.method === 'setValueAtTime' && c.args[0] === 0 && c.args[1] === 0,
      ),
    ).toBe(true);
    expect(
      outgoing!.gain.calls.some(
        (c) =>
          c.method === 'setValueAtTime' && c.args[0] === 1 && c.args[1] === 0,
      ),
    ).toBe(true);

    // After the window, the outgoing engine is torn down and fm is active.
    vi.advanceTimersByTime(600);
    expect(orch.getEngineId()).toBe('fm');

    orch.stop();
    vi.advanceTimersByTime(2200);
  });

  it('coalesces rapid switches to the latest requested engine', () => {
    const orch = new Orchestrator(DEFAULT_PARAMS, 'sine');
    orch.start();

    orch.setEngine('fm'); // sine → fm crossfade in flight
    orch.setEngine('sine'); // queued while the first crossfade runs
    expect(orch.getEngineId()).toBe('fm');

    vi.advanceTimersByTime(600); // first crossfade completes → triggers queued
    vi.advanceTimersByTime(600); // queued fm → sine crossfade completes
    expect(orch.getEngineId()).toBe('sine');
    expect(orch.isRunning()).toBe(true);

    orch.stop();
    vi.advanceTimersByTime(2200);
  });

  it('swapping to the in-flight target cancels a queued swap back', () => {
    const orch = new Orchestrator(DEFAULT_PARAMS, 'sine');
    orch.start();

    orch.setEngine('fm'); // sine → fm in flight (active becomes fm)
    orch.setEngine('fm'); // same as active → no-op, clears any queue
    expect(orch.getEngineId()).toBe('fm');

    vi.advanceTimersByTime(600);
    expect(orch.getEngineId()).toBe('fm');

    orch.stop();
    vi.advanceTimersByTime(2200);
  });
});
