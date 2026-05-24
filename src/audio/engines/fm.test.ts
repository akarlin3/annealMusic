import { describe, expect, it } from 'vitest';
import { FmEngine } from '@/audio/engines/fm';
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

describe('FmEngine — lifecycle', () => {
  it('starts, exposes an output node and partial count, and stops', async () => {
    const { as } = ctxOf();
    const eng = new FmEngine();

    eng.start(as, shared({ density: 4 }), {});
    expect(eng.getPartialCount()).toBe(4);
    expect(eng.getOutputNode()).toBeDefined();

    await eng.stop();
    expect(eng.getPartialCount()).toBe(0);
  });

  it('throws if started twice without stopping', () => {
    const { as } = ctxOf();
    const eng = new FmEngine();
    eng.start(as, shared({ density: 2 }), {});
    expect(() => eng.start(as, shared({ density: 2 }), {})).toThrow();
  });
});

describe('FmEngine — frequency tracking', () => {
  it('places carrier at the partial freq and modulator at carrier × ratio', () => {
    const { as } = ctxOf();
    const eng = new FmEngine();
    // HARMONICS[0..2] = [1, 1.5, 2]; spread 1 → carrier = root × ratio.
    eng.start(as, shared({ rootFreq: 110, spread: 1, density: 3 }), {
      modRatio: 2,
      modIndex: 2,
      feedback: 0,
    });

    expect(eng.getPartialFrequencies()).toEqual([110, 165, 220]);
    expect(eng.getModulatorFrequencies()).toEqual([220, 330, 440]);
  });

  it('tracks root changes on both carrier and modulator', () => {
    const { as } = ctxOf();
    const eng = new FmEngine();
    eng.start(as, shared({ rootFreq: 110, spread: 1, density: 3 }), {
      modRatio: 2,
    });

    eng.setSharedParams({ rootFreq: 220 });
    expect(eng.getPartialFrequencies()).toEqual([220, 330, 440]);
    expect(eng.getModulatorFrequencies()).toEqual([440, 660, 880]);
  });

  it('updates the modulator when modRatio changes (carrier unaffected)', () => {
    const { as } = ctxOf();
    const eng = new FmEngine();
    eng.start(as, shared({ rootFreq: 110, spread: 1, density: 3 }), {
      modRatio: 2,
    });

    eng.setEngineParams({ modRatio: 3 });
    expect(eng.getPartialFrequencies()).toEqual([110, 165, 220]);
    expect(eng.getModulatorFrequencies()).toEqual([330, 495, 660]);
  });
});

describe('FmEngine — detune', () => {
  it('shifts the carrier (and modulator, to preserve the ratio)', () => {
    const { ctx, as } = ctxOf();
    const eng = new FmEngine();
    // density 1 → oscillators created per partial: [carrier, lfo, modulator].
    eng.start(as, shared({ density: 1 }), {});

    const oscs = ctx.nodesOfKind('oscillator');
    const carrier = oscs[0];
    const modulator = oscs[2];

    eng.setPartialDetune(0, 42);
    expect(carrier?.detune.value).toBe(42);
    expect(modulator?.detune.value).toBe(42);
  });
});
