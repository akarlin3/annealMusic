/* eslint-disable */
import { BiosignalAdapter, Observable, BiosignalFrame } from '../types';

export class OpenBCICytonAdapter implements BiosignalAdapter {
  readonly id = 'openbci-cyton';
  readonly name = 'OpenBCI Cyton';
  readonly capabilities = ['eeg', 'accelerometer'];
  readonly transports: ('webserial' | 'webbluetooth' | 'webhid' | 'osc')[] = [
    'webserial',
  ];

  async connect(
    transport: 'webserial' | 'webbluetooth' | 'webhid' | 'osc',
  ): Promise<unknown> {
    if (transport !== 'webserial') {
      throw new Error(`Unsupported transport: ${transport}`);
    }

    if (
      typeof window === 'undefined' ||
      !window.navigator ||
      !('serial' in window.navigator) ||
      (window as any).__MOCK_SERIAL__
    ) {
      console.warn(
        'WebSerial not available or mock mode active. Hydrating mock OpenBCI connection.',
      );
      return {
        isMock: true,
        device: { name: 'OpenBCI Cyton (Mock)' },
        intervalId: null,
      };
    }

    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });

      return {
        port,
        reader: null,
      };
    } catch (err) {
      console.error('Failed to connect to OpenBCI Cyton over WebSerial', err);
      throw err;
    }
  }

  async disconnect(connection: unknown): Promise<void> {
    if (!connection) return;
    const conn = connection as any;

    if (conn.isMock) {
      if (conn.intervalId) {
        clearInterval(conn.intervalId);
      }
      return;
    }

    try {
      if (conn.reader) {
        await conn.reader.cancel();
      }
      if (conn.port) {
        await conn.port.close();
      }
    } catch (err) {
      console.error('Error disconnecting OpenBCI Cyton', err);
    }
  }

  stream(connection: unknown): Observable<BiosignalFrame> {
    const conn = connection as any;
    const startTime = Date.now();

    return new Observable<BiosignalFrame>((observer) => {
      if (conn.isMock) {
        // Emit 250Hz mock EEG data frames
        const intervalMs = 4; // 250Hz = 4ms intervals
        let sampleCount = 0;
        conn.intervalId = setInterval(() => {
          sampleCount++;
          const t = (Date.now() - startTime) / 1000;

          // Generate simulated EEG signals (alpha waves 10Hz, theta waves 5Hz, noise)
          const alpha = Math.sin(2 * Math.PI * 10 * t) * 15;
          const theta = Math.sin(2 * Math.PI * 5 * t) * 25;
          const noise = (Math.random() - 0.5) * 5;

          const eegVal = alpha + theta + noise;

          const frame: BiosignalFrame = {
            timestamp: Date.now() - startTime,
            device_clock: Date.now(),
            channels: {
              eeg_ch1: { value: eegVal, unit: 'microvolts', confidence: 0.98 },
              eeg_ch2: {
                value: eegVal * 0.8 + noise,
                unit: 'microvolts',
                confidence: 0.98,
              },
              eeg_ch3: {
                value: -alpha + noise,
                unit: 'microvolts',
                confidence: 0.98,
              },
              eeg_ch4: {
                value: theta + noise,
                unit: 'microvolts',
                confidence: 0.98,
              },
              eeg_ch5: {
                value: eegVal * 1.2,
                unit: 'microvolts',
                confidence: 0.98,
              },
              eeg_ch6: {
                value: noise * 2,
                unit: 'microvolts',
                confidence: 0.98,
              },
              eeg_ch7: { value: alpha, unit: 'microvolts', confidence: 0.98 },
              eeg_ch8: { value: theta, unit: 'microvolts', confidence: 0.98 },
            },
          };
          observer.next(frame);
        }, intervalMs);

        return () => {
          if (conn.intervalId) {
            clearInterval(conn.intervalId);
            conn.intervalId = null;
          }
        };
      }

      // Live WebSerial reader stream loop
      let isStreaming = true;
      const readSerial = async () => {
        try {
          const reader = conn.port.readable.getReader();
          conn.reader = reader;

          // Buffer for incoming serial bytes
          let buffer: number[] = [];

          while (isStreaming) {
            const { value, done } = await reader.read();
            if (done) break;

            if (value) {
              for (let i = 0; i < value.length; i++) {
                buffer.push(value[i]);
              }
            }

            // Process packets (each is 33 bytes starting with 0xA0 and ending with 0xC0..0xC7)
            while (buffer.length >= 33) {
              // Find header 0xA0
              const headerIndex = buffer.indexOf(0xa0);
              if (headerIndex === -1) {
                // No header, discard whole buffer
                buffer = [];
                break;
              }

              if (headerIndex > 0) {
                // Discard leading bytes before header
                buffer = buffer.slice(headerIndex);
              }

              if (buffer.length < 33) break; // incomplete packet

              const footer = buffer[32];
              if (footer !== undefined && footer >= 0xc0 && footer <= 0xc7) {
                // Valid packet!
                const packet = buffer.slice(0, 33);
                buffer = buffer.slice(33);

                // Parse 8 EEG channels (each is 3 bytes, 24-bit signed integer)
                const channels: Record<
                  string,
                  { value: number; unit: string; confidence: number }
                > = {};
                const scaleFactor = (4.5 / 8388607 / 24) * 1e6; // microvolts count

                for (let ch = 0; ch < 8; ch++) {
                  const offset = 2 + ch * 3;
                  const b1 = packet[offset]!;
                  const b2 = packet[offset + 1]!;
                  const b3 = packet[offset + 2]!;

                  let val = (b1 << 16) | (b2 << 8) | b3;
                  if (val & 0x800000) {
                    val -= 0x1000000;
                  }

                  const microvolts = val * scaleFactor;
                  channels[`eeg_ch${ch + 1}`] = {
                    value: microvolts,
                    unit: 'microvolts',
                    confidence: 1.0,
                  };
                }

                const frame: BiosignalFrame = {
                  timestamp: Date.now() - startTime,
                  device_clock: Date.now(),
                  channels,
                };
                observer.next(frame);
              } else {
                // Invalid packet, slice header to look for next one
                buffer = buffer.slice(1);
              }
            }
          }
        } catch (err) {
          if (observer.error) {
            observer.error(err);
          }
        }
      };

      readSerial();

      return () => {
        isStreaming = false;
        if (conn.reader) {
          conn.reader.cancel().catch(() => {});
        }
      };
    });
  }
}
