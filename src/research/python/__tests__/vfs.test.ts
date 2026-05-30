/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PyodideWorker } from '../PyodideWorker';

describe('PyodideWorker VFS & Plot Interop Layer', () => {
  let worker: PyodideWorker;
  let mockPostMessage: any;
  let mockOnMessageCallback: any;

  beforeEach(() => {
    mockPostMessage = vi.fn();

    // Stub the global Worker constructor
    vi.stubGlobal(
      'Worker',
      vi.fn().mockImplementation(() => {
        const w = {
          postMessage: mockPostMessage,
          terminate: vi.fn(),
          onmessage: null as any,
        };

        // Store the callback so we can simulate messages from worker to main thread
        setTimeout(() => {
          mockOnMessageCallback = w.onmessage;
        }, 0);

        return w;
      }),
    );

    worker = new PyodideWorker();
  });

  it('sends vfs-list message and resolves with stat array', async () => {
    // Wait briefly for constructor to run and set callback
    await new Promise((resolve) => setTimeout(resolve, 5));

    const listPromise = worker.vfsList();

    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'vfs-list' });

    // Simulate response from worker
    mockOnMessageCallback({
      data: {
        type: 'vfs-list-response',
        success: true,
        files: [
          {
            name: 'test.wav',
            path: '/tmp/test.wav',
            sizeBytes: 1024,
            mtime: 12345,
          },
        ],
      },
    });

    const result = await listPromise;
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('test.wav');
    expect(result[0].sizeBytes).toBe(1024);
  });

  it('sends vfs-read message and resolves with bytes', async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));

    const readPromise = worker.vfsRead('/tmp/test.wav');

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'vfs-read',
      path: '/tmp/test.wav',
    });

    const dummyBytes = new Uint8Array([1, 2, 3]);
    mockOnMessageCallback({
      data: {
        type: 'vfs-read-response',
        success: true,
        path: '/tmp/test.wav',
        bytes: dummyBytes,
      },
    });

    const result = await readPromise;
    expect(result).toBe(dummyBytes);
    expect(result[0]).toBe(1);
  });

  it('sends vfs-delete message and resolves success status', async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));

    const deletePromise = worker.vfsDelete('/tmp/test.wav');

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'vfs-delete',
      path: '/tmp/test.wav',
    });

    mockOnMessageCallback({
      data: {
        type: 'vfs-delete-response',
        success: true,
        path: '/tmp/test.wav',
      },
    });

    const success = await deletePromise;
    expect(success).toBe(true);
  });

  it('triggers registered callback when plot-render message is received', async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));

    const plotCallback = vi.fn();
    worker.onPlotRender(plotCallback);

    const dummyPlotBytes = [10, 20, 30];
    mockOnMessageCallback({
      data: {
        type: 'plot-render',
        bytes: dummyPlotBytes,
      },
    });

    expect(plotCallback).toHaveBeenCalledWith(dummyPlotBytes);
  });
});
