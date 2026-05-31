import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PolarH10Adapter } from '../adapters/polar-h10';

describe('PolarH10Adapter', () => {
  let adapter: PolarH10Adapter;

  beforeEach(() => {
    adapter = new PolarH10Adapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).__MOCK_BLE__;
  });

  it('should initialize with correct capabilities and properties', () => {
    expect(adapter.id).toBe('polar-h10');
    expect(adapter.name).toBe('Polar H10');
    expect(adapter.capabilities).toContain('hrv');
    expect(adapter.capabilities).toContain('heart_rate');
    expect(adapter.transports).toContain('webbluetooth');
  });

  it('should establish a simulated mock connection when BLE is unavailable', async () => {
    (globalThis as any).__MOCK_BLE__ = true;
    const connection: any = await adapter.connect('webbluetooth');

    expect(connection).toBeDefined();
    expect(connection.isMock).toBe(true);
    expect(connection.device.name).toContain('Polar H10');

    await adapter.disconnect(connection);
  });

  it('should stream simulated heart rate and hrv values in mock mode', async () => {
    (globalThis as any).__MOCK_BLE__ = true;
    const connection = await adapter.connect('webbluetooth');

    const frames: any[] = [];
    vi.useFakeTimers();
    const subscription = adapter.stream(connection).subscribe({
      next: (frame) => {
        frames.push(frame);
      },
    });

    vi.advanceTimersByTime(2500);

    expect(frames.length).toBeGreaterThanOrEqual(2);
    expect(frames[0].channels.heart_rate).toBeDefined();
    expect(frames[0].channels.hrv).toBeDefined();
    expect(frames[0].channels.heart_rate.unit).toBe('bpm');
    expect(frames[0].channels.hrv.unit).toBe('rr_ms');

    subscription.unsubscribe();
    await adapter.disconnect(connection);
    vi.useRealTimers();
  });

  it('should parse 8-bit Heart Rate BLE measurement packets correctly without RR intervals', () => {
    // Construct a mocked BLE event target value DataView
    // Packet flags: 0x00 (8-bit HR, no sensor contact info, no energy expended, no R-R intervals)
    // HR: 72 bpm
    const buffer = new ArrayBuffer(2);
    const view = new DataView(buffer);
    view.setUint8(0, 0x00);
    view.setUint8(1, 72);

    const mockEvent = {
      target: {
        value: view,
      },
    };

    const mockCharacteristic = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const connection = {
      characteristic: mockCharacteristic,
    };

    let capturedFrame: any = null;
    const subscription = adapter.stream(connection).subscribe({
      next: (frame) => {
        capturedFrame = frame;
      },
    });

    // Retrieve the registered listener callback
    expect(mockCharacteristic.addEventListener).toHaveBeenCalledWith(
      'characteristicvaluechanged',
      expect.any(Function),
    );
    const callback = (mockCharacteristic.addEventListener as any).mock
      .calls[0][1];

    // Trigger the callback with mock BLE packet
    callback(mockEvent);

    expect(capturedFrame).toBeDefined();
    expect(capturedFrame.channels.heart_rate.value).toBe(72);
    expect(capturedFrame.channels.hrv).toBeUndefined();

    subscription.unsubscribe();
  });

  it('should parse 16-bit Heart Rate BLE packets with multiple R-R intervals correctly', () => {
    // Packet flags: 0x11 (16-bit HR, R-R intervals present)
    // HR: 75 bpm (0x004B)
    // RR Interval 1: 820ms -> 820 * 1024 / 1000 = 840 (0x0348)
    // RR Interval 2: 800ms -> 800 * 1024 / 1000 = 819 (0x0333)
    const buffer = new ArrayBuffer(7);
    const view = new DataView(buffer);
    view.setUint8(0, 0x11);
    view.setUint16(1, 75, true);
    view.setUint16(3, 840, true);
    view.setUint16(5, 819, true);

    const mockEvent = {
      target: {
        value: view,
      },
    };

    const mockCharacteristic = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const connection = {
      characteristic: mockCharacteristic,
    };

    const capturedFrames: any[] = [];
    const subscription = adapter.stream(connection).subscribe({
      next: (frame) => {
        capturedFrames.push(frame);
      },
    });

    const callback = (mockCharacteristic.addEventListener as any).mock
      .calls[0][1];
    callback(mockEvent);

    // Should emit two frames (one per R-R interval)
    expect(capturedFrames.length).toBe(2);
    expect(capturedFrames[0].channels.heart_rate.value).toBe(75);
    expect(capturedFrames[0].channels.hrv.value).toBe(820);
    expect(capturedFrames[1].channels.hrv.value).toBe(800);

    subscription.unsubscribe();
  });
});
