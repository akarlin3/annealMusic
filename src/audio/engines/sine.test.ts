import { describe, expect, it } from 'vitest';
import { SineEngine } from '@/audio/engines/sine';
import { DEFAULT_PARAMS } from '@/state/params';
import { MockAudioContext } from '@/test/audioMock';
import type { SharedParams } from '@/audio/engines/types';

function ctxOf(): { ctx: MockAudioContext; as: AudioContext } {
  const ctx = new MockAudioContext();
  return { ctx, as: ctx as unknown as AudioContext };
}

function shared(overrides: Partial<SharedParams> = {}): SharedParams {
  return { ...DEFAULT_PARAMS, ...overrides };
}

describe('SineEngine — lifecycle', () => {
  it('starts, exposes an output node, and stops cleanly', async () => {
    const { as } = ctxOf();
    const eng = new SineEngine();

    eng.start(as, shared({ density: 4 }));
    expect(eng.getPartialCount()).toBe(4);
    expect(eng.getOutputNode()).toBeDefined();

    // Verify outputs and frequencies getters
    expect(eng.getPartialOutputs()).toHaveLength(4);
    expect(eng.getPartialFrequencies()).toHaveLength(4);

    await eng.stop();
    expect(eng.getPartialCount()).toBe(0);
  });

  it('handles stops with active fade durations', async () => {
    const { as } = ctxOf();
    const eng = new SineEngine();

    eng.start(as, shared({ density: 2 }));
    await eng.stop(1.5);
    expect(eng.getPartialCount()).toBe(0);
  });

  it('throws when start is called repeatedly without intermediate stops', () => {
    const { as } = ctxOf();
    const eng = new SineEngine();
    eng.start(as, shared({ density: 2 }));
    expect(() => eng.start(as, shared({ density: 2 }))).toThrow();
  });

  it('gracefully ignores actions on unstarted engine', () => {
    const eng = new SineEngine();
    expect(() => eng.getOutputNode()).toThrow();
    expect(eng.getPartialCount()).toBe(0);
    expect(eng.getPartialFrequencies()).toEqual([]);
    expect(eng.getPartialOutputs()).toEqual([]);
  });
});

describe('SineEngine — frequency & tuning tracking', () => {
  it('correctly tracks root changes and applies them via setSharedParams', () => {
    const { as } = ctxOf();
    const eng = new SineEngine();

    eng.start(as, shared({ rootFreq: 110, spread: 1, density: 3 }));
    expect(eng.getPartialFrequencies()[0]).toBeCloseTo(110);

    eng.setSharedParams({ rootFreq: 220 });
    expect(eng.getPartialFrequencies()[0]).toBeCloseTo(220);
  });

  it('respects instant and scheduled target times in parameter changes', () => {
    const { as } = ctxOf();
    const eng = new SineEngine();

    eng.start(as, shared({ rootFreq: 110, spread: 1, density: 3 }));

    // Instant update
    eng.setSharedParams({ rootFreq: 150 }, undefined, true);
    expect(eng.getPartialFrequencies()[0]).toBeCloseTo(150);

    // Scheduled update
    eng.setSharedParams({ rootFreq: 200 }, 5, false);
    expect(eng.getPartialFrequencies()[0]).toBeCloseTo(200);
  });

  it('sets engine specific params without throwing (no-op)', () => {
    const eng = new SineEngine();
    expect(() => eng.setEngineParams()).not.toThrow();
  });

  it('correctly tracks spread and tuning changes', () => {
    const { as } = ctxOf();
    const eng = new SineEngine();

    eng.start(
      as,
      shared({
        rootFreq: 110,
        spread: 1,
        density: 3,
        tuning: { system: 'equal' },
      }),
    );
    expect(eng.getPartialFrequencies()[0]).toBeCloseTo(110);

    eng.setSharedParams({ spread: 1.5 });
    eng.setSharedParams({ tuning: { system: 'just-5' } });
    expect(eng.getPartialFrequencies()[0]).toBeCloseTo(110); // resolveLatticeRatio is 1 for partial 0
  });
});

describe('SineEngine — detuning', () => {
  it('correctly applies custom cent offsets to individual partials', () => {
    const { ctx, as } = ctxOf();
    const eng = new SineEngine();

    eng.start(as, shared({ density: 2 }));

    const oscs = ctx.nodesOfKind('oscillator');
    expect(oscs).toBeDefined();

    eng.setPartialDetune(0, 30);
    // SineEngine detunes its primary partial oscillator
    const partialOsc = oscs[0];
    expect(partialOsc?.detune.value).toBe(30);

    // Check bounds out-of-range does not crash
    expect(() => eng.setPartialDetune(999, 100)).not.toThrow();
  });
});
