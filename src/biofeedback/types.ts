export interface Subscription {
  unsubscribe(): void;
}

export interface Observer<T> {
  next(value: T): void;
  error?(err: unknown): void;
  complete?(): void;
}

export class Observable<T> {
  private subscribeFn: (observer: Observer<T>) => (() => void) | Subscription;

  constructor(
    subscribe: (observer: Observer<T>) => (() => void) | Subscription,
  ) {
    this.subscribeFn = subscribe;
  }

  subscribe(nextOrObserver: Observer<T> | ((value: T) => void)): Subscription {
    let observer: Observer<T>;
    if (typeof nextOrObserver === 'function') {
      observer = { next: nextOrObserver };
    } else {
      observer = nextOrObserver;
    }

    const cleanup = this.subscribeFn(observer);
    return {
      unsubscribe() {
        if (typeof cleanup === 'function') {
          cleanup();
        } else if (cleanup && typeof cleanup.unsubscribe === 'function') {
          cleanup.unsubscribe();
        }
      },
    };
  }
}

export type BiosignalFrame = {
  timestamp: number; // ms since session start
  device_clock?: number; // device's own timestamp if available (for sync verification)
  channels: {
    [channel_name: string]: {
      value: number;
      unit: string; // 'bpm' | 'rr_ms' | 'breaths_per_min' | 'volts' | 'siemens' | 'microvolts' | ...
      confidence?: number; // 0-1, if device reports it
    };
  };
};

export interface BiosignalAdapter {
  readonly id: string;
  readonly name: string;
  readonly capabilities: string[]; // 'hrv' | 'breath' | 'eeg' | 'ecg' | 'gsr' | 'emg' | ...
  readonly transports: ('webserial' | 'webbluetooth' | 'webhid' | 'osc')[];

  connect(
    transport: 'webserial' | 'webbluetooth' | 'webhid' | 'osc',
  ): Promise<unknown>;
  disconnect(connection: unknown): Promise<void>;

  // Returns a stream of typed biosignal frames at the device's natural rate
  stream(connection: unknown): Observable<BiosignalFrame>;
}
