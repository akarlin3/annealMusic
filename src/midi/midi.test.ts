import { describe, expect, it, beforeEach, vi } from 'vitest';
import { interpolateMidiValue } from './inputController';
import { valueToMidiCC, OUTPUT_CC_MAP } from './outputController';
import { getAutoMappingForController } from './knownControllers';
import { midiStorage, type GlobalMidiConfig } from './storage';
import { useParamStore } from '@/state/params';
import { midiInput } from './inputController';
import { midiApi } from './api';
import { BridgeServer } from '@/research/bridge/BridgeServer';
import type { Orchestrator } from '@/audio/orchestrator';
import type { MappingSet } from './types';

describe('MIDI Curve Interpolation', () => {
  it('interpolates linear values correctly', () => {
    // 0 -> min, 127 -> max, 63.5 -> mid
    expect(interpolateMidiValue(0, 10, 110, 'linear')).toBe(10);
    expect(interpolateMidiValue(127, 10, 110, 'linear')).toBe(110);
    expect(interpolateMidiValue(63.5, 10, 110, 'linear')).toBeCloseTo(60, 1);
  });

  it('interpolates exponential values correctly', () => {
    // 0 -> min, 127 -> max, 63.5 -> geometric mean
    expect(interpolateMidiValue(0, 10, 1000, 'exponential')).toBe(10);
    expect(interpolateMidiValue(127, 10, 1000, 'exponential')).toBe(1000);
    expect(interpolateMidiValue(63.5, 10, 1000, 'exponential')).toBeCloseTo(
      100,
      0,
    ); // sqrt(10 * 1000) = 100
  });

  it('interpolates logarithmic values correctly', () => {
    // Logarithmic curve: min + (max-min) * log10(1 + 9 * norm)
    // 0 -> min, 127 -> max
    expect(interpolateMidiValue(0, 10, 110, 'logarithmic')).toBe(10);
    expect(interpolateMidiValue(127, 10, 110, 'logarithmic')).toBe(110);

    // For CC value 12.7 (norm = 0.1): log10(1 + 0.9) = log10(1.9) = 0.27875
    // Result: 10 + 100 * 0.27875 = 37.875
    expect(interpolateMidiValue(12.7, 10, 110, 'logarithmic')).toBeCloseTo(
      37.875,
      2,
    );
  });
});

describe('MIDI Auto-Mapping Selector', () => {
  it('correctly maps known devices by name', () => {
    const pushMap = getAutoMappingForController('Ableton Push 2');
    expect(pushMap.controllerId).toBe('Ableton Push 2');
    expect(pushMap.mappings[71]?.paramKey).toBe('rootFreq');
    expect(pushMap.mappings[79]?.paramKey).toBe('volume');

    const lcxlMap = getAutoMappingForController('Novation Launch Control XL');
    expect(lcxlMap.controllerId).toBe('Novation Launch Control XL');
    expect(lcxlMap.mappings[77]?.paramKey).toBe('rootFreq');
    expect(lcxlMap.mappings[73]?.paramKey).toBe('volume');
  });

  it('correctly falls back to generic mappings on unknown devices', () => {
    const unknownMap = getAutoMappingForController('My Custom Faders Box');
    expect(unknownMap.controllerId).toBe('My Custom Faders Box');
    expect(unknownMap.mappings[16]?.paramKey).toBe('rootFreq');
    expect(unknownMap.mappings[23]?.paramKey).toBe('volume');
  });
});

describe('MIDI Local Storage Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('correctly performs round-trips for global config settings', () => {
    const customConfig: GlobalMidiConfig = {
      channelFilter: 3,
      outputDeviceId: 'midi_out_1',
      outputChannel: 10,
      clockEnabled: true,
      clockBpm: 120,
      clockSyncToPieceTempo: false,
      ccOutputEnabled: true,
      notesEnabled: true,
      notesReleaseBehavior: 'return',
      notesVelocityTarget: ' excitationLevel',
    };

    midiStorage.saveGlobalConfig(customConfig);
    const loaded = midiStorage.loadGlobalConfig();
    expect(loaded).toEqual(customConfig);
  });

  it('correctly performs round-trips for device mappings', () => {
    const deviceSet: MappingSet = {
      controllerId: 'Test Controller',
      channel: 1,
      mappings: {
        22: {
          paramKey: 'brightness',
          isEngineParam: false,
          min: 0,
          max: 1,
          curve: 'linear',
        },
      },
    };

    midiStorage.saveMappingSet(deviceSet);
    const loaded = midiStorage.loadMappingSet('Test Controller');
    expect(loaded).toEqual(deviceSet);
  });
});

