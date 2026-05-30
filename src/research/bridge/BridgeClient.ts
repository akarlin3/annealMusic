/* eslint-disable @typescript-eslint/no-explicit-any */
import { BroadcastTransport } from './transport/broadcast';
import { PostMessageTransport } from './transport/postmessage';
import type { JsonRpcRequest } from './types';

export class BridgeClient {
  private transport: BroadcastTransport | PostMessageTransport;
  private nextId = 1;
  private pendingRequests: Map<
    string | number,
    { resolve: (res: any) => void; reject: (err: Error) => void }
  > = new Map();
  private subscriptionCallbacks: Map<string, (val: any) => void> = new Map();

  constructor(transport?: BroadcastTransport | PostMessageTransport) {
    this.transport = transport || new BroadcastTransport();
    this.transport.onMessage((msg) => this.handleMessage(msg));
  }

  private handleMessage(msg: any): void {
    if (!msg) return;
    console.log('[BridgeClient] Received message:', msg);

    // Check if it's a response (responses never have a 'method' field)
    if (msg.id !== undefined && msg.id !== null && msg.method === undefined) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error.message));
        } else {
          pending.resolve(msg.result);
        }
      }
    }
    // Check if it's a push notification for subscriptions
    else if (msg.method === 'anneal.state.onChange') {
      const { subscriptionId, key, value } = msg.params;
      const cb = this.subscriptionCallbacks.get(subscriptionId);
      if (cb) {
        cb({ key, value });
      }
    }
  }

  private call(method: string, params?: any): Promise<any> {
    const id = this.nextId++;
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.transport.send(req);
    });
  }

  // --- Public API methods ----------------------------------------------------

  async getVersion(): Promise<{ app: string; bridge: string; schema: string }> {
    return this.call('anneal.version');
  }

  async health(): Promise<{ status: 'ok'; timestamp: string }> {
    return this.call('anneal.health');
  }

  async getState(): Promise<any> {
    return this.call('anneal.state.get');
  }

  async setState(params: any): Promise<boolean> {
    return this.call('anneal.state.set', { params });
  }

  async setEngineParam(
    engineId: string,
    key: string,
    value: number | string,
  ): Promise<boolean> {
    return this.call('anneal.state.setEngineParam', { engineId, key, value });
  }

  async setEngine(engineId: string): Promise<boolean> {
    return this.call('anneal.state.setEngine', { engineId });
  }

  async setTuning(tuning: {
    system: string;
    referenceA4Hz: number;
  }): Promise<boolean> {
    return this.call('anneal.state.setTuning', { tuning });
  }

  async subscribe(
    keys: string[],
    callback: (update: { key: string; value: any }) => void,
  ): Promise<string> {
    const res = await this.call('anneal.state.subscribe', { keys });
    const subId = res.subscriptionId;
    this.subscriptionCallbacks.set(subId, callback);
    return subId;
  }

  async unsubscribe(subscriptionId: string): Promise<boolean> {
    const success = await this.call('anneal.state.unsubscribe', {
      subscriptionId,
    });
    if (success) {
      this.subscriptionCallbacks.delete(subscriptionId);
    }
    return success;
  }

  async getSpectrum(): Promise<{ spectrum: number[] }> {
    return this.call('anneal.engine.getSpectrum');
  }

  async getPartials(): Promise<{ partials: { freq: number; amp: number }[] }> {
    return this.call('anneal.engine.getPartials');
  }

  async startSession(): Promise<boolean> {
    return this.call('anneal.session.start');
  }

  async stopSession(): Promise<boolean> {
    return this.call('anneal.session.stop');
  }

  async getSessionStatus(): Promise<{
    status: string;
    elapsedMs: number;
    remainingMs: number;
  }> {
    return this.call('anneal.session.status');
  }

  async loadPatch(patch: any): Promise<boolean> {
    return this.call('anneal.lesson.loadPatch', { patch });
  }

  async loadPiece(piece: any): Promise<boolean> {
    return this.call('anneal.lesson.loadPiece', { piece });
  }

  async highlight(controlKey: string): Promise<boolean> {
    return this.call('anneal.lesson.highlight', { controlKey });
  }

  async constrain(constraints: string[]): Promise<boolean> {
    return this.call('anneal.lesson.constrain', { constraints });
  }

  async releaseConstraints(): Promise<boolean> {
    return this.call('anneal.lesson.releaseConstraints');
  }

  /**
   * v6.2: suspend the embedded engine's audio context so a lesson audio clip can
   * play without the live engine fighting it. Resolves true only when this call
   * actually suspended a running context — pass that back to {@link resumeEngine}
   * so a context the user had already paused is not force-resumed.
   */
  async suspendEngine(): Promise<boolean> {
    return this.call('anneal.lesson.suspendEngine');
  }

  /** Resume an engine audio context this client previously suspended. */
  async resumeEngine(): Promise<boolean> {
    return this.call('anneal.lesson.resumeEngine');
  }

  close(): void {
    this.transport.close();
  }
}
