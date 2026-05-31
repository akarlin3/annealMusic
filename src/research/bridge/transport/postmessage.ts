import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  Transport,
} from '../types';

export class PostMessageTransport implements Transport {
  private onMessageCallback: (
    message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification,
  ) => void;
  private targetWindow: Window | null = null;

  constructor(targetWindow?: Window | null) {
    this.onMessageCallback = () => {};

    if (targetWindow) {
      this.targetWindow = targetWindow;
    } else if (typeof window !== 'undefined' && window.self !== window.top) {
      // We are inside the iframe, communicate with parent
      this.targetWindow = window.parent;
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.handleMessage);
    }
  }

  private handleMessage = (event: MessageEvent) => {
    // Only accept same-origin messages for security
    if (event.origin !== window.location.origin) return;

    const data = event.data;
    // Check if it looks like a valid JSON-RPC message
    if (data && typeof data === 'object' && 'jsonrpc' in data) {
      this.onMessageCallback(data);
    }
  };

  send(message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification): void {
    if (this.targetWindow) {
      this.targetWindow.postMessage(message, window.location.origin);
    } else {
      // If we are in the parent, but don't have a specific targetWindow yet,
      // broadcast to top/any nested same-origin frames as a fallback.
      // However, usually the parent client passes the iframe.contentWindow directly.
      console.warn('[PostMessageTransport] No target window set for send.');
    }
  }

  setTargetWindow(targetWindow: Window): void {
    this.targetWindow = targetWindow;
  }

  onMessage(
    callback: (
      message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification,
    ) => void,
  ): void {
    this.onMessageCallback = callback;
  }

  close(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', this.handleMessage);
    }
  }
}
