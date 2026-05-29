import { describe, expect, it } from 'vitest';
import { PulseEngine } from '@/audio/engines/pulse';
import { DEFAULT_PARAMS } from '@/state/params';
import { MockAudioContext, MockNode } from '@/test/audioMock';
import type { SharedParams } from '@/audio/engines/types';
import type { PhysicalVoiceNode, WorkletNodeFactory } from '@/audio/engines/physical';

function shared(overrides: Partial<SharedParams> = {}): SharedParams {
  return { ...DEFAULT_PARAMS, ...overrides };
}

interface FakeVoice extends PhysicalVoiceNode {
  params: Map<string, number>;
  processor: string;
  messages: unknown[];
  disposed: boolean;
}

function fakeFactory(): { factory: WorkletNodeFactory; voices: FakeVoice[] } {
  const voices: FakeVoice[] = [];
  const factory: WorkletNodeFactory = (_ctx, processor) => {
    const params = new Map<string, number>();
    const voice: FakeVoice = {
      node: new MockNode('gain') as unknown as AudioNode,
      processor,
      params,
      messages: [],
      disposed: false,
      setParam(name, value) {
        params.set(name, value);
      },
      post(message) {
        voice.messages.push(message);
      },
      dispose() {
        voice.disposed = true;
      },
    };
    voices.push(voice);
    return voice;
  };
  return { factory, voices };
}

function makeEngine(overrides?: { supported?: boolean }) {
  const { factory, voices } = fakeFactory();
  const eng = new PulseEngine(
    factory,
    () => Promise.resolve(),
    () => overrides?.supported ?? true,
  );
  return { eng, voices };
}

const ctxOf = () => {
  const ctx = new MockAudioContext();
  return ctx as unknown as AudioContext;
};

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('PulseEngine — lifecycle', () => {
  it('starts, exposes capabilities/partials, and stops', async () => {
    const { eng, voices } = makeEngine();
    eng.start(ctxOf(), shared({ density: 4 }), {});
    await flush();

    expect(eng.getPartialCount()).toBe(4);
    expect(eng.getOutputNode()).toBeDefined();
    expect(voices).toHaveLength(1);
    expect(voices[0]?.processor).toBe('pulse-processor');

    await eng.stop();
    expect(voices[0]?.disposed).toBe(true);
  });

  it('throws if started twice without stopping', () => {
    const { eng } = makeEngine();
    const ctx = ctxOf();
    eng.start(ctx, shared({ density: 2 }), {});
    expect(() => eng.start(ctx, shared({ density: 2 }), {})).toThrow();
  });
});

describe('PulseEngine — parameter mapping', () => {
  it('sets initial parameters correctly on the worklet voice', async () => {
    const { eng, voices } = makeEngine();
    eng.start(ctxOf(), shared({ rootFreq: 150, spread: 1.1, density: 3 }), {
      density: 3, // Eighths
      accent: 0,
      tone: 0.8,
      swing: 0.4,
      humanize: 0.2,
    });
    await flush();

    const voice = voices[0]!;
    expect(voice.params.get('f0')).toBe(150);
    expect(voice.params.get('spread')).toBe(1.1);
    expect(voice.params.get('densityVal')).toBe(3);
    expect(voice.params.get('density')).toBe(3);
    expect(voice.params.get('accent')).toBe(0);
    expect(voice.params.get('tone')).toBe(0.8);
    expect(voice.params.get('swing')).toBe(0.4);
    expect(voice.params.get('humanize')).toBe(0.2);
  });

  it('supports dynamic parameter updates', async () => {
    const { eng, voices } = makeEngine();
    eng.start(ctxOf(), shared({ density: 6 }), {});
    await flush();

    eng.setEngineParams({ density: 4, tone: 0.2, swing: 0.8 });
    const voice = voices[0]!;
    expect(voice.params.get('density')).toBe(4);
    expect(voice.params.get('tone')).toBe(0.2);
    expect(voice.params.get('swing')).toBe(0.8);
  });

  it('calculates harmonic frequencies correctly', async () => {
    const { eng } = makeEngine();
    eng.start(ctxOf(), shared({ rootFreq: 100, spread: 1.0, density: 4 }), {});
    await flush();

    // HARMONICS[0..3] = [1.0, 1.5, 2.0, 2.5]
    expect(eng.getPartialFrequencies()).toEqual([100, 150, 200, 250]);
  });
});

describe('PulseEngine — tempo sync', () => {
  it('transmits tempo set status and BPM when set', async () => {
    const { eng, voices } = makeEngine();
    eng.start(ctxOf(), shared({ density: 4 }), {});
    await flush();

    // Re-verify initial status is default (tempoless)
    const voice = voices[0]!;
    expect(voice.params.get('tempoSet')).toBe(0);
    expect(voice.params.get('tempoBpm')).toBe(60);

    // Apply tempo
    eng.setTempo(120);
    expect(voice.params.get('tempoSet')).toBe(1);
    expect(voice.params.get('tempoBpm')).toBe(120);

    // Clear tempo
    eng.setTempo(null);
    expect(voice.params.get('tempoSet')).toBe(0);
  });
});
