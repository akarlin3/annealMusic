/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { JSBridgeSync } from '../bridge';
import { PyodideWorker } from '../PyodideWorker';
import { BridgeClient } from '../../bridge/BridgeClient';

vi.mock('../PyodideWorker', () => {
  return {
    PyodideWorker: vi.fn().mockImplementation(() => {
      return {
        updateFftData: vi.fn(),
        syncCache: vi.fn(),
        worker: {
          postMessage: vi.fn(),
        },
      };
    }),
  };
});

vi.mock('../../bridge/BridgeClient', () => {
  return {
    BridgeClient: vi.fn().mockImplementation(() => {
      return {
        getSessionStatus: vi.fn().mockResolvedValue({ status: 'active' }),
        getSpectrum: vi.fn().mockResolvedValue({ spectrum: [1, 2, 3] }),
        getPartials: vi
          .fn()
          .mockResolvedValue({ partials: [{ freq: 440, amp: 0.5 }] }),
        close: vi.fn(),
      };
    }),
  };
});

describe('JSBridgeSync coordinate layer', () => {
  let worker: PyodideWorker;
  let client: BridgeClient;
  let sync: JSBridgeSync;

  beforeEach(() => {
    vi.useFakeTimers();
    worker = new PyodideWorker();
    client = new BridgeClient();
    sync = new JSBridgeSync(worker, client);
  });

  afterEach(() => {
    vi.useRealTimers();
    sync.stop();
  });

  it('correctly warm starts the worker cache with initial state', () => {
    sync.start();

    // Verify it called syncCache with parameter store state
    const syncCacheMock = worker.syncCache as any;
    expect(syncCacheMock).toHaveBeenCalled();
    const calls = syncCacheMock.mock.calls;
    const cacheUpdate = calls[0][0];
    expect(cacheUpdate).toBeDefined();
    expect(cacheUpdate.engineId).toBeDefined();
  });

  it('streams FFT and partials coupling analyses at 50Hz', async () => {
    sync.start();

    // Advance timers by 40ms to trigger two ticks
    await vi.advanceTimersByTimeAsync(40);

    expect(client.getSpectrum).toHaveBeenCalled();
    expect(client.getPartials).toHaveBeenCalled();
    expect(worker.updateFftData).toHaveBeenCalledWith(
      [1, 2, 3],
      [{ freq: 440, amp: 0.5 }],
    );
  });
});
