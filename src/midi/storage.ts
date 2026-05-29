import type { MappingSet } from './types';

const MAPPINGS_PREFIX = 'am_midi_mappings_';
const GLOBAL_MIDI_CONFIG_KEY = 'am_midi_global_config';

export interface GlobalMidiConfig {
  channelFilter: number; // 0 = Omni, 1..16
  outputDeviceId: string; // id or "none"
  outputChannel: number; // 1..16, default 16
  clockEnabled: boolean;
  clockBpm: number;
  clockSyncToPieceTempo: boolean; // <-- NEW
  ccOutputEnabled: boolean;
  notesEnabled: boolean; // note sets root
  notesReleaseBehavior: 'sustain' | 'return';
  notesVelocityTarget: string; // param key or "none" / "excitationLevel"
}

export const DEFAULT_GLOBAL_CONFIG: GlobalMidiConfig = {
  channelFilter: 0, // Omni
  outputDeviceId: 'none',
  outputChannel: 16,
  clockEnabled: false,
  clockBpm: 60,
  clockSyncToPieceTempo: false, // <-- NEW
  ccOutputEnabled: false,
  notesEnabled: false,
  notesReleaseBehavior: 'sustain',
  notesVelocityTarget: 'excitationLevel',
};

export const midiStorage = {
  /** Saves a mapping set for a specific controller name/ID */
  saveMappingSet(mappingSet: MappingSet): void {
    try {
      localStorage.setItem(
        `${MAPPINGS_PREFIX}${mappingSet.controllerId}`,
        JSON.stringify(mappingSet),
      );
    } catch (e) {
      console.error('[MIDI Storage] Failed to save mapping set', e);
    }
  },

  /** Loads a mapping set for a specific controller name/ID */
  loadMappingSet(controllerId: string): MappingSet | null {
    try {
      const data = localStorage.getItem(`${MAPPINGS_PREFIX}${controllerId}`);
      if (!data) return null;
      return JSON.parse(data) as MappingSet;
    } catch (e) {
      console.error('[MIDI Storage] Failed to load mapping set', e);
      return null;
    }
  },

  /** Deletes a mapping set for a specific controller name/ID */
  deleteMappingSet(controllerId: string): void {
    try {
      localStorage.removeItem(`${MAPPINGS_PREFIX}${controllerId}`);
    } catch (e) {
      console.error('[MIDI Storage] Failed to delete mapping set', e);
    }
  },

  /** Exports all mapping sets and global settings as a single JSON string */
  exportAllConfig(): string {
    const backup: Record<string, string | null> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith(MAPPINGS_PREFIX) || key === GLOBAL_MIDI_CONFIG_KEY)
        ) {
          backup[key] = localStorage.getItem(key);
        }
      }
      return JSON.stringify(backup);
    } catch (e) {
      console.error('[MIDI Storage] Failed to export config', e);
      return '{}';
    }
  },

  /** Imports configuration JSON, validating structure and overwriting local storage */
  importAllConfig(configJson: string): boolean {
    try {
      const parsed = JSON.parse(configJson) as Record<string, string>;
      if (typeof parsed !== 'object' || parsed === null) return false;

      // Validate all keys first to ensure safety
      for (const key of Object.keys(parsed)) {
        if (
          !key.startsWith(MAPPINGS_PREFIX) &&
          key !== GLOBAL_MIDI_CONFIG_KEY
        ) {
          return false; // unrecognized keys, reject backup
        }
      }

      // Safe to write
      for (const [key, value] of Object.entries(parsed)) {
        if (value) localStorage.setItem(key, value);
      }
      return true;
    } catch (e) {
      console.error('[MIDI Storage] Failed to import config', e);
      return false;
    }
  },

  /** Saves the global settings options */
  saveGlobalConfig(config: GlobalMidiConfig): void {
    try {
      localStorage.setItem(GLOBAL_MIDI_CONFIG_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('[MIDI Storage] Failed to save global config', e);
    }
  },

  /** Loads the global settings options */
  loadGlobalConfig(): GlobalMidiConfig {
    try {
      const data = localStorage.getItem(GLOBAL_MIDI_CONFIG_KEY);
      if (!data) return DEFAULT_GLOBAL_CONFIG;
      return {
        ...DEFAULT_GLOBAL_CONFIG,
        ...JSON.parse(data),
      } as GlobalMidiConfig;
    } catch (e) {
      console.error('[MIDI Storage] Failed to load global config', e);
      return DEFAULT_GLOBAL_CONFIG;
    }
  },
};
