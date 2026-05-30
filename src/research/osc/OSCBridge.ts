/* eslint-disable @typescript-eslint/no-explicit-any */
import { BridgeClient } from '../bridge/BridgeClient';
import { OSCNamespace, type OscMessage } from './OSCNamespace';
import { OSCFilter } from './OSCFilter';
import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

export interface OSCBridgePlugin {
  start(options: {
    port: number;
    sendHost: string;
    sendPort: number;
  }): Promise<void>;
  stop(): Promise<void>;
  send(message: { address: string; args: any[] }): Promise<void>;
}

const OSCBridgePluginNative =
  registerPlugin<OSCBridgePlugin>('OSCBridgePlugin');

export interface OscLogEntry {
  id: string;
  timestamp: string;
  direction: 'in' | 'out';
  address: string;
  args: any[];
}

export class OSCBridge {
  private socket: WebSocket | null = null;
  private client: BridgeClient;
  private status: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private logHistory: OscLogEntry[] = [];

  public filter: OSCFilter;

  private onStatusChangeCallbacks: Set<
    (status: 'disconnected' | 'connecting' | 'connected') => void
  > = new Set();
  private onLogCallbacks: Set<(log: OscLogEntry) => void> = new Set();

  private paramSubId: string | null = null;
  private pollingIntervalId: any = null;

  constructor(client: BridgeClient) {
    this.client = client;
    this.filter = new OSCFilter();
  }

  onStatusChange(
    cb: (status: 'disconnected' | 'connecting' | 'connected') => void,
  ): () => void {
    this.onStatusChangeCallbacks.add(cb);
    cb(this.status);
    return () => this.onStatusChangeCallbacks.delete(cb);
  }

  onLog(cb: (log: OscLogEntry) => void): () => void {
    this.onLogCallbacks.add(cb);
    return () => this.onLogCallbacks.delete(cb);
  }

  getStatus() {
    return this.status;
  }

  getLogs(): OscLogEntry[] {
    return this.logHistory;
  }

  clearLogs(): void {
    this.logHistory = [];
  }

  private setStatus(newStatus: 'disconnected' | 'connecting' | 'connected') {
    this.status = newStatus;
    this.onStatusChangeCallbacks.forEach((cb) => cb(newStatus));
  }

