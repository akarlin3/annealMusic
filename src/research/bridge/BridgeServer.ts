/* eslint-disable @typescript-eslint/no-explicit-any */
import { BroadcastTransport } from './transport/broadcast';
import { PostMessageTransport } from './transport/postmessage';
import { useParamStore } from '../../state/params';
import { METHOD_SCHEMAS, BRIDGE_VERSION, SCHEMA_VERSION } from './schema';
import type { Orchestrator } from '../../audio/orchestrator';
import { DataLogger } from '@/datalog/DataLogger';
import { BridgeError, type Transport } from './types';
import { renderOffline } from '@/record/OfflineRenderer';
import { encodeWavBuffer } from '@/api/wav';
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
} from './types';

let orchestratorGetter: (() => Orchestrator) | null = null;
let activeServer: BridgeServer | null = null;

interface Subscription {
  id: string;
  keys: string[];
}

export class BridgeServer {
  private transports: Transport[] = [];
  private subscriptions: Map<string, Subscription> = new Map();
  private storeUnsubscribe: (() => void) | null = null;
  private datalogSubscriptions: Map<string, () => void> = new Map();

  static registerOrchestrator(getter: () => Orchestrator): void {
    orchestratorGetter = getter;
  }

  static getOrchestrator(): Orchestrator | null {
    return orchestratorGetter ? orchestratorGetter() : null;
  }

  static start(): BridgeServer {
    if (!activeServer) {
      activeServer = new BridgeServer();
    }
    return activeServer;
  }

  static stop(): void {
    if (activeServer) {
      activeServer.close();
      activeServer = null;
    }
  }

  constructor() {
    this.transports.push(new BroadcastTransport());
    if (typeof window !== 'undefined') {
      this.transports.push(new PostMessageTransport());
    }
    for (const t of this.transports) {
      t.onMessage((msg) => this.handleMessage(msg, t));
    }
    this.setupStoreSubscription();
  }

  private setupStoreSubscription(): void {
    let lastState = useParamStore.getState();
    this.storeUnsubscribe = useParamStore.subscribe((state) => {
      // Compare states and notify active subscriptions
      for (const [subId, sub] of this.subscriptions.entries()) {
        for (const key of sub.keys) {
          const val = (state as any)[key];
          const lastVal = (lastState as any)[key];
          if (JSON.stringify(val) !== JSON.stringify(lastVal)) {
            // Trigger push notification
            const notification: JsonRpcNotification = {
              jsonrpc: '2.0',
              method: 'anneal.state.onChange',
              params: {
                subscriptionId: subId,
                key,
                value: val,
              },
            };
            for (const t of this.transports) {
              t.send(notification);
            }
          }
        }
      }
      lastState = state;
    });
  }

  private async handleMessage(msg: any, transport: Transport): Promise<void> {
    // We only process requests that have a method and an id
    if (!msg || typeof msg.method !== 'string' || msg.id === undefined) {
      return;
    }

    const req = msg as JsonRpcRequest;
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: req.id,
    };

