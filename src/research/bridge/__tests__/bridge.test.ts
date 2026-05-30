/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BridgeServer } from '../BridgeServer';
import { useParamStore } from '../../../state/params';
import type { Orchestrator } from '../../../audio/orchestrator';

describe('JSON-RPC Bridge Server', () => {
  let mockOrchestrator: any;
  let mockChannel: any;

  beforeEach(() => {
    vi.useFakeTimers();
    useParamStore.getState().reset();

    // Mock AnalyserNode
    const mockAnalyser = {
      frequencyBinCount: 4,
      getByteFrequencyData: vi.fn((array: Uint8Array) => {
        array[0] = 50;
        array[1] = 100;
        array[2] = 150;
        array[3] = 200;
      }),
    };

    // Mock Orchestrator
    mockOrchestrator = {
      getAnalyser: vi.fn().mockReturnValue(mockAnalyser),
      getPartialFrequencies: vi.fn().mockReturnValue([110, 220, 330]),
      getSessionState: vi.fn().mockReturnValue('playing-patch'),
      getArcProgress: vi.fn().mockReturnValue({ remainingSec: 5 }),
      startSession: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    BridgeServer.registerOrchestrator(
      () => mockOrchestrator as unknown as Orchestrator,
    );

    // Mock BroadcastChannel standard message handler
    mockChannel = {
      postMessage: vi.fn(),
      close: vi.fn(),
    };
    vi.stubGlobal(
      'BroadcastChannel',
      vi.fn().mockImplementation(() => mockChannel),
    );

    BridgeServer.start();
  });

  afterEach(() => {
    vi.useRealTimers();
    BridgeServer.stop();
    vi.unstubAllGlobals();
  });

  const sendRequest = async (req: any): Promise<any> => {
    // Simulate BroadcastChannel event message dispatch
    const onmessage = (globalThis.BroadcastChannel as any).mock.results[0].value
      .onmessage;
    onmessage({ data: req });

    // Wait for promise resolution ticks
    await vi.runAllTimersAsync();

    // Return the response data posted back over the BroadcastChannel
    const lastCall = mockChannel.postMessage.mock.lastCall;
    return lastCall ? lastCall[0] : null;
  };

  it('handles anneal.version method', async () => {
    const res = await sendRequest({
      jsonrpc: '2.0',
      method: 'anneal.version',
      id: 1,
    });

    expect(res).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {
        app: '5.0.0',
        bridge: '1.0',
        schema: 'v20',
      },
    });
  });

  it('handles anneal.health method', async () => {
    const res = await sendRequest({
      jsonrpc: '2.0',
      method: 'anneal.health',
      id: 2,
    });

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe(2);
    expect(res.result.status).toBe('ok');
    expect(res.result.timestamp).toBeDefined();
  });

  it('handles anneal.state.get method', async () => {
    const res = await sendRequest({
      jsonrpc: '2.0',
      method: 'anneal.state.get',
      id: 3,
    });

    expect(res.result.engineId).toBe('sine');
    expect(res.result.tuning.system).toBe('equal');
    expect(res.result.mode).toBe('sketch');
    expect(res.result.params.rootFreq).toBe(110);
  });

  it('handles anneal.state.set method and patches param store', async () => {
    const res = await sendRequest({
      jsonrpc: '2.0',
      method: 'anneal.state.set',
      params: {
        params: {
          rootFreq: 220,
        },
      },
      id: 4,
    });

    expect(res.result).toBe(true);
    expect(useParamStore.getState().params.rootFreq).toBe(220);
  });

  it('handles state modifications with schema validation constraints', async () => {
    const res = await sendRequest({
      jsonrpc: '2.0',
      method: 'anneal.state.set',
      params: {}, // Missing params
      id: 5,
    });

    expect(res.error).toBeDefined();
    expect(res.error.code).toBe(-32602);
  });

  it('handles state subscriptions and pushes updates', async () => {
    const subRes = await sendRequest({
      jsonrpc: '2.0',
      method: 'anneal.state.subscribe',
      params: {
        keys: ['params'],
      },
      id: 6,
    });

    const subId = subRes.result.subscriptionId;
    expect(subId).toBeDefined();

    // Trigger state change
    mockChannel.postMessage.mockClear();
    useParamStore.getState().setParam('rootFreq', 150);

    // Assert that the push notification was sent over BroadcastChannel
    expect(mockChannel.postMessage).toHaveBeenCalled();
    const pushMsg = mockChannel.postMessage.mock.calls[0][0];
    expect(pushMsg.method).toBe('anneal.state.onChange');
    expect(pushMsg.params.subscriptionId).toBe(subId);
    expect(pushMsg.params.key).toBe('params');
    expect(pushMsg.params.value.rootFreq).toBe(150);
  });

  it('handles anneal.state.unsubscribe', async () => {
    const subRes = await sendRequest({
      jsonrpc: '2.0',
      method: 'anneal.state.subscribe',
      params: {
        keys: ['params'],
      },
      id: 7,
    });

    const subId = subRes.result.subscriptionId;

    const unsubRes = await sendRequest({
      jsonrpc: '2.0',
      method: 'anneal.state.unsubscribe',
      params: {
        subscriptionId: subId,
      },
      id: 8,
    });

    expect(unsubRes.result).toBe(true);
  });

  it('handles anneal.engine.getSpectrum and reads FFT frequency array data', async () => {
    const res = await sendRequest({
      jsonrpc: '2.0',
      method: 'anneal.engine.getSpectrum',
      id: 9,
    });

    expect(res.result.spectrum).toEqual([50, 100, 150, 200]);
  });

  it('handles anneal.engine.getPartials and extracts frequency/amplitude states', async () => {
    const res = await sendRequest({
      jsonrpc: '2.0',
      method: 'anneal.engine.getPartials',
      id: 10,
    });

    expect(res.result.partials).toEqual([
      { freq: 110, amp: 0.32 },
      { freq: 220, amp: 0.16 },
      { freq: 330, amp: 0.32 / 3 },
    ]);
  });

  it('handles anneal.session.status method', async () => {
    const res = await sendRequest({
      jsonrpc: '2.0',
      method: 'anneal.session.status',
      id: 11,
    });

    expect(res.result.status).toBe('playing-patch');
    expect(res.result.elapsedMs).toBe(595000); // 600s default total - 5s remaining
    expect(res.result.remainingMs).toBe(5000);
  });

  it('handles engine lifecycle methods start and stop', async () => {
    const startRes = await sendRequest({
      jsonrpc: '2.0',
      method: 'anneal.session.start',
      id: 12,
    });
    expect(startRes.result).toBe(true);
    expect(mockOrchestrator.startSession).toHaveBeenCalled();

    const stopRes = await sendRequest({
      jsonrpc: '2.0',
      method: 'anneal.session.stop',
      id: 13,
    });
    expect(stopRes.result).toBe(true);
    expect(mockOrchestrator.stop).toHaveBeenCalled();
  });
});
