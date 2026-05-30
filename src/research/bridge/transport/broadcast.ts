import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
} from '../types';

export class BroadcastTransport {
  private channel: BroadcastChannel;
  private onMessageCallback: (
    message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification,
  ) => void;

  constructor(channelName: string = 'anneal_music_bridge') {
    this.channel = new BroadcastChannel(channelName);
    this.onMessageCallback = () => {};
    this.channel.onmessage = (event) => {
      this.onMessageCallback(event.data);
    };
  }

  send(message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification): void {
    this.channel.postMessage(message);
  }

  onMessage(
    callback: (
      message: JsonRpcRequest | JsonRpcResponse | JsonRpcNotification,
    ) => void,
  ): void {
    this.onMessageCallback = callback;
  }

  close(): void {
    this.channel.close();
  }
}
