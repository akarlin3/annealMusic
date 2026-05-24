import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Orchestrator } from '@/audio/orchestrator';
import { DEFAULT_PARAMS } from '@/state/params';
import { MockAudioContext } from '@/test/audioMock';
import type { AnnealEngine } from '@/audio/engines/types';

beforeEach(() => {
  vi.stubGlobal('AudioContext', MockAudioContext);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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
    orch.setEngine('sine');
    expect(orch.getEngineId()).toBe('sine');
  });
});
