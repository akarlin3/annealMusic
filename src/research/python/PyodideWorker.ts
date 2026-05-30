import { ANNEAL_PY_MODULE } from './annealPyModule';

export interface WorkerInitStatus {
  stage: 'loading' | 'ready' | 'error';
  progress?: number;
  error?: string;
}

export class PyodideWorker {
  private worker: Worker | null = null;
  private onStatusCallback: ((status: WorkerInitStatus) => void) | null = null;
  private runResolver: ((success: boolean) => void) | null = null;
  private replResolver:
    | ((res: { success: boolean; result?: string; error?: string }) => void)
    | null = null;
  private onStdoutCallback: ((text: string) => void) | null = null;
  private onStderrCallback: ((text: string) => void) | null = null;

  constructor() {
    this.createWorker();
  }

  private createWorker(): void {
    // Vite compiles workers specified with URL constructor natively
    this.worker = new Worker(new URL('./pyodide-worker.js', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = (event) => {
      const { type, stage, progress, error, text, success, result } =
        event.data;

      if (type === 'status') {
        if (this.onStatusCallback) {
          this.onStatusCallback({ stage, progress, error });
        }
      } else if (type === 'stdout') {
        if (this.onStdoutCallback) {
          this.onStdoutCallback(text);
        }
      } else if (type === 'stderr') {
        if (this.onStderrCallback) {
          this.onStderrCallback(text);
        }
      } else if (type === 'run-complete') {
        if (this.runResolver) {
          this.runResolver(success);
          this.runResolver = null;
        }
      } else if (type === 'repl-complete') {
        if (this.replResolver) {
          this.replResolver({ success, result, error });
          this.replResolver = null;
        }
      }
    };
  }

  init(onStatus: (status: WorkerInitStatus) => void): void {
    this.onStatusCallback = onStatus;
    if (this.worker) {
      this.worker.postMessage({
        type: 'init',
        moduleCode: ANNEAL_PY_MODULE,
      });
    }
  }

  run(
    code: string,
    onStdout: (text: string) => void,
    onStderr: (text: string) => void,
  ): Promise<boolean> {
    this.onStdoutCallback = onStdout;
    this.onStderrCallback = onStderr;

    return new Promise((resolve) => {
      this.runResolver = resolve;
      if (this.worker) {
        this.worker.postMessage({
          type: 'run',
          code,
        });
      } else {
        resolve(false);
      }
    });
  }

  repl(
    code: string,
    onStdout: (text: string) => void,
    onStderr: (text: string) => void,
  ): Promise<{ success: boolean; result?: string; error?: string }> {
    this.onStdoutCallback = onStdout;
    this.onStderrCallback = onStderr;

    return new Promise((resolve) => {
      this.replResolver = resolve;
      if (this.worker) {
        this.worker.postMessage({
          type: 'repl',
          code,
        });
      } else {
        resolve({ success: false, error: 'Worker not instantiated.' });
      }
    });
  }

  // Throttled live update stream from audio thread/bridge to worker MEMFS cache
  updateFftData(
    spectrum: number[],
    partials: { freq: number; amp: number }[],
  ): void {
    if (this.worker) {
      this.worker.postMessage({
        type: 'fft-update',
        spectrum,
        partials,
      });
    }
  }

  syncCache(payload: {
    params: Record<string, number>;
    engineId: string;
    engineParams: Record<string, number>;
    tuning: Record<string, unknown>;
    mode: string;
  }): void {
    if (this.worker) {
      this.worker.postMessage({
        type: 'cache-update',
        ...payload,
      });
    }
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.runResolver = null;
    this.replResolver = null;
    this.createWorker(); // RESTORE with clean instance
  }
}
