import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OpenBCICytonAdapter } from '../adapters/openbci-cyton';

describe('OpenBCICytonAdapter', () => {
  let adapter: OpenBCICytonAdapter;

  beforeEach(() => {
    adapter = new OpenBCICytonAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).__MOCK_SERIAL__;
  });

  it('should initialize with correct properties', () => {
    expect(adapter.id).toBe('openbci-cyton');
    expect(adapter.name).toBe('OpenBCI Cyton');
    expect(adapter.capabilities).toContain('eeg');
    expect(adapter.transports).toContain('webserial');
  });

  it('should connect in simulated mock mode', async () => {
    (globalThis as any).__MOCK_SERIAL__ = true;
    const connection: any = await adapter.connect('webserial');

    expect(connection).toBeDefined();
    expect(connection.isMock).toBe(true);
    expect(connection.device.name).toContain('OpenBCI Cyton');

    await adapter.disconnect(connection);
  });

  it('should stream simulated multi-channel EEG signals in mock mode', async () => {
    (globalThis as any).__MOCK_SERIAL__ = true;
    const connection = await adapter.connect('webserial');

    const frames: any[] = [];
    vi.useFakeTimers();
    const subscription = adapter.stream(connection).subscribe({
      next: (frame) => {
        frames.push(frame);
      },
    });

    vi.advanceTimersByTime(20); // 20ms at 250Hz -> should be ~5 samples

    expect(frames.length).toBeGreaterThanOrEqual(3);
    expect(frames[0].channels.eeg_ch1).toBeDefined();
    expect(frames[0].channels.eeg_ch8).toBeDefined();
    expect(frames[0].channels.eeg_ch1.unit).toBe('microvolts');

    subscription.unsubscribe();
    await adapter.disconnect(connection);
    vi.useRealTimers();
  });

  it('should parse raw serial bytes and decode 24-bit ADS1299 binary EEG channels correctly', async () => {
    // 33-byte packet:
    // Byte 0: 0xA0
    // Byte 1: 0x01 (sample count)
    // Bytes 2-25: 8 channels x 3 bytes
    // Let's set Channel 1 to: 0x00, 0x10, 0x00 -> 0x001000 = 4096 (positive signed integer)
    // Let's set Channel 2 to: 0xFF, 0xF0, 0x00 -> 0xFFF000 = -4096 (negative signed integer)
    // Scale factor: 4.5 / 8388607 / 24 * 1e6 = 0.0223517 microvolts/count
    const packet = new Uint8Array(33);
    packet[0] = 0xa0;
    packet[1] = 0x01;
    // Channel 1:
    packet[2] = 0x00;
    packet[3] = 0x10;
    packet[4] = 0x00;
    // Channel 2:
    packet[5] = 0xff;
    packet[6] = 0xf0;
    packet[7] = 0x00;
    // Footer:
    packet[32] = 0xc0;

    // Standard mock reader
    let count = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(async () => {
        if (count === 0) {
          count++;
          return { value: packet, done: false };
        }
        // block/wait indefinitely to simulate active connection
        await new Promise(() => {});
        return { value: null, done: true };
      }),
      cancel: vi.fn().mockResolvedValue(undefined),
    };

    const mockPort = {
      readable: {
        getReader: () => mockReader,
      },
      close: vi.fn().mockResolvedValue(undefined),
    };

    const connection = {
      port: mockPort,
      reader: null,
    };

    let capturedFrame: any = null;
    const subscription = adapter.stream(connection).subscribe({
      next: (frame) => {
        capturedFrame = frame;
      },
    });

    // Wait for async task run loop to execute packet parsing
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(capturedFrame).toBeDefined();
    const scaleFactor = (4.5 / 8388607 / 24) * 1e6;
    expect(capturedFrame.channels.eeg_ch1.value).toBeCloseTo(
      4096 * scaleFactor,
      3,
    );
    expect(capturedFrame.channels.eeg_ch2.value).toBeCloseTo(
      -4096 * scaleFactor,
      3,
    );

    subscription.unsubscribe();
  });
});
