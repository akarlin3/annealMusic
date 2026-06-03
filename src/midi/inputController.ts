import { midiApi } from './api';
import { midiStorage } from './storage';
import { getAutoMappingForController } from './knownControllers';
import { useParamStore, type ParamKey } from '@/state/params';
import type { CurveType, MappingSet, MidiInputEvent } from './types';
import { BridgeServer } from '@/research/bridge/BridgeServer';

// Mathematical interpolation curves
export function interpolateMidiValue(
  ccValue: number, // 0..127
  min: number,
  max: number,
  curve: CurveType,
): number {
  const norm = Math.max(0, Math.min(127, ccValue)) / 127;

  if (curve === 'exponential') {
    // Avoid zero or negative values in exponential calculations
    const safeMin = min <= 0 ? 0.001 : min;
    const safeMax = max <= 0 ? 0.001 : max;
    return safeMin * Math.pow(safeMax / safeMin, norm);
  }

  if (curve === 'logarithmic') {
    return min + (max - min) * Math.log10(1 + 9 * norm);
  }

  // Default: Linear
  return min + norm * (max - min);
}

class MidiInputController {
  private activeMappings: Map<string, MappingSet> = new Map();
  private unsubscribeMidi: (() => void) | null = null;
  private unsubscribeLearn: (() => void) | null = null;
  private heldNotes: number[] = [];
  private preMidiRootFreq = 110;

  start(): void {
    if (this.unsubscribeMidi) return;

    this.unsubscribeMidi = midiApi.subscribeInput((event, deviceId) => {
      this.handleMidiEvent(event, deviceId);
    });

    // Handle learning updates dynamically
    this.unsubscribeLearn = midiLearn.subscribeLearnSuccess(
      (paramKey, isEngineParam, ccNumber, deviceId) => {
        this.handleLearnMapping(paramKey, isEngineParam, ccNumber, deviceId);
      },
    );
  }

  stop(): void {
    if (this.unsubscribeMidi) {
      this.unsubscribeMidi();
      this.unsubscribeMidi = null;
    }
    if (this.unsubscribeLearn) {
      this.unsubscribeLearn();
      this.unsubscribeLearn = null;
    }
  }

  /** Reloads a mapping set for a physical controller */
  getOrLoadMappingSet(deviceId: string): MappingSet {
    let mappingSet = this.activeMappings.get(deviceId);
    if (!mappingSet) {
      // 1. Try to load from localStorage
      mappingSet = midiStorage.loadMappingSet(deviceId) || undefined;

      if (!mappingSet) {
        // 2. Generate auto-mapping matching device characteristics
        mappingSet = getAutoMappingForController(deviceId);
        midiStorage.saveMappingSet(mappingSet);
      }

      this.activeMappings.set(deviceId, mappingSet);
    }
    return mappingSet;
  }

  /** Updates an active mapping set (e.g. from the UI table or manual changes) */
  updateMappingSet(mappingSet: MappingSet): void {
    this.activeMappings.set(mappingSet.controllerId, mappingSet);
    midiStorage.saveMappingSet(mappingSet);
  }

  private handleMidiEvent(event: MidiInputEvent, deviceId: string) {
    // Fetch global configuration to apply channel filters
    const globalConfig = midiStorage.loadGlobalConfig();
    if (
      globalConfig.channelFilter > 0 &&
      event.channel !== globalConfig.channelFilter
    ) {
      return; // ignore events on other channels
    }

    if (event.type === 'cc') {
      this.processControlChange(event, deviceId);
    } else if (event.type === 'note-on') {
      this.processNoteOn(event);
    } else if (event.type === 'note-off') {
      this.processNoteOff(event);
    } else if (event.type === 'pitchbend') {
      this.processPitchBend(event);
    }
  }

  private processPitchBend(event: MidiInputEvent) {
    const orch = BridgeServer.getOrchestrator();
    if (orch) {
      orch.setSharedParams({ pitchBend: event.value });
    }
  }