  private addLog(direction: 'in' | 'out', address: string, args: any[]) {
    const entry: OscLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      direction,
      address,
      args,
    };
    this.logHistory = [entry, ...this.logHistory.slice(0, 49)];
    this.onLogCallbacks.forEach((cb) => cb(entry));
  }

  /**
   * Connect to WebSocket server or start native mobile UDP sockets
   */
  async connect(options?: {
    wsPort?: number;
    udpInPort?: number;
    udpOutPort?: number;
    udpHost?: string;
  }) {
    if (this.status !== 'disconnected') return;
    this.setStatus('connecting');

    const wsPort = options?.wsPort ?? 8766;
    const udpInPort = options?.udpInPort ?? 8765;
    const udpOutPort = options?.udpOutPort ?? 9000;
    const udpHost = options?.udpHost ?? '127.0.0.1';

    if (Capacitor.isNativePlatform()) {
      try {
        await OSCBridgePluginNative.start({
          port: udpInPort,
          sendHost: udpHost,
          sendPort: udpOutPort,
        });

        // Add native listener for incoming UDP OSC messages
        (OSCBridgePluginNative as any).addListener('oscMessage', (msg: any) => {
          this.handleIncomingMessage({
            address: msg.address,
            args: msg.args ?? [],
          });
        });

        this.setStatus('connected');
        this.setupSubscriptionsAndPolling();
      } catch (err) {
        console.error('Failed to start native mobile OSC plugin', err);
        this.setStatus('disconnected');
      }
    } else {
      // Browser environment: Connect via loopback WebSocket Bridge helper
      try {
        this.socket = new WebSocket(`ws://localhost:${wsPort}`);

        this.socket.onopen = () => {
          this.setStatus('connected');
          this.setupSubscriptionsAndPolling();
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.address && Array.isArray(data.args)) {
              this.handleIncomingMessage(data);
            }
          } catch (e) {
            console.error(
              'Failed to parse incoming WebSocket bridge message',
              e,
            );
          }
        };

        this.socket.onerror = () => {
          this.setStatus('disconnected');
        };

        this.socket.onclose = () => {
          this.setStatus('disconnected');
          this.teardownSubscriptionsAndPolling();
        };
      } catch (err) {
        console.error('Failed to connect to loopback WebSocket helper', err);
        this.setStatus('disconnected');
      }
    }
  }

  /**
   * Stop WebSocket connection or release native sockets
   */
  async disconnect() {
    this.teardownSubscriptionsAndPolling();

    if (Capacitor.isNativePlatform()) {
      try {
        await OSCBridgePluginNative.stop();
        (OSCBridgePluginNative as any).removeAllListeners();
      } catch (err) {
        console.error('Failed to stop native mobile OSC plugin', err);
      }
    } else {
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }
    }
    this.setStatus('disconnected');
  }

  /**
   * Send an OSC message outwards to external endpoints
   */
  async send(address: string, args: any[]) {
    if (this.status !== 'connected') return;

    if (!this.filter.shouldPass(address)) {
      return;
    }

    this.addLog('out', address, args);

    if (Capacitor.isNativePlatform()) {
      try {
        await OSCBridgePluginNative.send({ address, args });
      } catch (err) {
        console.error('Failed to send native mobile OSC message', err);
      }
    } else {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const frame = JSON.stringify({ address, args });
        this.socket.send(frame);
      }
    }
  }

  /**
   * Handles an incoming OSC message and triggers JSON-RPC mutations via BridgeClient
   */
  private handleIncomingMessage(msg: OscMessage) {
    this.addLog('in', msg.address, msg.args);

    const control = OSCNamespace.oscToControl(msg);
    switch (control.type) {
      case 'param':
        if (control.key && control.value !== undefined) {
          this.client
            .setState({ [control.key]: control.value })
            .catch(() => {});
        }
        break;
      case 'engine':
        if (control.value) {
          this.client.setEngine(control.value).catch(() => {});
        }
        break;
      case 'engineParam':
        if (control.engineId && control.key && control.value !== undefined) {
          // Mutate the specific engine parameter
          // Using our custom additive method on BridgeClient
          (this.client as any)
            .setEngineParam(control.engineId, control.key, control.value)
            .catch(() => {});
        }
        break;
      case 'session':
        if (control.action === 'start') {
          this.client.startSession().catch(() => {});
        } else if (control.action === 'stop') {
          this.client.stopSession().catch(() => {});
        }
        break;
      default:
        // Ignore unrecognized addresses
        break;
    }
  }

  /**
   * Set up state subscriptions and pollers for high-frequency data
   */
  private async setupSubscriptionsAndPolling() {
    this.filter.clearTimers();

    // 1. Subscribe to core state changes
    try {
      this.paramSubId = await this.client.subscribe(
        ['params', 'engineId', 'tuning', 'mode', 'engineParams'],
        (update) => {
          const oscMessages = OSCNamespace.stateToOsc(update.key, update.value);
          oscMessages.forEach((msg) => {
            this.send(msg.address, msg.args);
          });
        },
      );
    } catch (err) {
      console.error(
        'Failed to subscribe to state changes via BridgeClient',
        err,
      );
    }

    // 2. Setup high-frequency polling for spectrum, partials, and elapsed time
    this.pollingIntervalId = setInterval(async () => {
      if (this.status !== 'connected') return;

      // Fetch elapsed session time
      if (
        this.filter.shouldPass('/anneal/session/elapsed') ||
        this.filter.shouldPass('/anneal/session/state')
      ) {
        this.client
          .getSessionStatus()
          .then((status) => {
            this.send('/anneal/session/state', [status.status]);
            this.send('/anneal/session/elapsed', [status.elapsedMs / 1000]);
          })
          .catch(() => {});
      }

      // Fetch active spectrum FFT
      if (this.filter.shouldPass('/anneal/spectrum')) {
        this.client
          .getSpectrum()
          .then((res) => {
            // Format as an array/blob list
            this.send('/anneal/spectrum', res.spectrum);
          })
          .catch(() => {});
      }

      // Fetch phase-coupled partial frequencies and amplitudes
      if (this.filter.shouldPass('/anneal/partials')) {
        this.client
          .getPartials()
          .then((res) => {
            // Interleave as [freq1, amp1, freq2, amp2...]
            const args: number[] = [];
            res.partials.forEach((p) => {
              args.push(p.freq, p.amp);
            });
            this.send('/anneal/partials', args);
          })
          .catch(() => {});
      }
    }, 33); // poll at ~30Hz
  }

  private teardownSubscriptionsAndPolling() {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    if (this.paramSubId) {
      this.client.unsubscribe(this.paramSubId).catch(() => {});
      this.paramSubId = null;
    }
  }
}
