import { useBiofeedbackStore } from '@/biofeedback/store';
import type { SourceDef } from '../types';

export class BiosignalSourceAdapter {
  def: SourceDef;

  constructor(def: SourceDef) {
    this.def = def;
  }

  getValueAt(column: string, _t: number): number {
    // For live biosignals, elapsed time t is ignored and we read the latest real-time frame
    const deviceId = this.def.deviceId || 'polar-h10';
    const dev = useBiofeedbackStore.getState().connectedDevices[deviceId];

    if (dev && dev.latestFrame) {
      const channel = dev.latestFrame.channels[column];
      return channel ? channel.value : 0;
    }
    return 0;
  }
}
