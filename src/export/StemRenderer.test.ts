/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, expect, it, vi } from 'vitest';
import { renderStemsOffline, isOfflineRenderSupported } from './StemRenderer';
import { MockAudioContext } from '@/test/audioMock';
import { DEFAULT_PARAMS } from '@/state/params';
import { makeDefaultLoopConfig } from '@/loop/types';

// Helper to build a mock OfflineAudioContext
function mockOfflineContext(
  channels: number,
  frames: number,
  sampleRate: number,
): any {
  const ctx = new MockAudioContext();
  // Standard OAC has startRendering returning a promise of AudioBuffer
  (ctx as any).startRendering = async () => {
    // Fill mock buffers with deterministic seeded values based on PRNG
    const buffer = ctx.createBuffer(channels, frames, sampleRate);
    for (let c = 0; c < channels; c++) {
      const data = buffer.getChannelData(c);
      // Simulate deterministic samples
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.sin(i * 0.1);
      }
    }
    return buffer as unknown as AudioBuffer;
  };
  // Mock suspend/resume
  (ctx as any).suspend = async (_t: number) => {
    return {
      then: (cb: () => void) => {
        // Execute suspend callback immediately for synchronous testing
        cb();
      },
    };
  };
  (ctx as any).resume = async () => {};
  return ctx;
}

