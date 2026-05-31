/* eslint-disable @typescript-eslint/no-explicit-any */
import { BiosignalAdapter, Observable, BiosignalFrame } from '../types';

export class PolarH10Adapter implements BiosignalAdapter {
  readonly id: string = 'polar-h10';
  readonly name: string = 'Polar H10';
  readonly capabilities = ['hrv', 'heart_rate'];
  readonly transports: ('webserial' | 'webbluetooth' | 'webhid' | 'osc')[] = [
    'webbluetooth',
  ];

  // Keep track of active listener functions for cleanup
  private listeners = new Map<unknown, (event: any) => void>();

  async connect(
    transport: 'webserial' | 'webbluetooth' | 'webhid' | 'osc',
  ): Promise<unknown> {
    if (transport !== 'webbluetooth') {
      throw new Error(`Unsupported transport: ${transport}`);
    }

    // Support simulated mode for testing or when running in environments without Web Bluetooth
    if (
      typeof window === 'undefined' ||
      !window.navigator ||
      !('bluetooth' in window.navigator) ||
      (window as any).__MOCK_BLE__
    ) {
      console.warn(
        'Web Bluetooth not available or mock mode active. Hydrating mock Polar H10 connection.',
      );
      return {
        isMock: true,
        device: { name: 'Polar H10 (Mock)' },
        intervalId: null,
      };
    }

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
      });

      if (!device.gatt) {
        throw new Error('GATT server not found on BLE device');
      }

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('heart_rate');
      const characteristic = await service.getCharacteristic(
        'heart_rate_measurement',
      );

      await characteristic.startNotifications();

      return {
        device,
        server,
        service,
        characteristic,
      };
    } catch (err) {
      console.error('Failed to connect to Polar H10 via BLE', err);
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
      if (conn.characteristic) {
        // Clean up event listener if registered
        const listener = this.listeners.get(conn.characteristic);
        if (listener) {
          conn.characteristic.removeEventListener(
            'characteristicvaluechanged',
            listener,
          );
          this.listeners.delete(conn.characteristic);
        }
        await conn.characteristic.stopNotifications();
      }
      if (conn.server && conn.server.connected) {
        conn.device.gatt.disconnect();
      }
    } catch (err) {
      console.error('Error disconnecting Polar H10', err);
    }
  }

  stream(connection: unknown): Observable<BiosignalFrame> {
    const conn = connection as any;
    const startTime = Date.now();

    return new Observable<BiosignalFrame>((observer) => {
      if (conn.isMock) {
        // Mock stream: emit a frame every 1 second
        let lastRR = 800; // start RR around 800ms (75 bpm)
        conn.intervalId = setInterval(() => {
          // Add some random walk to RR interval for natural heart rate variability
          const rrChange = Math.round((Math.random() - 0.5) * 40);
          lastRR = Math.max(600, Math.min(1200, lastRR + rrChange));
          const bpm = Math.round(60000 / lastRR);

          const frame: BiosignalFrame = {
            timestamp: Date.now() - startTime,
            device_clock: Date.now(),
            channels: {
              heart_rate: { value: bpm, unit: 'bpm', confidence: 0.95 },
              hrv: { value: lastRR, unit: 'rr_ms', confidence: 0.95 },
            },
          };
          observer.next(frame);
        }, 1000);

        return () => {
          if (conn.intervalId) {
            clearInterval(conn.intervalId);
            conn.intervalId = null;
          }
        };
      }

      // Live BLE GATT stream
      const handleBleValue = (event: any) => {
        try {
          const value = event.target.value as DataView;
          if (!value || value.byteLength === 0) return;

          const flags = value.getUint8(0);
          const rate16 = flags & 0x1;
          let offset = 1;

          let bpm = 0;
          if (rate16) {
            bpm = value.getUint16(offset, true);
            offset += 2;
          } else {
            bpm = value.getUint8(offset);
            offset += 1;
          }

          // Sensor contact status
          const contactDetected = (flags & 0x6) === 0x6;
          const confidence = contactDetected ? 1.0 : 0.7;

          // Energy expended present
          const energyPresent = flags & 0x8;
          if (energyPresent) {
            offset += 2;
          }

          // RR Interval(s) present
          const rrPresent = flags & 0x10;
          if (rrPresent && offset < value.byteLength) {
            while (offset < value.byteLength) {
              const rrValue = value.getUint16(offset, true);
              offset += 2;
              // R-R is in units of 1/1024s. Convert to ms.
              const rrMs = Math.round((rrValue * 1000) / 1024);

              const frame: BiosignalFrame = {
                timestamp: Date.now() - startTime,
                device_clock: Date.now(),
                channels: {
                  heart_rate: { value: bpm, unit: 'bpm', confidence },
                  hrv: { value: rrMs, unit: 'rr_ms', confidence },
                },
              };
              observer.next(frame);
            }
          } else {
            // If no RR interval is present in this packet, send the BPM alone
            const frame: BiosignalFrame = {
              timestamp: Date.now() - startTime,
              device_clock: Date.now(),
              channels: {
                heart_rate: { value: bpm, unit: 'bpm', confidence },
              },
            };
            observer.next(frame);
          }
        } catch (err) {
          if (observer.error) {
            observer.error(err);
          } else {
            console.error('Error reading BLE Heart Rate stream value', err);
          }
        }
      };

      conn.characteristic.addEventListener(
        'characteristicvaluechanged',
        handleBleValue,
      );
      this.listeners.set(conn.characteristic, handleBleValue);

      return () => {
        if (conn.characteristic) {
          const listener = this.listeners.get(conn.characteristic);
          if (listener) {
            conn.characteristic.removeEventListener(
              'characteristicvaluechanged',
              listener,
            );
            this.listeners.delete(conn.characteristic);
          }
        }
      };
    });
  }
}
