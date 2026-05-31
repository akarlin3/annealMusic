import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MuseAdapter } from '../adapters/muse';

describe('MuseAdapter', () => {
  let adapter: MuseAdapter;

  beforeEach(() => {
    adapter = new MuseAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).__MOCK_BLE__;
  });

  it('should initialize with correct properties', () => {
    expect(adapter.id).toBe('muse');
    expect(adapter.name).toBe('Muse 2 / S');
    expect(adapter.capabilities).toContain('eeg');
    expect(adapter.transports).toContain('webbluetooth');
  });

  it('should connect in simulated mock mode', async () => {
    (globalThis as any).__MOCK_BLE__ = true;
    const connection: any = await adapter.connect('webbluetooth');

    expect(connection).toBeDefined();
    expect(connection.isMock).toBe(true);
    expect(connection.device.name).toContain('Muse');

    await adapter.disconnect(connection);
  });

  it('should stream simulated multi-channel EEG signals in mock mode', async () => {
    (globalThis as any).__MOCK_BLE__ = true;
    const connection = await adapter.connect('webbluetooth');

    const frames: any[] = [];
    vi.useFakeTimers();
    const subscription = adapter.stream(connection).subscribe({
      next: (frame) => {
        frames.push(frame);
      },
    });

    vi.advanceTimersByTime(25); // 25ms at 220Hz -> should be ~5 samples

    expect(frames.length).toBeGreaterThanOrEqual(3);
    expect(frames[0].channels.eeg_tp9).toBeDefined();
    expect(frames[0].channels.eeg_af7).toBeDefined();
    expect(frames[0].channels.eeg_af8).toBeDefined();
    expect(frames[0].channels.eeg_tp10).toBeDefined();
    expect(frames[0].channels.eeg_tp9.unit).toBe('microvolts');

    subscription.unsubscribe();
    await adapter.disconnect(connection);
    vi.useRealTimers();
  });
});
