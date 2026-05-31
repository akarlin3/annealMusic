import { useBiofeedbackStore } from './store';
import { Subscription } from './types';

export class StreamCapture {
  private deviceId: string;
  private channelName: string;
  private frames: { timestamp: number; value: number }[] = [];
  private subscription: Subscription | null = null;
  private startTime = 0;

  constructor(deviceId: string, channelName: string) {
    this.deviceId = deviceId;
    this.channelName = channelName;
  }

  start() {
    this.frames = [];
    this.startTime = Date.now();

    const store = useBiofeedbackStore.getState();
    const dev = store.connectedDevices[this.deviceId];
    if (!dev) {
      console.warn(
        `Cannot start stream capture for device ${this.deviceId}; not connected.`,
      );
      return;
    }

    this.subscription = dev.adapter.stream(dev.connection).subscribe({
      next: (frame) => {
        const ch = frame.channels[this.channelName];
        if (ch) {
          this.frames.push({
            timestamp: Date.now() - this.startTime,
            value: ch.value,
          });
        }
      },
    });
  }

  stop() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  getFrames() {
    return this.frames;
  }
}
