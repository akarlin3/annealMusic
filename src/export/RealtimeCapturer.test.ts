/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { startRealtimeCapture } from './RealtimeCapturer';
import { MockAudioContext } from '@/test/audioMock';
import type { Orchestrator } from '@/audio/orchestrator';

describe('RealtimeCapturer', () => {
  beforeAll(() => {
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();

    class FakeAudioWorkletNode {
      port = {
        postMessage: vi.fn(),
        onmessage: null,
      };
      connect(node: any) {
        return node;
      }
      disconnect() {}
    }
    globalThis.AudioWorkletNode = FakeAudioWorkletNode as any;
  });
  it('throws when live audio core is not active', async () => {
    const mockOrchestrator = {
      getRecordingTap: () => null,
    } as unknown as Orchestrator;

    await expect(
      startRealtimeCapture({
        orchestrator: mockOrchestrator,
        includePartials: false,
        maxSeconds: 10,
        sampleRate: 48000,
        bitDepth: 24,
        patchTitle: 'Test',
        patchHash: 'h',
      }),
    ).rejects.toThrow('Live audio core is not active.');
  });

  it('runs parallel real-time capture tap setup successfully', async () => {
    const ctx = new MockAudioContext();
    const mockNode = ctx.createGain();

    const mockOrchestrator = {
      getRecordingTap: () => ({ ctx, node: mockNode }),
      getActiveEngine: () => ({
        getOutputNode: () => mockNode,
        getPartialOutputs: () => [mockNode, mockNode],
      }),
      getEngineId: () => 'sine',
      getPartialCount: () => 2,
      getInputVoice: () => null,
      getLoopSlot: () => null,
    } as unknown as Orchestrator;

    // We can run startRealtimeCapture using the MockAudioContext
    // The test requires ctx.audioWorklet to exist for capture ensuring module
    (ctx as any).audioWorklet = {
      addModule: vi.fn().mockResolvedValue(undefined),
    };

    const captureHandle = await startRealtimeCapture({
      orchestrator: mockOrchestrator,
      includePartials: true,
      maxSeconds: 5,
      sampleRate: 48000,
      bitDepth: 24,
      patchTitle: 'Test Live',
      patchHash: 'hl',
    });

    expect(captureHandle.stop).toBeDefined();
    expect(captureHandle.cancel).toBeDefined();

    // Clean up
    captureHandle.cancel();
  });
});
