import { useParamStore } from '@/state/params';
import type { PyodideWorker } from './PyodideWorker';
import type { BridgeClient } from '../bridge/BridgeClient';

export class JSBridgeSync {
  private worker: PyodideWorker;
  private client: BridgeClient;
  private fftInterval: NodeJS.Timeout | null = null;
  private storeUnsubscribe: (() => void) | null = null;

  constructor(worker: PyodideWorker, client: BridgeClient) {
    this.worker = worker;
    this.client = client;
  }

  start(): void {
    // 1. Warm start the worker cache with initial Zustand parameter values
    const store = useParamStore.getState();
    if (this.worker) {
      this.worker.syncCache({
        params: store.params,
        engineId: store.engineId,
        engineParams: store.engineParams,
        tuning: store.tuning,
        mode: store.mode,
      });
    }

    // 2. Continuous 50Hz (20ms) push stream of FFT spectrum + partials to the worker
    this.fftInterval = setInterval(async () => {
      try {
        // Only fetch if session is active to avoid useless CPU cycles
        const status = await this.client.getSessionStatus();
        if (status.status !== 'idle') {
          const specRes = await this.client.getSpectrum();
          const partRes = await this.client.getPartials();
          if (specRes && partRes) {
            this.worker.updateFftData(specRes.spectrum, partRes.partials);
          }
        }
      } catch {
        // Silent recovery
      }
    }, 20);

    this.storeUnsubscribe = useParamStore.subscribe((state) => {
      if (this.worker) {
        this.worker.syncCache({
          params: state.params,
          engineId: state.engineId,
          engineParams: state.engineParams,
          tuning: state.tuning,
          mode: state.mode,
        });
      }
    });
  }

  stop(): void {
    if (this.fftInterval) {
      clearInterval(this.fftInterval);
      this.fftInterval = null;
    }
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }
  }
}