  private processControlChange(event: MidiInputEvent, deviceId: string) {
    const mappingSet = this.getOrLoadMappingSet(deviceId);
    const mapping = mappingSet.mappings[event.number];
    if (!mapping) return;

    const targetVal = interpolateMidiValue(
      event.value,
      mapping.min,
      mapping.max,
      mapping.curve,
    );
    const store = useParamStore.getState();

    if (mapping.isEngineParam) {
      // Engine specific parameter change
      store.setEngineParam(store.engineId, mapping.paramKey, targetVal);
    } else {
      // App-wide shared parameter change
      store.setParam(mapping.paramKey as ParamKey, targetVal);
    }
  }

  private processNoteOn(event: MidiInputEvent) {
    const config = midiStorage.loadGlobalConfig();
    const note = event.number;
    const velocity = event.value;

    // Filter out duplicate held notes
    this.heldNotes = this.heldNotes.filter((n) => n !== note);
    this.heldNotes.push(note);

    if (config.notesEnabled) {
      // Monophonic pitch calculation
      const freq = 440 * Math.pow(2, (note - 69) / 12);
      const store = useParamStore.getState();

      // If this is the first key struck in this phrase, capture UI pre-MIDI root pitch
      if (this.heldNotes.length === 1) {
        this.preMidiRootFreq = store.params.rootFreq;
      }

      // Restrict note pitch values to valid ranges
      if (note >= 21 && note <= 108) {
        store.setParam('rootFreq', freq);
      }

      // Velocity modulation tracking
      if (config.notesVelocityTarget && config.notesVelocityTarget !== 'none') {
        const target = config.notesVelocityTarget;
        const normVel = velocity / 127;

        // Expose velocity to either engine params or shared params
        const allSharedKeys = [
          'rootFreq',
          'spread',
          'density',
          'coupling',
          'drift',
          'brightness',
          'space',
          'volume',
        ];
        if (allSharedKeys.includes(target)) {
          store.setParam(target as ParamKey, normVel);
        } else {
          // Engine specific param (e.g. excitationLevel)
          store.setEngineParam(store.engineId, target, normVel);
        }
      }
    }
  }

  private processNoteOff(event: MidiInputEvent) {
    const config = midiStorage.loadGlobalConfig();
    const note = event.number;

    this.heldNotes = this.heldNotes.filter((n) => n !== note);

    if (config.notesEnabled) {
      const store = useParamStore.getState();

      if (this.heldNotes.length > 0) {
        // Last-note-priority monophonic behavior: switch to most recently held key
        const activeNote = this.heldNotes[this.heldNotes.length - 1];
        if (activeNote !== undefined && activeNote >= 21 && activeNote <= 108) {
          const freq = 440 * Math.pow(2, (activeNote - 69) / 12);
          store.setParam('rootFreq', freq);
        }
      } else {
        // No notes left held down: apply release behavior
        if (config.notesReleaseBehavior === 'return') {
          store.setParam('rootFreq', this.preMidiRootFreq);
        }
        // If 'sustain' (default), we just leave the frequency locked to the last key struck
      }
    }
  }

  private handleLearnMapping(
    paramKey: string,
    isEngineParam: boolean,
    ccNumber: number,
    deviceId: string,
  ) {
    const mappingSet = this.getOrLoadMappingSet(deviceId);

    // Find default min/max bounds based on parameter key definition
    let min = 0;
    let max = 1;
    let curve: CurveType = 'linear';

    if (isEngineParam) {
      const store = useParamStore.getState();
      const defs = engineParamDefs(store.engineId);
      const def = defs.find((d) => d.key === paramKey);
      if (def) {
        min = def.min;
        max = def.max;
      }
    } else {
      const allDefs = [...CONTROL_DEFS, VOLUME_DEF];
      const def = allDefs.find((d) => d.key === paramKey);
      if (def) {
        min = def.min;
        max = def.max;
        if (paramKey === 'rootFreq') {
          curve = 'exponential';
        }
      }
    }

    // Bind CC
    mappingSet.mappings[ccNumber] = {
      paramKey,
      isEngineParam,
      min,
      max,
      curve,
    };

    // Save and cache mapping
    this.updateMappingSet(mappingSet);
  }
}

// Circular dependency imports avoided by lazy lookups of parameter definitions
import { CONTROL_DEFS, VOLUME_DEF } from '@/state/params';
import { engineParamDefs } from '@/audio/engines/index';
import { midiLearn } from './learnMode';

export const midiInput = new MidiInputController();
