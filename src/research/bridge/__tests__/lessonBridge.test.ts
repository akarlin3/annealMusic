/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BridgeServer } from '../BridgeServer';
import { BridgeClient } from '../BridgeClient';
import { PostMessageTransport } from '../transport/postmessage';
import { useParamStore } from '../../../state/params';

describe('Bridge Lesson Extension & postMessage Transport', () => {
  let mockWindowParent: any;
  let messageListeners: any[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    useParamStore.getState().reset();
    messageListeners = [];

    // Mock parent and top windows to simulate being inside an iframe
    mockWindowParent = {
      postMessage: vi.fn((data) => {
        // Forward back to window message listeners
        for (const cb of messageListeners) {
          cb({ origin: 'http://localhost:3000', data });
        }
      }),
    };

    vi.stubGlobal('window', {
      self: {},
      top: {},
      parent: mockWindowParent,
      location: { origin: 'http://localhost:3000' },
      addEventListener: vi.fn((type, cb) => {
        if (type === 'message') {
          messageListeners.push(cb);
        }
      }),
      removeEventListener: vi.fn((type, cb) => {
        if (type === 'message') {
          const idx = messageListeners.indexOf(cb);
          if (idx !== -1) messageListeners.splice(idx, 1);
        }
      }),
      dispatchEvent: vi.fn(),
      postMessage: vi.fn((data) => {
        for (const cb of messageListeners) {
          cb({ origin: 'http://localhost:3000', data });
        }
      }),
    });

    // Start server inside the mocked iframe environment
    BridgeServer.start();
  });

  afterEach(() => {
    vi.useRealTimers();
    BridgeServer.stop();
    vi.unstubAllGlobals();
  });

  it('verifies constraint system locks parameters', () => {
    const s = useParamStore.getState();

    // Default params
    expect(s.params.brightness).toBe(0.5);
    expect(s.params.drift).toBe(0.5);

    // Apply lesson constraint: only brightness allowed
    s.setConstraints(['brightness']);
    expect(useParamStore.getState().constraints).toEqual(['brightness']);

    // Attempt to set brightness -> should succeed
    s.setParam('brightness', 0.8);
    expect(useParamStore.getState().params.brightness).toBe(0.8);

    // Attempt to set drift -> should be rejected/ignored
    s.setParam('drift', 0.9);
    expect(useParamStore.getState().params.drift).toBe(0.5);

    // Release constraints
    s.setConstraints(null);
    expect(useParamStore.getState().constraints).toBeNull();

    // Attempt to set drift -> should now succeed
    s.setParam('drift', 0.9);
    expect(useParamStore.getState().params.drift).toBe(0.9);
  });

  it('handles highlight command and dispatches window custom event', async () => {
    // Create client using PostMessageTransport
    const clientTransport = new PostMessageTransport(window as any);
    clientTransport.setTargetWindow(window as any);

    const client = new BridgeClient(clientTransport);

    // Call highlight
    const resPromise = client.highlight('brightness');
    await vi.runAllTimersAsync();

    const res = await resPromise;
    expect(res).toBe(true);

    // Expect window to receive custom dispatch event
    expect(window.dispatchEvent).toHaveBeenCalled();
    const eventArg = (window.dispatchEvent as any).mock.calls[0][0];
    expect(eventArg.type).toBe('anneal-highlight');
    expect(eventArg.detail.controlKey).toBe('brightness');
  });

  it('handles constrain and releaseConstraints via RPC client', async () => {
    const clientTransport = new PostMessageTransport(window as any);
    clientTransport.setTargetWindow(window as any);

    const client = new BridgeClient(clientTransport);

    // 1. Constrain
    const constPromise = client.constrain(['space']);
    await vi.runAllTimersAsync();
    await constPromise;

    expect(useParamStore.getState().constraints).toEqual(['space']);

    // 2. Release
    const releasePromise = client.releaseConstraints();
    await vi.runAllTimersAsync();
    await releasePromise;

    expect(useParamStore.getState().constraints).toBeNull();
  });

  it('suspendEngine/resumeEngine are no-ops without a running engine', async () => {
    const clientTransport = new PostMessageTransport(window as any);
    clientTransport.setTargetWindow(window as any);
    const client = new BridgeClient(clientTransport);

    const p = client.suspendEngine();
    await vi.runAllTimersAsync();
    // No orchestrator registered in this test env → false (nothing suspended).
    expect(await p).toBe(false);

    const r = client.resumeEngine();
    await vi.runAllTimersAsync();
    expect(await r).toBe(false);
  });

  it('suspendEngine delegates to the orchestrator when one is registered', async () => {
    const suspendAudio = vi.fn().mockResolvedValue(true);
    const resumeAudio = vi.fn().mockResolvedValue(true);
    BridgeServer.registerOrchestrator(
      () => ({ suspendAudio, resumeAudio }) as any,
    );

    const clientTransport = new PostMessageTransport(window as any);
    clientTransport.setTargetWindow(window as any);
    const client = new BridgeClient(clientTransport);

    const p = client.suspendEngine();
    await vi.runAllTimersAsync();
    expect(await p).toBe(true);
    expect(suspendAudio).toHaveBeenCalledOnce();

    const r = client.resumeEngine();
    await vi.runAllTimersAsync();
    expect(await r).toBe(true);
    expect(resumeAudio).toHaveBeenCalledOnce();

    BridgeServer.registerOrchestrator(null as any);
  });
});
