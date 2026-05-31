/* eslint-disable @typescript-eslint/no-explicit-any */
import { ANNEAL_PY_MODULE } from './annealPyModule';
import { reportError } from '@/observability/errorReporter';

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

  // Scientific additions: VFS and plot hooks
  private vfsListResolver: ((files: any[]) => void) | null = null;
  private vfsReadResolver: ((bytes: Uint8Array) => void) | null = null;
  private vfsDeleteResolver: ((success: boolean) => void) | null = null;
  private onPlotRenderCallback: ((bytes: number[]) => void) | null = null;
  private onExperimentRegisteredCallback: ((experiment: any) => void) | null =
    null;

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
        if (stage === 'error') {
          void reportError(
            error || 'Unknown Pyodide load failure',
            'pyodide-load-failure',
          );
        }
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
      } else if (type === 'plot-render') {
        if (this.onPlotRenderCallback) {
          this.onPlotRenderCallback(event.data.bytes);
        }
      } else if (type === 'vfs-list-response') {
        if (this.vfsListResolver) {
          this.vfsListResolver(event.data.files || []);
          this.vfsListResolver = null;
        }
      } else if (type === 'vfs-read-response') {
        if (this.vfsReadResolver) {
          this.vfsReadResolver(event.data.bytes || new Uint8Array());
          this.vfsReadResolver = null;
        }
      } else if (type === 'vfs-delete-response') {
        if (this.vfsDeleteResolver) {
          this.vfsDeleteResolver(success);
          this.vfsDeleteResolver = null;
        }
      } else if (type === 'experiment-registered') {
        if (this.onExperimentRegisteredCallback) {
          this.onExperimentRegisteredCallback(event.data.experiment);
        }
      }
    };
  }

  init(
    onStatus: (status: WorkerInitStatus) => void,
    preloadScientific = false,
  ): void {
    this.onStatusCallback = onStatus;
    if (this.worker) {
      this.worker.postMessage({
        type: 'init',
        moduleCode: ANNEAL_PY_MODULE,
        preloadScientific,
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
    params: any;
    engineId: string;
    engineParams: any;
    tuning: any;
    mode: string;
  }): void {
    if (this.worker) {
      this.worker.postMessage({
        type: 'cache-update',
        ...payload,
      });
    }
  }

  vfsList(): Promise<any[]> {
    return new Promise((resolve) => {
      this.vfsListResolver = resolve;
      if (this.worker) {
        this.worker.postMessage({ type: 'vfs-list' });
      } else {
        resolve([]);
      }
    });
  }

  vfsRead(path: string): Promise<Uint8Array> {
    return new Promise((resolve) => {
      this.vfsReadResolver = resolve;
      if (this.worker) {
        this.worker.postMessage({ type: 'vfs-read', path });
      } else {
        resolve(new Uint8Array());
      }
    });
  }

  vfsDelete(path: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.vfsDeleteResolver = resolve;
      if (this.worker) {
        this.worker.postMessage({ type: 'vfs-delete', path });
      } else {
        resolve(false);
      }
    });
  }

  onPlotRender(callback: (bytes: number[]) => void): void {
    this.onPlotRenderCallback = callback;
  }

  onExperimentRegistered(callback: (experiment: any) => void): void {
    this.onExperimentRegisteredCallback = callback;
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.runResolver = null;
    this.replResolver = null;
    this.vfsListResolver = null;
    this.vfsReadResolver = null;
    this.vfsDeleteResolver = null;
    this.createWorker(); // RESTORE with clean instance
  }
}
