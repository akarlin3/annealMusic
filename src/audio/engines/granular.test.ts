import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GranularEngine } from '@/audio/engines/granular';
import { DEFAULT_PARAMS } from '@/state/params';
import { SOURCES } from '@/audio/sources/registry';
import { MockAudioContext } from '@/test/audioMock';

beforeEach(() => {
  vi.useFakeTimers();
  MockAudioContext.instances.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  MockAudioContext.instances.length = 0;
});

function makeEngine(ctx: MockAudioContext) {
  const buffer = ctx.createBuffer(
    1,
    ctx.sampleRate * 2,
    ctx.sampleRate,
  ) as unknown as AudioBuffer;
  const loadFn = vi.fn(async () => buffer);
  const engine = new GranularEngine(loadFn, () => 0.5);
  return { engine, buffer, loadFn };
}

function shared(overrides: Partial<typeof DEFAULT_PARAMS> = {}) {
  return { ...DEFAULT_PARAMS, ...overrides };
}

/** Flush the async source load so the clouds start. */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

/** Advance the audio clock in 25 ms ticks, firing the look-ahead scheduler. */
function runSeconds(ctx: MockAudioContext, seconds: number): void {
  const ticks = Math.round(seconds / 0.025);
  for (let i = 0; i < ticks; i++) {
    ctx.currentTime += 0.025;
    vi.advanceTimersByTime(25);
  }
}

describe('GranularEngine', () => {
  it('builds one cloud per partial and reports frequencies', () => {
    const ctx = new MockAudioContext();
    const { engine } = makeEngine(ctx);
    engine.start(ctx as unknown as AudioContext, shared({ density: 4 }), {});
    expect(engine.getPartialCount()).toBe(4);
    // rootFreq 110, spread 1, ratios [1, 1.5, 2, 2.5].
    expect(engine.getPartialFrequencies()).toEqual([110, 165, 220, 275]);
    void engine.stop();
  });

  it('maps partial frequency to pitchOffset cents vs. the source fundamental', () => {
    const ctx = new MockAudioContext();
    const { engine } = makeEngine(ctx);
    // Source 0 (glasspad) is tagged fundamental 110 Hz; rootFreq is also 110.
    expect(SOURCES[0]!.fundamentalHz).toBe(110);
    engine.start(ctx as unknown as AudioContext, shared({ density: 4 }), {
      source: 0,
    });
    const offsets = engine.getPitchOffsets();
    expect(offsets[0]).toBeCloseTo(0, 5); // 110 Hz → native rate
    expect(offsets[2]).toBeCloseTo(1200, 3); // 220 Hz → +1 octave
    expect(offsets[1]).toBeCloseTo(1200 * Math.log2(1.5), 3);
    void engine.stop();
  });

  it('starts grain clouds once the source buffer resolves', async () => {
    const ctx = new MockAudioContext();
    const { engine, loadFn } = makeEngine(ctx);
    engine.start(ctx as unknown as AudioContext, shared({ density: 2 }), {});
    expect(loadFn).toHaveBeenCalledTimes(1);
    // Before the async load resolves, no grains have been scheduled.
    expect(ctx.nodesOfKind('buffersource').length).toBe(0);
    await settle();
    runSeconds(ctx, 0.6);
    expect(ctx.nodesOfKind('buffersource').length).toBeGreaterThan(0);
    await engine.stop();
  });

  it('routes drift detune into the cloud (grains carry base + detune)', async () => {
    const ctx = new MockAudioContext();
    const { engine } = makeEngine(ctx);
    // density 1 ⇒ a single partial at the root, source 0 ⇒ base offset 0.
    engine.start(ctx as unknown as AudioContext, shared({ density: 1 }), {
      source: 0,
    });
    await settle();
    runSeconds(ctx, 0.3);
    engine.setPartialDetune(0, 50);
    runSeconds(ctx, 0.4);
    const detuned = ctx
      .nodesOfKind('buffersource')
      .some((s) => s.detune.value === 50);
    expect(detuned).toBe(true);
    await engine.stop();
  });

  it('reloads on source change and tracks the new index', () => {
    const ctx = new MockAudioContext();
    const { engine, loadFn } = makeEngine(ctx);
    engine.start(ctx as unknown as AudioContext, shared({ density: 2 }), {
      source: 0,
    });
    expect(engine.getSourceIndex()).toBe(0);
    engine.setEngineParams({ source: 3 });
    expect(engine.getSourceIndex()).toBe(3);
    expect(loadFn).toHaveBeenCalledTimes(2);
    void engine.stop();
  });

  it('accepts and resolves namespaced user sources', () => {
    const ctx = new MockAudioContext();
    const { engine, loadFn } = makeEngine(ctx);
    engine.start(ctx as unknown as AudioContext, shared({ density: 2 }), {
      source: 'u:a5e4b10b-e419-4f1a-b808-a8d47de24c10',
    });
    expect(engine.getSourceIndex()).toBe(-1); // user source index is -1
    expect(loadFn).toHaveBeenLastCalledWith(
      expect.anything(),
      'u:a5e4b10b-e419-4f1a-b808-a8d47de24c10',
    );

    // Switch to namespaced bundled source
    engine.setEngineParams({ source: 'b:tapeorgan' });
    expect(engine.getSourceIndex()).toBe(2); // tapeorgan is index 2
    expect(loadFn).toHaveBeenLastCalledWith(expect.anything(), 'b:tapeorgan');
    void engine.stop();
  });

  it('advertises a longer crossfade window', () => {
    const ctx = new MockAudioContext();
    const { engine } = makeEngine(ctx);
    expect(engine.capabilities.crossfadeMs).toBe(800);
    expect(engine.capabilities.densityLockedWhilePlaying).toBe(true);
    void engine.stop();
  });

  it('survives a source load failure without throwing', async () => {
    const ctx = new MockAudioContext();
    const engine = new GranularEngine(
      async () => {
        throw new Error('network down');
      },
      () => 0.5,
    );
    engine.start(ctx as unknown as AudioContext, shared({ density: 2 }), {});
    await settle();
    runSeconds(ctx, 0.3);
    // No grains (load failed) but the engine is intact and stops cleanly.
    expect(ctx.nodesOfKind('buffersource').length).toBe(0);
    await engine.stop();
  });
});
