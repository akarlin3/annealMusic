import type { SourceDef } from '../types';

export class LiveSourceAdapter {
  def: SourceDef;
  private ws: WebSocket | null = null;
  private eventSource: EventSource | null = null;
  private latestValues: Record<string, number> = {};
  isConnected = false;

  constructor(def: SourceDef) {
    this.def = def;
  }

  connect() {
    if (this.isConnected) return;
    const url = this.def.url;
    if (!url) return;

    if (url.startsWith('ws://') || url.startsWith('wss://')) {
      this.connectWebSocket(url);
    } else if (url.startsWith('http://') || url.startsWith('https://')) {
      this.connectSSE(url);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
  }

  private connectWebSocket(url: string) {
    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this.isConnected = true;
        console.log(`Live WebSocket connected to ${url}`);
      };
      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as Record<string, unknown>;
          this.handlePayload(parsed);
        } catch {
          // Fallback if not JSON
          console.warn('WS received non-JSON payload', event.data);
        }
      };
      this.ws.onclose = () => {
        this.isConnected = false;
        console.log('Live WebSocket disconnected');
      };
      this.ws.onerror = (e) => {
        console.error('WS Error:', e);
      };
    } catch (e) {
      console.error('WS Connect error:', e);
    }
  }

  private connectSSE(url: string) {
    try {
      this.eventSource = new EventSource(url);
      this.eventSource.onopen = () => {
        this.isConnected = true;
        console.log(`Live SSE connected to ${url}`);
      };
      this.eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as Record<string, unknown>;
          this.handlePayload(parsed);
        } catch {
          console.warn('SSE received non-JSON payload', event.data);
        }
      };
      this.eventSource.onerror = (e) => {
        console.error('SSE Error:', e);
        this.isConnected = false;
      };
    } catch (e) {
      console.error('SSE Connect error:', e);
    }
  }

  private handlePayload(payload: Record<string, unknown>) {
    if (typeof payload === 'object' && payload !== null) {
      for (const [key, val] of Object.entries(payload)) {
        const num = Number(val);
        if (!isNaN(num)) {
          this.latestValues[key] = num;
          if (!this.def.columns.includes(key)) {
            this.def.columns = [...this.def.columns, key];
          }
        }
      }
    }
  }

  getValueAt(column: string, t: number): number {
    if (t < 0) return 0;
    const latestVal = this.latestValues[column];
    return latestVal !== undefined ? latestVal : 0;
  }
}