describe('MIDI CC Output Conversion (Reverse-Interpolation)', () => {
  it('converts linear parameter values to CC correctly', () => {
    // valueToMidiCC(value, min, max, curve)
    expect(
      interpolateMidiValue(
        valueToMidiCC(42, 10, 110, 'linear'),
        10,
        110,
        'linear',
      ),
    ).toBeCloseTo(42, 0);
    expect(valueToMidiCC(10, 10, 110, 'linear')).toBe(0);
    expect(valueToMidiCC(110, 10, 110, 'linear')).toBe(127);
    expect(valueToMidiCC(60, 10, 110, 'linear')).toBe(64); // norm is 0.5 -> 0.5 * 127 = 63.5 -> 64
  });

  it('converts exponential parameter values to CC correctly', () => {
    // 7-bit quantization: CC 64 maps back to ~101.8 Hz
    expect(
      interpolateMidiValue(
        valueToMidiCC(100, 10, 1000, 'exponential'),
        10,
        1000,
        'exponential',
      ),
    ).toBeCloseTo(102, 0);
    expect(valueToMidiCC(10, 10, 1000, 'exponential')).toBe(0);
    expect(valueToMidiCC(1000, 10, 1000, 'exponential')).toBe(127);
  });

  it('converts logarithmic parameter values to CC correctly', () => {
    expect(
      interpolateMidiValue(
        valueToMidiCC(50, 10, 110, 'logarithmic'),
        10,
        110,
        'logarithmic',
      ),
    ).toBeCloseTo(50, 0);
    expect(valueToMidiCC(10, 10, 110, 'logarithmic')).toBe(0);
    expect(valueToMidiCC(110, 10, 110, 'logarithmic')).toBe(127);
  });
});

describe('MIDI CC Output Maps & Clock calculations', () => {
  it('defines correct General MIDI compliant and undefined range CCs', () => {
    expect(OUTPUT_CC_MAP.rootFreq).toBe(74); // GM sound brightness
    expect(OUTPUT_CC_MAP.brightness).toBe(71); // GM harmonic content/resonance
    expect(OUTPUT_CC_MAP.space).toBe(72); // GM release time / space
    expect(OUTPUT_CC_MAP.volume).toBe(7); // GM standard volume
  });

  it('calculates correct clock pulse intervals (PPQN)', () => {
    const getInterval = (bpm: number) => 60000 / (bpm * 24);

    // 60 BPM -> 24 ticks/sec -> 41.67 ms interval
    expect(getInterval(60)).toBeCloseTo(41.67, 1);

    // 120 BPM -> 48 ticks/sec -> 20.83 ms interval
    expect(getInterval(120)).toBeCloseTo(20.83, 1);

    // 240 BPM -> 96 ticks/sec -> 10.42 ms interval
    expect(getInterval(240)).toBeCloseTo(10.42, 1);
  });
});

