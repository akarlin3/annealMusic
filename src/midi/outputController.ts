import { midiApi } from './api';
import { midiStorage } from './storage';
import {
  useParamStore,
  type ParamKey,
  CONTROL_DEFS,
  VOLUME_DEF,
} from '@/state/params';
import type { CurveType } from './types';

// Reverse-interpolate parameter values back to 7-bit MIDI CC values
export function valueToMidiCC(
  value: number,
  min: number,
  max: number,
  curve: CurveType,
): number {
  const clamped = Math.max(min, Math.min(max, value));
  let norm = 0;

  if (curve === 'exponential') {
    const safeMin = min <= 0 ? 0.001 : min;
    const safeMax = max <= 0 ? 0.001 : max;
    const safeClamped = clamped <= 0 ? 0.001 : clamped;
    norm = Math.log(safeClamped / safeMin) / Math.log(safeMax / safeMin);
  } else if (curve === 'logarithmic') {
    norm = (Math.pow(10, (clamped - min) / (max - min)) - 1) / 9;
  } else {
    // Linear
    norm = (clamped - min) / (max - min);
  }

  return Math.max(0, Math.min(127, Math.round(norm * 127)));
}

// CC Mapping Table per CP0 spec
export const OUTPUT_CC_MAP: Record<ParamKey, number> = {
  rootFreq: 74, // Brightness / Cutoff
  spread: 75, // Sound Control 6
  density: 76, // Sound Control 7
  coupling: 77, // Sound Control 8
  drift: 78, // Sound Control 9
  brightness: 71, // Filter Resonance
  space: 72, // Release Time / Space
  volume: 7, // GM Main Volume
};

class MidiOutputController {
  private activePort: MIDIOutput | null = null;
  private ccCache: Record<number, number> = {};
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private isClockRunning = false;
  private unsubscribeStore: (() => void) | null = null;

  start(): void {
    const config = midiStorage.loadGlobalConfig();
    this.selectOutputDevice(config.outputDeviceId);

    // 1. Throttle CC changes using a 60Hz interval cache flush (16.6ms)
    if (!this.flushTimer) {
      this.flushTimer = setInterval(() => this.flushCCCache(), 16.6);
    }

    // 2. Listen to param store updates to queue outgoing CC events
    if (!this.unsubscribeStore) {
      this.unsubscribeStore = useParamStore.subscribe((state, prevState) => {
        const outConfig = midiStorage.loadGlobalConfig();
        if (!outConfig.ccOutputEnabled) return;

        // Compare parameters
        for (const paramKey of Object.keys(OUTPUT_CC_MAP)) {
          const key = paramKey as ParamKey;
          const val = state.params[key];
          if (val !== prevState.params[key]) {
            this.queueCC(key, val);
          }
        }
      });
    }

    // 3. Auto-start clock if configuration says so and session is playing
    this.syncClockState();
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }
    this.stopClock();
    this.activePort = null;
  }

  selectOutputDevice(deviceId: string): void {
    const outputs = midiApi.getOutputs();
    const port = outputs.find((o) => o.id === deviceId);
    this.activePort = port || null;
  }

  /** Queue a parameter update to be sent out as CC */
  private queueCC(key: ParamKey, value: number) {
    const def = [...CONTROL_DEFS, VOLUME_DEF].find((d) => d.key === key);
    if (!def) return;

    const curve: CurveType = key === 'rootFreq' ? 'exponential' : 'linear';
    const ccVal = valueToMidiCC(value, def.min, def.max, curve);
    const ccNum = OUTPUT_CC_MAP[key];

    this.ccCache[ccNum] = ccVal;
  }

  /** Flushes the cached CC map out to the output port */
  private flushCCCache() {
    if (!this.activePort || Object.keys(this.ccCache).length === 0) return;

    const config = midiStorage.loadGlobalConfig();
    const statusByte = 0xb0 | (config.outputChannel - 1); // CC status byte

    for (const [ccStr, val] of Object.entries(this.ccCache)) {
      const ccNum = parseInt(ccStr, 10);
      const msg = new Uint8Array([statusByte, ccNum, val]);
      try {
        this.activePort.send(msg);
      } catch (err) {
        console.error('[MIDI Output] Send failed', err);
      }
    }

    // Clear cache
    this.ccCache = {};
  }

  // --- Clock Sync Methods ---

  syncClockState(): void {
    const config = midiStorage.loadGlobalConfig();
    if (config.clockEnabled && this.isClockRunning) {
      this.restartClock(config.clockBpm);
    } else if (config.clockEnabled && !this.isClockRunning) {
      // Don't auto-tick if synth is not running (aligned to session play state)
    } else {
      this.stopClock();
    }
  }

  triggerStart(): void {
    const config = midiStorage.loadGlobalConfig();
    if (!config.clockEnabled || !this.activePort) return;

    try {
      this.activePort.send(new Uint8Array([0xfa])); // MIDI Start
      this.isClockRunning = true;
      this.restartClock(config.clockBpm);
    } catch (e) {
      console.error('[MIDI Clock] Failed to send START', e);
    }
  }

  triggerStop(): void {
    this.stopClock();
    if (!this.activePort) return;

    try {
      this.activePort.send(new Uint8Array([0xfc])); // MIDI Stop
    } catch (e) {
      console.error('[MIDI Clock] Failed to send STOP', e);
    }
  }

  private restartClock(bpm: number) {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }

    const intervalMs = 60000 / (bpm * 24); // 24 PPQN ticks

    this.clockTimer = setInterval(() => {
      if (this.activePort) {
        try {
          this.activePort.send(new Uint8Array([0xf8])); // MIDI Clock Pulse
        } catch (e) {
          console.error('[MIDI Clock] Pulse send failed', e);
        }
      }
    }, intervalMs);
  }

  private stopClock() {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
    this.isClockRunning = false;
  }
}

export const midiOutput = new MidiOutputController();
