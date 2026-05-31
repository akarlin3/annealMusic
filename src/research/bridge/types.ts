/* eslint-disable @typescript-eslint/no-explicit-any */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id: string | number | null;
}

export interface Transport {
  send(message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification): void;
  onMessage(
    callback: (
      message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification,
    ) => void,
  ): void;
  close(): void;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: JsonRpcError;
  id: string | number | null;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

export class BridgeError extends Error {
  code: number;
  data?: any;

  constructor(code: number, message: string, data?: any) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
    this.data = data;
  }

  toJsonRpcError(): JsonRpcError {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }
}
