import type { MappingSet, MidiMapping } from './types';

// Helper to make a standard linear mapping
function makeLinearMapping(
  paramKey: string,
  min: number,
  max: number,
  isEngineParam = false,
): MidiMapping {
  return {
    paramKey,
    isEngineParam,
    min,
    max,
    curve: 'linear',
  };
}

// Ableton Push 2 Encoders
export const PUSH2_DEFAULTS: Record<number, MidiMapping> = {
  71: makeLinearMapping('rootFreq', 20, 2200),
  72: makeLinearMapping('spread', 0.7, 1.3),
  73: makeLinearMapping('density', 2, 8),
  74: makeLinearMapping('coupling', 0, 1),
  75: makeLinearMapping('drift', 0, 1),
  76: makeLinearMapping('brightness', 0, 1),
  77: makeLinearMapping('space', 0, 1),
  79: makeLinearMapping('volume', 0, 0.8),
};

// Novation Launch Control XL (Factory template 1 / standard CCs)
export const LAUNCH_CONTROL_XL_DEFAULTS: Record<number, MidiMapping> = {
  77: makeLinearMapping('rootFreq', 20, 2200),
  78: makeLinearMapping('spread', 0.7, 1.3),
  79: makeLinearMapping('density', 2, 8),
  80: makeLinearMapping('coupling', 0, 1),
  81: makeLinearMapping('drift', 0, 1),
  82: makeLinearMapping('brightness', 0, 1),
  83: makeLinearMapping('space', 0, 1),
  73: makeLinearMapping('volume', 0, 0.8), // Fader 8 is CC 73 usually
};

// Akai MIDI Mix (Knob row 1-3, Faders)
export const AKAI_MIDIMIX_DEFAULTS: Record<number, MidiMapping> = {
  16: makeLinearMapping('rootFreq', 20, 2200),
  17: makeLinearMapping('spread', 0.7, 1.3),
  18: makeLinearMapping('density', 2, 8),
  19: makeLinearMapping('coupling', 0, 1),
  20: makeLinearMapping('drift', 0, 1),
  21: makeLinearMapping('brightness', 0, 1),
  22: makeLinearMapping('space', 0, 1),
  23: makeLinearMapping('volume', 0, 0.8),
};

// Korg nanoKONTROL2 (Knobs 1..8)
export const KORG_NANOKONTROL2_DEFAULTS: Record<number, MidiMapping> = {
  16: makeLinearMapping('rootFreq', 20, 2200),
  17: makeLinearMapping('spread', 0.7, 1.3),
  18: makeLinearMapping('density', 2, 8),
  19: makeLinearMapping('coupling', 0, 1),
  20: makeLinearMapping('drift', 0, 1),
  21: makeLinearMapping('brightness', 0, 1),
  22: makeLinearMapping('space', 0, 1),
  23: makeLinearMapping('volume', 0, 0.8),
};

// Generic 8-Fader Fallback
export const GENERIC_8FADER_DEFAULTS: Record<number, MidiMapping> = {
  16: makeLinearMapping('rootFreq', 20, 2200),
  17: makeLinearMapping('spread', 0.7, 1.3),
  18: makeLinearMapping('density', 2, 8),
  19: makeLinearMapping('coupling', 0, 1),
  20: makeLinearMapping('drift', 0, 1),
  21: makeLinearMapping('brightness', 0, 1),
  22: makeLinearMapping('space', 0, 1),
  23: makeLinearMapping('volume', 0, 0.8),
};

/** Identifies matching controller mapping based on string name */
export function getAutoMappingForController(name: string): MappingSet {
  const normalized = name.toLowerCase();

  if (normalized.includes('push 2') || normalized.includes('push2')) {
    return { controllerId: name, channel: 0, mappings: { ...PUSH2_DEFAULTS } };
  }
  if (
    normalized.includes('launch control') ||
    normalized.includes('lcxl') ||
    normalized.includes('launchcontrol')
  ) {
    return {
      controllerId: name,
      channel: 0,
      mappings: { ...LAUNCH_CONTROL_XL_DEFAULTS },
    };
  }
  if (normalized.includes('midimix') || normalized.includes('midi mix')) {
    return {
      controllerId: name,
      channel: 0,
      mappings: { ...AKAI_MIDIMIX_DEFAULTS },
    };
  }
  if (
    normalized.includes('nanokontrol2') ||
    normalized.includes('nanokontrol')
  ) {
    return {
      controllerId: name,
      channel: 0,
      mappings: { ...KORG_NANOKONTROL2_DEFAULTS },
    };
  }

  // Fallback to generic faders
  return {
    controllerId: name,
    channel: 0,
    mappings: { ...GENERIC_8FADER_DEFAULTS },
  };
}
