import { BiosignalAdapter, Observable, BiosignalFrame } from '../types';

interface BLECharacteristic {
  readonly value?: DataView;
  addEventListener(
    type: 'characteristicvaluechanged',
    listener: (event: { target: { value: DataView } }) => void,
  ): void;
  removeEventListener(
    type: 'characteristicvaluechanged',
    listener: (event: { target: { value: DataView } }) => void,
  ): void;
  startNotifications(): Promise<this>;
  stopNotifications(): Promise<this>;
}

interface BLEConnection {
  isMock?: boolean;
  device?: { name?: string; gatt?: { disconnect(): void } };
  intervalId?: ReturnType<typeof setInterval> | null;
  server?: { connected?: boolean };
  characteristics?: BLECharacteristic[];
}

export class MuseAdapter implements BiosignalAdapter {
  readonly id = 'muse';
  readonly name = 'Muse 2 / S';
  readonly capabilities = ['eeg'];
  readonly transports: ('webserial' | 'webbluetooth' | 'webhid' | 'osc')[] = [
    'webbluetooth',
  ];

  private listeners = new Map<
    BLECharacteristic,
    (event: { target: { value: DataView } }) => void
  >();

  async connect(
    transport: 'webserial' | 'webbluetooth' | 'webhid' | 'osc',
  ): Promise<BLEConnection> {
    if (transport !== 'webbluetooth') {
      throw new Error(`Unsupported transport: ${transport}`);
    }

    if (
      typeof window === 'undefined' ||
      !window.navigator ||
      !('bluetooth' in window.navigator) ||
      (window as unknown as { __MOCK_BLE__?: boolean }).__MOCK_BLE__
    ) {
      console.warn(
        'Web Bluetooth not available or mock mode active. Hydrating mock Muse connection.',
      );
      return {
        isMock: true,
        device: { name: 'Muse 2 (Mock)' },
        intervalId: null,
      };
    }

    try {
      const device = await (
        navigator as Navigator & {
          bluetooth: {
            requestDevice(options: {
              filters: { services: string[] }[];
            }): Promise<{
              gatt?: {
                connect(): Promise<{
                  connected?: boolean;
                  getPrimaryService(uuid: string): Promise<{
                    getCharacteristic(uuid: string): Promise<BLECharacteristic>;
                  }>;
                }>;
                disconnect(): void;
              };
            }>;
          };
        }
      ).bluetooth.requestDevice({
        filters: [{ services: ['0000fe8d-0000-1000-8000-00805f9b34fb'] }],
      });

      if (!device.gatt) {
        throw new Error('GATT server not found on BLE device');
      }

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(
        '0000fe8d-0000-1000-8000-00805f9b34fb',
      );

      // Muse characteristics for TP9, AF7, AF8, TP10 raw EEG channels
      const charIds = [
        '27330003-b5a1-4b10-8b2d-95509157db7a', // TP9
        '27330004-b5a1-4b10-8b2d-95509157db7a', // AF7
        '27330005-b5a1-4b10-8b2d-95509157db7a', // AF8
        '27330006-b5a1-4b10-8b2d-95509157db7a', // TP10
      ];

      const characteristics: BLECharacteristic[] = [];
      for (const id of charIds) {
        const char = await service.getCharacteristic(id);
        await char.startNotifications();
        characteristics.push(char);
      }

      return {
        device,
        server,
        characteristics,
      };
    } catch (err) {
      console.error('Failed to connect to Muse via BLE', err);
      throw err;
    }
  }

  async disconnect(connection: unknown): Promise<void> {
    if (!connection) return;
    const conn = connection as BLEConnection;

    if (conn.isMock) {
      if (conn.intervalId) {
        clearInterval(conn.intervalId);
      }
      return;
    }

    try {
      if (conn.characteristics) {
        for (const char of conn.characteristics) {
          const listener = this.listeners.get(char);
          if (listener) {
            char.removeEventListener('characteristicvaluechanged', listener);
            this.listeners.delete(char);
          }
          await char.stopNotifications();
        }
      }
      if (conn.server && conn.server.connected) {
        conn.device?.gatt?.disconnect();
      }
    } catch (err) {
      console.error('Error disconnecting Muse adapter', err);
    }
  }

