import type { ParamKey } from '@/state/params';

export type CurveType = 'linear' | 'exponential' | 'logarithmic';

export interface MidiMapping {
  paramKey: ParamKey | string;
  isEngineParam: boolean;
  min: number;
  max: number;
  curve: CurveType;
}

export interface MappingSet {
  controllerId: string;
  channel: number; // 0 = Omni, 1..16 = specific channel
  mappings: Record<number, MidiMapping>; // key is CC number (0..127)
}

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  type: 'input' | 'output';
  state: 'connected' | 'disconnected';
}

export interface MidiInputEvent {
  type: 'cc' | 'note-on' | 'note-off' | 'pitchbend';
  channel: number; // 1..16
  number: number; // CC number or Note number (0..127)
  value: number; // CC value (0..127) or Note velocity (0..127) or normalized bend (-1..1)
}
