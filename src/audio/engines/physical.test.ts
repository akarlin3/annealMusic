import { describe, expect, it, vi } from 'vitest';
import {
  PhysicalEngine,
  PhysicalUnsupportedError,
  type PhysicalParam,
  type PhysicalVoiceNode,
  type WorkletNodeFactory,
} from '@/audio/engines/physical';
import { DEFAULT_PARAMS } from '@/state/params';
import { MockAudioContext, MockNode } from '@/test/audioMock';
import type { SharedParams } from '@/audio/engines/types';

function shared(overrides: Partial<SharedParams> = {}): SharedParams {
  return { ...DEFAULT_PARAMS, ...overrides };
}

interface FakeVoice extends PhysicalVoiceNode {
  params: Map<PhysicalParam, number>;
  processor: string;
  messages: unknown[];
  disposed: boolean;
}

/** A factory that records every voice it builds, for assertions. */
function fakeFactory(): { factory: WorkletNodeFactory; voices: FakeVoice[] } {
  const voices: FakeVoice[] = [];
  const factory: WorkletNodeFactory = (_ctx, processor) => {
    const params = new Map<PhysicalParam, number>();
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
  const eng = new PhysicalEngine(
    factory,
    () => Promise.resolve(),
    () => overrides?.supported ?? true,
  );
  return { eng, voices };
}

const ctxOf = () => new MockAudioContext() as unknown as AudioContext;

/** Let the async (register → build) microtasks settle. */
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('PhysicalEngine — lifecycle', () => {
  it('starts, exposes partial count + output, and stops', async () => {
    const { eng } = makeEngine();
    eng.start(ctxOf(), shared({ density: 4 }), {});
    expect(eng.getPartialCount()).toBe(4);
    expect(eng.getOutputNode()).toBeDefined();
    await eng.stop();
    expect(eng.getPartialCount()).toBe(0);
  });

  it('throws if started twice', () => {
    const { eng } = makeEngine();
    eng.start(ctxOf(), shared({ density: 2 }), {});
    expect(() => eng.start(ctxOf(), shared({ density: 2 }), {})).toThrow();
  });

  it('refuses to start when AudioWorklet is unsupported', () => {
    const { eng } = makeEngine({ supported: false });
    expect(() => eng.start(ctxOf(), shared(), {})).toThrow(
      PhysicalUnsupportedError,
    );
  });

  it('builds one worklet voice per partial after registration resolves', async () => {
    const { eng, voices } = makeEngine();
    eng.start(ctxOf(), shared({ density: 3 }), {});
    await flush();
    expect(voices).toHaveLength(3);
    expect(voices.every((v) => v.processor === 'string-processor')).toBe(true);
  });
});

describe('PhysicalEngine — params', () => {
  it('places each voice f0 on the harmonic lattice', async () => {
    const { eng, voices } = makeEngine();
    // HARMONICS[0..2] = [1, 1.5, 2]; root 110, spread 1.
    eng.start(ctxOf(), shared({ rootFreq: 110, spread: 1, density: 3 }), {});
    await flush();
    expect(voices.map((v) => v.params.get('f0'))).toEqual([110, 165, 220]);
    expect(eng.getPartialFrequencies()).toEqual([110, 165, 220]);
  });

  it('tracks root changes onto each voice f0', async () => {
    const { eng, voices } = makeEngine();
    eng.start(ctxOf(), shared({ rootFreq: 110, spread: 1, density: 2 }), {});
    await flush();
    eng.setSharedParams({ rootFreq: 220 });
    expect(voices.map((v) => v.params.get('f0'))).toEqual([220, 330]);
  });

  it('pushes drift detune to the matching voice', async () => {
    const { eng, voices } = makeEngine();
    eng.start(ctxOf(), shared({ density: 2 }), {});
    await flush();
    eng.setPartialDetune(1, 37);
    expect(voices[1]?.params.get('detune')).toBe(37);
  });

  it('rebuilds all voices on the new processor when the model changes', async () => {
    const { eng, voices } = makeEngine();
    eng.start(ctxOf(), shared({ density: 2 }), { model: 0 });
    await flush();
    expect(eng.getModel()).toBe('string');
    const firstGen = voices.slice();

    eng.setEngineParams({ model: 2 }); // plate
    await flush();
    expect(eng.getModel()).toBe('plate');
    expect(firstGen.every((v) => v.disposed)).toBe(true);
    const plateVoices = voices.filter((v) => v.processor === 'plate-processor');
    expect(plateVoices).toHaveLength(2);
    // Plate voices receive a structural mode-count message.
    expect(plateVoices[0]?.messages[0]).toEqual({ modes: 20 });
  });

  it('surfaces async load failures through the error handler', async () => {
    const { factory } = fakeFactory();
    const onError = vi.fn();
    const eng = new PhysicalEngine(
      factory,
      () => Promise.reject(new Error('module load failed')),
      () => true,
    );
    eng.setErrorHandler(onError);
    eng.start(ctxOf(), shared({ density: 1 }), {});
    await flush();
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]?.[0]?.message).toContain('module load failed');
  });
});