    try {
      const schema = METHOD_SCHEMAS[req.method];
      if (!schema) {
        throw new BridgeError(-32601, `Method not found: ${req.method}`);
      }

      if (schema.validate) {
        schema.validate(req.params);
      }

      const result = await this.dispatchMethod(req.method, req.params);
      response.result = result;
    } catch (err) {
      console.error('[BridgeServer] Error in handleMessage:', err);
      if (err instanceof BridgeError) {
        response.error = err.toJsonRpcError();
      } else {
        response.error = {
          code: -32603,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }

    transport.send(response);
  }

  private async dispatchMethod(method: string, params: any): Promise<any> {
    const store = useParamStore.getState();
    const orch = BridgeServer.getOrchestrator();

    switch (method) {
      case 'anneal.state.get':
        return {
          params: store.params,
          engineId: store.engineId,
          engineParams: store.engineParams,
          tuning: store.tuning,
          mode: store.mode,
        };

      case 'anneal.state.subscribe': {
        const subId = Math.random().toString(36).substring(2, 15);
        this.subscriptions.set(subId, {
          id: subId,
          keys: params.keys,
        });
        return { subscriptionId: subId };
      }

      case 'anneal.state.unsubscribe': {
        const deleted = this.subscriptions.delete(params.subscriptionId);
        if (!deleted) {
          throw new BridgeError(
            -32602,
            `Subscription ID not found: ${params.subscriptionId}`,
          );
        }
        return true;
      }

      case 'anneal.engine.getSpectrum': {
        if (!orch) {
          throw new BridgeError(-32002, 'Engine Not Initialized');
        }
        const analyser = orch.getAnalyser();
        if (!analyser) {
          return { spectrum: [] };
        }
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        return { spectrum: Array.from(dataArray) };
      }

      case 'anneal.engine.getPartials': {
        if (!orch) {
          throw new BridgeError(-32002, 'Engine Not Initialized');
        }
        const freqs = orch.getPartialFrequencies();
        const partials = freqs.map((freq, i) => ({
          freq,
          amp: 0.32 / (i + 1), // Rolloff baseline
        }));
        return { partials };
      }

      case 'anneal.state.set': {
        useParamStore.getState().setMany(params.params);
        return true;
      }

      case 'anneal.state.setEngineParam': {
        useParamStore
          .getState()
          .setEngineParam(params.engineId, params.key, params.value);
        return true;
      }

      case 'anneal.state.setEngine': {
        useParamStore.getState().setEngine(params.engineId);
        return true;
      }

      case 'anneal.state.setTuning': {
        useParamStore.getState().setTuning(params.tuning);
        return true;
      }

      case 'anneal.session.render': {
        const duration = params?.duration ?? 30;
        const format = params?.format ?? 'numpy';
        const store = useParamStore.getState();
        const activeEngineParams = store.engineParams[store.engineId];
        if (!activeEngineParams) {
          throw new BridgeError(
            -32602,
            `Missing engine parameters for active engine ${store.engineId}`,
          );
        }
        const config = {
          params: store.params,
          engineId: store.engineId,
          engineParams: activeEngineParams,
          mode: 'open' as const,
          durationSec: duration,
          sampleRate: 44100,
        };
        const buffer = await renderOffline(config);
        if (format === 'numpy') {
          const left = buffer.getChannelData(0);
          const right =
            buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
          return {
            sampleRate: buffer.sampleRate,
            channels: [Array.from(left), Array.from(right)],
          };
        } else if (format === 'wav') {
          const wavArrBuf = encodeWavBuffer(buffer);
          return {
            bytes: Array.from(new Uint8Array(wavArrBuf)),
          };
        }
        throw new BridgeError(-32602, `Unsupported render format: ${format}`);
      }

      case 'anneal.session.start': {
        if (!orch) {
          throw new BridgeError(-32002, 'Engine Not Initialized');
        }
        const state = useParamStore.getState();
        if (state.sessionMode === 'arc') {
          orch.startSession(
            {
              mode: 'arc',
              arcId: state.arcId,
              durationSec: state.arcDurationSec,
            },
            (p) => useParamStore.getState().setMany(p),
          );
        } else {
          orch.startSession({ mode: 'open' });
        }
        return true;
      }

      case 'anneal.session.stop': {
        if (!orch) {
          throw new BridgeError(-32002, 'Engine Not Initialized');
        }
        await orch.stop();
        return true;
      }

      case 'anneal.session.status': {
        if (!orch) {
          return {
            status: 'idle',
            elapsedMs: 0,
            remainingMs: 0,
          };
        }
        const status = orch.getSessionState();
        const progress = orch.getArcProgress();
        const durationMs =
          (useParamStore.getState().arcDurationSec || 0) * 1000;
        const remainingMs = progress
          ? progress.remainingSec * 1000
          : durationMs;
        const elapsedMs = Math.max(0, durationMs - remainingMs);
        return {
          status,
          elapsedMs,
          remainingMs,
        };
      }

      case 'anneal.lesson.loadPatch':
      case 'anneal.session.loadPatch': {
        const patch = params.patch;
        const s = useParamStore.getState();
        s.setMany(patch.params);
        s.setEngine(patch.engineId);
        if (patch.engineParams) {
          Object.entries(patch.engineParams).forEach(([k, v]) => {
            s.setEngineParam(patch.engineId, k, v as any);
          });
        }
        if (patch.tuning) {
          s.setTuning(patch.tuning);
        }
        return true;
      }

      case 'anneal.lesson.loadPiece':
      case 'anneal.session.loadPiece': {
        // Mock loading piece
        return true;
      }

      case 'anneal.lesson.highlight': {
        if (typeof window !== 'undefined') {
          const ev =
            typeof CustomEvent !== 'undefined'
              ? new CustomEvent('anneal-highlight', {
                  detail: { controlKey: params.controlKey },
                })
              : {
                  type: 'anneal-highlight',
                  detail: { controlKey: params.controlKey },
                };
          window.dispatchEvent(ev as any);
        }
        return true;
      }

      case 'anneal.lesson.constrain': {
        useParamStore.getState().setConstraints(params.constraints);
        return true;
      }

      case 'anneal.lesson.releaseConstraints': {
        useParamStore.getState().setConstraints(null);
        return true;
      }

      // v6.2: pause/resume the live engine's audio context while a lesson audio
      // clip plays in the parent frame, so the two don't fight. Returns whether
      // this call changed the context state (resume only restores a context this
      // bridge suspended). No-op (returns false) when the engine isn't running.
      case 'anneal.lesson.suspendEngine': {
        return orch ? await orch.suspendAudio() : false;
      }

      case 'anneal.lesson.resumeEngine': {
        return orch ? await orch.resumeAudio() : false;
      }

      case 'anneal.version':
        return {
          app: '5.0.0',
          bridge: BRIDGE_VERSION,
          schema: SCHEMA_VERSION,
        };

      case 'anneal.health':
        return {
          status: 'ok',
          timestamp: new Date().toISOString(),
        };

      case 'anneal.datalog.start': {
        const logger = DataLogger.getInstance();
        if (orch) {
          logger.setOrchestrator(orch);
        }
        logger.start(params?.mode ?? 'standard', params?.rateHz ?? 50);
        return true;
      }

      case 'anneal.datalog.stop': {
        const logger = DataLogger.getInstance();
        logger.stop();
        return true;
      }

      case 'anneal.datalog.snapshot': {
        const logger = DataLogger.getInstance();
        return { records: logger.snapshot(params?.limit) };
      }

      case 'anneal.datalog.stream': {
        const subId = Math.random().toString(36).substring(2, 15);
        const logger = DataLogger.getInstance();
        const unsub = logger.subscribeTick((tick) => {
          const notification: JsonRpcNotification = {
            jsonrpc: '2.0',
            method: 'anneal.datalog.onTick',
            params: {
              subscriptionId: subId,
              tick,
            },
          };
          for (const t of this.transports) {
            t.send(notification);
          }
        });
        this.datalogSubscriptions.set(subId, unsub);
        return { subscriptionId: subId };
      }

      default:
        throw new BridgeError(-32601, `Method not found: ${method}`);
    }
  }

  close(): void {
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }
    for (const unsub of this.datalogSubscriptions.values()) {
      unsub();
    }
    this.datalogSubscriptions.clear();
    for (const t of this.transports) {
      t.close();
    }
  }
}
