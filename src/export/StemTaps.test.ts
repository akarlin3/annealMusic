import { describe, expect, it, vi } from 'vitest';
import { getActiveStems } from './StemTaps';
import type { Orchestrator } from '@/audio/orchestrator';
import type { InputVoice } from '@/input/InputVoice';
import type { LoopSlot } from '@/loop/LoopSlot';
import { SineEngine } from '@/audio/engines/sine';
import { FmEngine } from '@/audio/engines/fm';
import { GranularEngine } from '@/audio/engines/granular';
import { PhysicalEngine } from '@/audio/engines/physical';
import { MockAudioContext } from '@/test/audioMock';
import { DEFAULT_PARAMS } from '@/state/params';

// Helper to construct a Mock AudioContext and engines
function ctxOf() {
  const ctx = new MockAudioContext();
  return { ctx, as: ctx as unknown as AudioContext };
}

describe('Engine getPartialOutputs', () => {
  it('SineEngine exposes correct active partial gain nodes', () => {
    const { as } = ctxOf();
    const engine = new SineEngine();
    engine.start(as, { ...DEFAULT_PARAMS, density: 4 });

    const partials = engine.getPartialOutputs();
    expect(partials.length).toBe(4);
    partials.forEach((node) => {
      expect(node).toBeDefined();
    });
  });

  it('FmEngine exposes correct active carrier gain nodes', () => {
    const { as } = ctxOf();
    const engine = new FmEngine();
    engine.start(as, { ...DEFAULT_PARAMS, density: 3 }, {});

    const partials = engine.getPartialOutputs();
    expect(partials.length).toBe(3);
    partials.forEach((node) => {
      expect(node).toBeDefined();
    });
  });

  it('GranularEngine exposes correct active cloud output nodes', () => {
    const { ctx, as } = ctxOf();
    const mockBuffer = ctx.createBuffer(
      1,
      100,
      48000,
    ) as unknown as AudioBuffer;
    const mockLoader = vi.fn().mockResolvedValue(mockBuffer);
    const engine = new GranularEngine(mockLoader);
    engine.start(as, { ...DEFAULT_PARAMS, density: 5 }, {});

    const partials = engine.getPartialOutputs();
    expect(partials.length).toBe(5);
    partials.forEach((node) => {
      expect(node).toBeDefined();
    });
  });

  it('PhysicalEngine exposes correct active physical voices', () => {
    const { as } = ctxOf();
    const mockFactory = vi.fn().mockImplementation((ctx) => ({
      node: ctx.createGain(),
      setParam: vi.fn(),
      post: vi.fn(),
      dispose: vi.fn(),
    }));
    const mockRegister = vi.fn().mockResolvedValue(undefined);
    const mockSupported = vi.fn().mockReturnValue(true);

    const engine = new PhysicalEngine(mockFactory, mockRegister, mockSupported);
    engine.start(as, { ...DEFAULT_PARAMS, density: 2 }, {});

    const partials = engine.getPartialOutputs();
    expect(partials.length).toBe(0); // Before async worklet load resolves
  });
});

describe('getActiveStems', () => {
  it('returns engine and master when nothing else is active', () => {
    const mockOrchestrator = {
      getPartialCount: () => 4,
      getInputVoice: () => null,
      getLoopSlot: () => null,
    } as unknown as Orchestrator;

    const stems = getActiveStems(mockOrchestrator, {
      includeFx: true,
      includePartials: false,
    });
    expect(stems.map((s) => s.id)).toEqual(['engine', 'engine-fx', 'master']);
  });

  it('excludes fx stems when includeFx is false', () => {
    const mockOrchestrator = {
      getPartialCount: () => 4,
      getInputVoice: () => null,
      getLoopSlot: () => null,
    } as unknown as Orchestrator;

    const stems = getActiveStems(mockOrchestrator, {
      includeFx: false,
      includePartials: false,
    });
    expect(stems.map((s) => s.id)).toEqual(['engine', 'master']);
  });

  it('includes partials when includePartials is true', () => {
    const mockOrchestrator = {
      getPartialCount: () => 3,
      getInputVoice: () => null,
      getLoopSlot: () => null,
    } as unknown as Orchestrator;

    const stems = getActiveStems(mockOrchestrator, {
      includeFx: false,
      includePartials: true,
    });
    expect(stems.map((s) => s.id)).toEqual([
      'engine',
      'partial-0',
      'partial-1',
      'partial-2',
      'master',
    ]);
  });

  it('includes input and active loop slots', () => {
    const mockInputVoice = {
      isConnected: () => true,
    } as unknown as InputVoice;

    const mockLoopSlotA = {
      hasBuffer: () => true,
    } as unknown as LoopSlot;

    const mockLoopSlotB = {
      hasBuffer: () => false,
    } as unknown as LoopSlot;

    const mockOrchestrator = {
      getPartialCount: () => 4,
      getInputVoice: () => mockInputVoice,
      getLoopSlot: (id: string) => {
        if (id === 'A') return mockLoopSlotA;
        if (id === 'B') return mockLoopSlotB;
        return null;
      },
    } as unknown as Orchestrator;

    const stems = getActiveStems(mockOrchestrator, {
      includeFx: true,
      includePartials: false,
    });
    expect(stems.map((s) => s.id)).toEqual([
      'engine',
      'engine-fx',
      'input',
      'input-fx',
      'loop-A',
      'loop-A-fx',
      'master',
    ]);
  });
});