  stream(connection: unknown): Observable<BiosignalFrame> {
    const conn = connection as BLEConnection;
    const startTime = Date.now();

    return new Observable<BiosignalFrame>((observer) => {
      if (conn.isMock) {
        // Emit 220Hz mock EEG stream (natural rate of Muse is 220Hz)
        const intervalMs = 5;
        conn.intervalId = setInterval(() => {
          const t = (Date.now() - startTime) / 1000;

          // Generate biological EEG signals: alpha waves (10Hz, relaxed state), theta (6Hz), and noise
          const alpha = Math.sin(2 * Math.PI * 10 * t) * 12;
          const theta = Math.sin(2 * Math.PI * 6 * t) * 18;
          const beta = Math.sin(2 * Math.PI * 22 * t) * 5;
          const noise = (Math.random() - 0.5) * 4;

          const frame: BiosignalFrame = {
            timestamp: Date.now() - startTime,
            device_clock: Date.now(),
            channels: {
              eeg_tp9: {
                value: alpha + noise,
                unit: 'microvolts',
                confidence: 0.96,
              },
              eeg_af7: {
                value: theta + beta + noise,
                unit: 'microvolts',
                confidence: 0.96,
              },
              eeg_af8: {
                value: theta - beta + noise,
                unit: 'microvolts',
                confidence: 0.96,
              },
              eeg_tp10: {
                value: alpha - theta + noise,
                unit: 'microvolts',
                confidence: 0.96,
              },
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

      // Live Muse BLE characteristics streams
      const latestValues: Record<string, number> = {
        eeg_tp9: 0,
        eeg_af7: 0,
        eeg_af8: 0,
        eeg_tp10: 0,
      };

      const handleChannelValue =
        (channelName: string) => (event: { target: { value: DataView } }) => {
          try {
            const value = event.target.value;
            if (!value || value.byteLength < 2) return;

            // Parse first 12-bit sample in characteristic buffer
            const sample = (value.getUint8(0) << 4) | (value.getUint8(1) >> 4);
            // Scale sample to microvolts (0.48828 microvolts per step typical)
            const microvolts = (sample - 2048) * 0.48828;

            latestValues[channelName] = microvolts;

            const frame: BiosignalFrame = {
              timestamp: Date.now() - startTime,
              device_clock: Date.now(),
              channels: {
                eeg_tp9: {
                  value: latestValues['eeg_tp9']!,
                  unit: 'microvolts',
                  confidence: 1.0,
                },
                eeg_af7: {
                  value: latestValues['eeg_af7']!,
                  unit: 'microvolts',
                  confidence: 1.0,
                },
                eeg_af8: {
                  value: latestValues['eeg_af8']!,
                  unit: 'microvolts',
                  confidence: 1.0,
                },
                eeg_tp10: {
                  value: latestValues['eeg_tp10']!,
                  unit: 'microvolts',
                  confidence: 1.0,
                },
              },
            };
            observer.next(frame);
          } catch (err) {
            console.error(
              `Error reading Muse channel ${channelName} buffer`,
              err,
            );
          }
        };

      const channelNames = ['eeg_tp9', 'eeg_af7', 'eeg_af8', 'eeg_tp10'];
      if (conn.characteristics) {
        conn.characteristics.forEach(
          (char: BLECharacteristic, index: number) => {
            const name = channelNames[index]!;
            const handler = handleChannelValue(name);
            char.addEventListener('characteristicvaluechanged', handler);
            this.listeners.set(char, handler);
          },
        );
      }

      return () => {
        if (conn.characteristics) {
          conn.characteristics.forEach((char: BLECharacteristic) => {
            const listener = this.listeners.get(char);
            if (listener) {
              char.removeEventListener('characteristicvaluechanged', listener);
              this.listeners.delete(char);
            }
          });
        }
      };
    });
  }
}