describe('MIDI Note Tracking & Velocity Modulation Integration', () => {
  beforeEach(() => {
    useParamStore.getState().reset();
    localStorage.clear();
    midiInput.stop();
  });

  it('sets root frequency on note-on triggers when enabled', () => {
    // 1. Enable note tracking
    midiStorage.saveGlobalConfig({
      ...midiStorage.loadGlobalConfig(),
      notesEnabled: true,
      notesReleaseBehavior: 'sustain',
    });

    // Start controller
    midiInput.start();

    // 2. Trigger note-on A4 (note 69)
    useParamStore.getState().setParam('rootFreq', 110); // set custom base first

    // Fire A4 (69)
    midiInput['handleMidiEvent'](
      { type: 'note-on', channel: 1, number: 69, value: 100 },
      'device_1',
    );
    expect(useParamStore.getState().params.rootFreq).toBeCloseTo(440, 1);

    // Note off maintains sustain
    midiInput['handleMidiEvent'](
      { type: 'note-off', channel: 1, number: 69, value: 0 },
      'device_1',
    );
    expect(useParamStore.getState().params.rootFreq).toBeCloseTo(440, 1);
  });

  it('implements monophonic last-note-priority correctly', () => {
    midiStorage.saveGlobalConfig({
      ...midiStorage.loadGlobalConfig(),
      notesEnabled: true,
      notesReleaseBehavior: 'return',
    });
    midiInput.start();

    useParamStore.getState().setParam('rootFreq', 110); // original base

    // Hold A4 (69)
    midiInput['handleMidiEvent'](
      { type: 'note-on', channel: 1, number: 69, value: 100 },
      'device_1',
    );
    expect(useParamStore.getState().params.rootFreq).toBeCloseTo(440, 1);

    // Strike C5 (72) while holding A4
    midiInput['handleMidiEvent'](
      { type: 'note-on', channel: 1, number: 72, value: 100 },
      'device_1',
    );
    expect(useParamStore.getState().params.rootFreq).toBeCloseTo(523.25, 1);

    // Release C5, should fall back to held A4
    midiInput['handleMidiEvent'](
      { type: 'note-off', channel: 1, number: 72, value: 0 },
      'device_1',
    );
    expect(useParamStore.getState().params.rootFreq).toBeCloseTo(440, 1);

    // Release A4, should return to original base 110
    midiInput['handleMidiEvent'](
      { type: 'note-off', channel: 1, number: 69, value: 0 },
      'device_1',
    );
    expect(useParamStore.getState().params.rootFreq).toBe(110);
  });

  it('modulates targets via keyboard velocity triggers', () => {
    midiStorage.saveGlobalConfig({
      ...midiStorage.loadGlobalConfig(),
      notesEnabled: true,
      notesVelocityTarget: 'brightness', // modulate brightness
    });
    midiInput.start();

    useParamStore.getState().setParam('brightness', 0.1);

    // Strike key with maximum force (127)
    midiInput['handleMidiEvent'](
      { type: 'note-on', channel: 1, number: 69, value: 127 },
      'device_1',
    );
    expect(useParamStore.getState().params.brightness).toBe(1);

    // Strike key with moderate force (63.5)
    midiInput['handleMidiEvent'](
      { type: 'note-on', channel: 1, number: 69, value: 63.5 },
      'device_1',
    );
    expect(useParamStore.getState().params.brightness).toBeCloseTo(0.5, 1);
  });
});

describe('MIDI Pitch Bend Integration', () => {
  beforeEach(() => {
    useParamStore.getState().reset();
    localStorage.clear();
    midiInput.stop();
  });

  it('correctly parses 14-bit pitch bend messages', () => {
    const events: any[] = [];
    const unsubscribe = midiApi.subscribeInput((event) => {
      events.push(event);
    });

    // Standard MIDI Pitch Bend on channel 1 (0xE0)
    // 1. Minimum bend (0, 0)
    midiApi['handleMidiMessage'](
      { data: new Uint8Array([0xe0, 0x00, 0x00]) } as any,
      'device_1',
    );
    // 2. Center bend (0x00, 0x40) => 8192
    midiApi['handleMidiMessage'](
      { data: new Uint8Array([0xe0, 0x00, 0x40]) } as any,
      'device_1',
    );
    // 3. Maximum bend (0x7F, 0x7F) => 16383
    midiApi['handleMidiMessage'](
      { data: new Uint8Array([0xe0, 0x7f, 0x7f]) } as any,
      'device_1',
    );

    expect(events).toHaveLength(3);

    expect(events[0]).toEqual({
      type: 'pitchbend',
      channel: 1,
      number: 0,
      value: -1,
    });

    expect(events[1]).toEqual({
      type: 'pitchbend',
      channel: 1,
      number: 0,
      value: 0,
    });

    expect(events[2].type).toBe('pitchbend');
    expect(events[2].value).toBeCloseTo(1.0, 3);

    unsubscribe();
  });

  it('forwards parsed pitch bend events to the active orchestrator', () => {
    const mockSetSharedParams = vi.fn();
    const mockOrch = {
      setSharedParams: mockSetSharedParams,
    } as unknown as Orchestrator;

    BridgeServer.registerOrchestrator(() => mockOrch);

    midiInput.start();

    midiInput['handleMidiEvent'](
      { type: 'pitchbend', channel: 1, number: 0, value: 0.5 },
      'device_1',
    );

    expect(mockSetSharedParams).toHaveBeenCalledWith({ pitchBend: 0.5 });

    BridgeServer.registerOrchestrator(null as any);
  });
});
