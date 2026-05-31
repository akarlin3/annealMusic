/* eslint-disable @typescript-eslint/no-explicit-any */
import { BiosignalAdapter, Observable, BiosignalFrame } from '../types';

export class EmpaticaAdapter implements BiosignalAdapter {
  readonly id = 'empatica';
  readonly name = 'Empatica E4 / EmbracePlus';
  readonly capabilities = ['hrv', 'gsr', 'accelerometer'];
  readonly transports: ('webserial' | 'webbluetooth' | 'webhid' | 'osc')[] = [];

  async connect(): Promise<unknown> {
    throw new Error(
      'Empatica streams are export-only in v7.4. Please upload an Empatica session dataset in CSV format.',
    );
  }

  async disconnect(): Promise<void> {}

  stream(): Observable<BiosignalFrame> {
    return new Observable<BiosignalFrame>((observer) => {
      observer.complete?.();
      return () => {};
    });
  }
}
