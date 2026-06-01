import type { MidiDevice, MidiInputEvent, PermissionState } from './types';

class MidiApi {
  private access: MIDIAccess | null = null;
  private permission: PermissionState = 'prompt';
  private onStateChangeCallbacks: Set<(devices: MidiDevice[]) => void> =
    new Set();
  private onInputCallbacks: Set<
    (event: MidiInputEvent, deviceId: string) => void
  > = new Set();

  constructor() {
    if (!this.isSupported()) {
      this.permission = 'unsupported';
    }
  }

  isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.requestMIDIAccess === 'function'
    );
  }

  getPermissionState(): PermissionState {
    return this.permission;
  }

  async requestAccess(): Promise<MIDIAccess | null> {
    if (!this.isSupported()) {
      this.permission = 'unsupported';
      return null;
    }

    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.permission = 'granted';

      // Wire up hot-plug updates
      this.access.onstatechange = () => {
        this.handleStateChange();
      };

      // Clear existing listeners before applying new ones
      this.clearListeners();

      // Listen to all currently available input ports
      this.scanInputs();

      return this.access;
    } catch (err) {
      console.error('[MIDI API] Access request failed', err);
      this.permission = 'denied';
      return null;
    }
  }

  getDevices(): MidiDevice[] {
    if (!this.access) return [];

    const list: MidiDevice[] = [];

    this.access.inputs.forEach((input) => {
      list.push({
        id: input.id,
        name: input.name || 'Unknown Input',
        manufacturer: input.manufacturer || 'Generic',
        type: 'input',
        state: input.state as 'connected' | 'disconnected',
      });
    });

    this.access.outputs.forEach((output) => {
      list.push({
        id: output.id,
        name: output.name || 'Unknown Output',
        manufacturer: output.manufacturer || 'Generic',
        type: 'output',
        state: output.state as 'connected' | 'disconnected',
      });
    });

    return list;
  }

  subscribeStateChange(callback: (devices: MidiDevice[]) => void): () => void {
    this.onStateChangeCallbacks.add(callback);
    return () => {
      this.onStateChangeCallbacks.delete(callback);
    };
  }

  subscribeInput(
    callback: (event: MidiInputEvent, deviceId: string) => void,
  ): () => void {
    this.onInputCallbacks.add(callback);
    // Wire up listeners to any active ports if access is already granted
    this.scanInputs();
    return () => {
      this.onInputCallbacks.delete(callback);
    };
  }

  getOutputs(): MIDIOutput[] {
    if (!this.access) return [];
    return Array.from(this.access.outputs.values());
  }

  clearListeners(): void {
    if (!this.access) return;
    this.access.inputs.forEach((input) => {
      input.onmidimessage = null;
    });
  }

  private handleStateChange() {
    const devices = this.getDevices();
    this.scanInputs(); // re-scan to ensure new inputs have message listeners attached
    this.onStateChangeCallbacks.forEach((cb) => cb(devices));
  }

  private scanInputs() {
    if (!this.access) return;
    this.access.inputs.forEach((input) => {
      // Clear existing message listeners before applying new ones
      input.onmidimessage = null;
      input.onmidimessage = (e) => this.handleMidiMessage(e, input.id);
    });
  }

  private handleMidiMessage(event: MIDIMessageEvent, deviceId: string) {
    if (!event.data || event.data.length < 3) return;

    const status = event.data[0]!;
    const byte1 = event.data[1]!;
    const byte2 = event.data[2]!;

    const typeByte = status & 0xf0;
    const channel = (status & 0x0f) + 1; // 1-indexed channel (1..16)

    let parsedEvent: MidiInputEvent | null = null;

    if (typeByte === 0x90) {
      // Note On
      const note = byte1;
      const velocity = byte2;

      if (velocity === 0) {
        // Velocity 0 is convention for Note Off
        parsedEvent = {
          type: 'note-off',
          channel,
          number: note,
          value: 0,
        };
      } else {
        parsedEvent = {
          type: 'note-on',
          channel,
          number: note,
          value: velocity,
        };
      }
    } else if (typeByte === 0x80) {
      // Note Off
      const note = byte1;
      const velocity = byte2;
      parsedEvent = {
        type: 'note-off',
        channel,
        number: note,
        value: velocity,
      };
    } else if (typeByte === 0xb0) {
      // Control Change (CC)
      const ccNumber = byte1;
      const ccValue = byte2;
      parsedEvent = {
        type: 'cc',
        channel,
        number: ccNumber,
        value: ccValue,
      };
    } else if (typeByte === 0xe0) {
      // Pitch Bend
      const pitchBendValue = (byte2 << 7) | byte1;
      const normalizedBend = (pitchBendValue - 8192) / 8192;
      parsedEvent = {
        type: 'pitchbend',
        channel,
        number: 0,
        value: normalizedBend,
      };
    }

    if (parsedEvent) {
      this.onInputCallbacks.forEach((cb) => cb(parsedEvent!, deviceId));
    }
  }
}

export const midiApi = new MidiApi();