describe('StemRenderer', () => {
  it('isOfflineRenderSupported returns correct value', () => {
    expect(isOfflineRenderSupported()).toBe(
      typeof OfflineAudioContext !== 'undefined',
    );
  });

  it('runs sequential render pipeline deterministically', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 29, 2, 0, 0));
    const config = {
      params: { ...DEFAULT_PARAMS, density: 4 },
      engineId: 'sine' as const,
      engineParams: {},
      loopConfig: {
        A: {
          muted: false,
          frozen: false,
          driftCoupled: false,
          grain: { sizeMs: 100, density: 10, posJitter: 0.1, pitchJitter: 0 },
        },
        B: {
          muted: false,
          frozen: false,
          driftCoupled: false,
          grain: { sizeMs: 100, density: 10, posJitter: 0.1, pitchJitter: 0 },
        },
        C: {
          muted: false,
          frozen: false,
          driftCoupled: false,
          grain: { sizeMs: 100, density: 10, posJitter: 0.1, pitchJitter: 0 },
        },
      },
      loopBuffers: {
        A: null,
        B: null,
        C: null,
      },
      loopStates: {
        A: 'empty' as const,
        B: 'empty' as const,
        C: 'empty' as const,
      },
      mode: 'open' as const,
      durationSec: 1, // short duration
      sampleRate: 48000,
      bitDepth: 24 as const,
      includeFx: true,
      includePartials: false,
      seed: 42,
      patchTitle: 'Test Patch',
      patchHash: 'h42',
    };

    const progressEvents: any[] = [];
    const onProgress = (ev: any) => {
      progressEvents.push(ev);
    };

    const cancelSignal = { aborted: false };

    // Run first render
    const results1 = await renderStemsOffline(
      config,
      onProgress,
      cancelSignal,
      mockOfflineContext,
    );

    expect(results1).toBeDefined();
    expect(results1['engine']).toBeDefined();
    expect(results1['engine-fx']).toBeDefined();
    expect(results1['master']).toBeDefined();

    // Verify progress events were fired correctly
    expect(progressEvents.length).toBeGreaterThan(0);
    expect(progressEvents[0].completedStems).toBe(0);
    expect(progressEvents[progressEvents.length - 1].completedStems).toBe(3);

    // Run second render with identical parameters and seed
    const results2 = await renderStemsOffline(
      config,
      () => {},
      cancelSignal,
      mockOfflineContext,
    );

    // Assert absolute byte-level determinism!
    expect(results1['engine']!.byteLength).toBe(results2['engine']!.byteLength);
    const view1 = new Uint8Array(results1['engine']!);
    const view2 = new Uint8Array(results2['engine']!);
    for (let i = 0; i < view1.length; i++) {
      expect(view1[i]).toBe(view2[i]);
    }
    vi.useRealTimers();
  });

  it('supports cancellation cleanly', async () => {
    const config = {
      params: { ...DEFAULT_PARAMS, density: 2 },
      engineId: 'sine' as const,
      engineParams: {},
      loopConfig: {},
      loopBuffers: { A: null, B: null, C: null },
      loopStates: {
        A: 'empty' as const,
        B: 'empty' as const,
        C: 'empty' as const,
      },
      mode: 'open' as const,
      durationSec: 1,
      sampleRate: 48000,
      bitDepth: 24 as const,
      includeFx: true,
      includePartials: false,
      seed: 123,
      patchTitle: 'Test Cancel',
      patchHash: 'hc',
    } as any;

    const cancelSignal = { aborted: true }; // Pre-cancelled

    await expect(
      renderStemsOffline(config, () => {}, cancelSignal, mockOfflineContext),
    ).rejects.toThrow('Render cancelled by user');
  });

  it('renders a Piece cleanly (mixdown only)', async () => {
    const piece = {
      schemaVer: 8,
      title: 'Vibrations',
      description: null,
      visibility: 'unlisted' as const,
      totalDurationMs: 4000,
      hasOpenSegment: false,
      defaultsState: {
        params: DEFAULT_PARAMS,
        engineId: 'sine' as const,
        engineParams: {},
      },
      segments: [
        {
          position: 0,
          type: 'fixed' as const,
          durationMs: 2000,
          config: { params: { rootFreq: 150 } },
        },
        {
          position: 1,
          type: 'fixed' as const,
          durationMs: 2000,
          config: { params: { rootFreq: 200 } },
        },
      ],
    };

    const config = {
      params: DEFAULT_PARAMS,
      engineId: 'sine' as const,
      engineParams: {},
      loopConfig: makeDefaultLoopConfig(),
      loopBuffers: { A: null, B: null, C: null },
      loopStates: { A: 'empty', B: 'empty', C: 'empty' },
      mode: 'piece' as const,
      piece,
      durationSec: 4,
      sampleRate: 48000,
      bitDepth: 24 as const,
      includeFx: true,
      includePartials: false,
      seed: 123,
      patchTitle: 'Test Piece',
      patchHash: 'hpiece',
    } as any;

    const cancelSignal = { aborted: false };
    const results = await renderStemsOffline(
      config,
      () => {},
      cancelSignal,
      mockOfflineContext,
    );

    expect(Object.keys(results)).toEqual(['master']);
    expect(results.master).toBeInstanceOf(ArrayBuffer);
  });

  it('renders a Piece with meta-arc segments cleanly', async () => {
    const piece = {
      schemaVer: 11,
      title: 'Meta-Arc Render',
      description: null,
      visibility: 'unlisted' as const,
      totalDurationMs: 4000,
      hasOpenSegment: false,
      defaultsState: {
        params: DEFAULT_PARAMS,
        engineId: 'sine' as const,
        engineParams: {},
      },
      segments: [
        {
          position: 0,
          type: 'meta-arc' as const,
          durationMs: 4000,
          config: {
            kind: 'random-walk',
            seed: 42,
            randomWalk: {
              params: ['rootFreq', 'brightness'],
              driftStrength: 0.15,
              meanReversion: 0.1,
              steps: 10,
              bounds: {
                rootFreq: { min: 0.5, max: 1.5 },
              },
            },
          },
        },
      ],
    };

    const config = {
      params: DEFAULT_PARAMS,
      engineId: 'sine' as const,
      engineParams: {},
      loopConfig: makeDefaultLoopConfig(),
      loopBuffers: { A: null, B: null, C: null },
      loopStates: { A: 'empty', B: 'empty', C: 'empty' },
      mode: 'piece' as const,
      piece,
      durationSec: 4,
      sampleRate: 48000,
      bitDepth: 24 as const,
      includeFx: true,
      includePartials: false,
      seed: 123,
      patchTitle: 'Test Meta-Arc Piece',
      patchHash: 'hpiece-meta',
    } as any;

    const cancelSignal = { aborted: false };
    const results = await renderStemsOffline(
      config,
      () => {},
      cancelSignal,
      mockOfflineContext,
    );

    expect(Object.keys(results)).toEqual(['master']);
    expect(results.master).toBeInstanceOf(ArrayBuffer);
  });

  it('renders a Piece with variation rules deterministically', async () => {
    const piece = {
      schemaVer: 12,
      title: 'Variations Render Spec',
      description: null,
      visibility: 'unlisted' as const,
      totalDurationMs: 4000,
      hasOpenSegment: false,
      defaultsState: {
        params: DEFAULT_PARAMS,
        engineId: 'sine' as const,
        engineParams: {},
      },
      variations: [
        {
          id: 'vp-brightness',
          paramKey: 'brightness',
          constraint: { type: 'range', min: 0.2, max: 0.8 },
          rule: 'per-play',
        },
      ],
      segments: [
        {
          position: 0,
          type: 'fixed' as const,
          durationMs: 4000,
          config: { params: {} },
        },
      ],
    };

    const config = {
      params: DEFAULT_PARAMS,
      engineId: 'sine' as const,
      engineParams: {},
      loopConfig: makeDefaultLoopConfig(),
      loopBuffers: { A: null, B: null, C: null },
      loopStates: { A: 'empty', B: 'empty', C: 'empty' },
      mode: 'piece' as const,
      piece,
      durationSec: 4,
      sampleRate: 48000,
      bitDepth: 24 as const,
      includeFx: true,
      includePartials: false,
      seed: 4567,
      patchTitle: 'Test Variations Piece',
      patchHash: 'hpiece-var',
    } as any;

    const cancelSignal = { aborted: false };
    const results = await renderStemsOffline(
      config,
      () => {},
      cancelSignal,
      mockOfflineContext,
    );

    expect(Object.keys(results)).toEqual(['master']);
    expect(results.master).toBeInstanceOf(ArrayBuffer);
  });

  it('renders a Sonification cleanly', async () => {
    const sonificationSpec = {
      sources: [
        {
          id: 'src1',
          type: 'file' as const,
          columns: ['timestamp', 'val1'],
          data: [
            { timestamp: 0, val1: 10 },
            { timestamp: 4, val1: 20 },
          ],
        },
      ],
      rules: [
        {
          sourceId: 'src1',
          column: 'val1',
          targetType: 'param' as const,
          targetKey: 'brightness',
          transform: {
            type: 'linear' as const,
            rawMin: 10,
            rawMax: 20,
            outMin: 0.1,
            outMax: 0.9,
          },
        },
      ],
    };

    const config = {
      params: DEFAULT_PARAMS,
      engineId: 'sine' as const,
      engineParams: {},
      loopConfig: makeDefaultLoopConfig(),
      loopBuffers: { A: null, B: null, C: null },
      loopStates: { A: 'empty', B: 'empty', C: 'empty' },
      mode: 'sonification' as const,
      sonificationSpec,
      durationSec: 4,
      sampleRate: 48000,
      bitDepth: 24 as const,
      includeFx: true,
      includePartials: false,
      seed: 123,
      patchTitle: 'Test Sonification Render',
      patchHash: 'hsonification',
    } as any;

    const cancelSignal = { aborted: false };
    const results = await renderStemsOffline(
      config,
      () => {},
      cancelSignal,
      mockOfflineContext,
    );

    expect(results.master).toBeInstanceOf(ArrayBuffer);
  });
});
