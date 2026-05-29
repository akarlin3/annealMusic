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

  it.each([
    [3, 'membrane-processor', 12],
    [4, 'bowed-processor', undefined],
    [5, 'mallet-processor', 6],
    [6, 'edge-processor', undefined],
    [7, 'bell-processor', 9],
  ])(
    'builds the %i sub-model on its own processor (+ modal throttle msg)',
    async (model, processor, modes) => {
      const { eng, voices } = makeEngine();
      eng.start(ctxOf(), shared({ density: 2 }), { model });
      await flush();
      expect(voices).toHaveLength(2);
      expect(voices.every((v) => v.processor === processor)).toBe(true);
      // Modal sub-models receive a structural mode-count message; the
      // delay/waveguide ones (bowed/edge) receive none.
      if (modes === undefined) {
        expect(voices[0]?.messages).toHaveLength(0);
      } else {
        expect(voices[0]?.messages[0]).toEqual({ modes });
      }
    },
  );

  it('maps shared params onto every new sub-model voice', async () => {
    const { eng, voices } = makeEngine();
    eng.start(ctxOf(), shared({ density: 2, brightness: 0.5 }), {
      model: 3,
      excitationLevel: 0.5,
      damping: 0.4,
    });
    await flush();
    eng.setEngineParams({ damping: 0.9 });
    expect(voices.every((v) => v.params.get('damping') === 0.9)).toBe(true);
    eng.setEngineParams({ reed: 0.8, inharm: 0.2 });
    expect(voices[0]?.params.get('reed')).toBe(0.8);
    expect(voices[0]?.params.get('inharm')).toBe(0.2);
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
