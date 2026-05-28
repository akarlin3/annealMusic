import type { EngineId } from '@/audio/engines/types';
import type { AnnealMusicParams } from '@/state/params';

export interface MusicPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly engineId: EngineId;
  /** Presets exclude 'volume' to respect the user's personal listening level. */
  readonly params: Omit<AnnealMusicParams, 'volume'>;
  readonly engineParams?: Record<string, number>;
}

export const PRESET_SOUNDS: readonly MusicPreset[] = [
  {
    id: 'cosmic-hum',
    name: 'Cosmic Hum',
    description:
      'Deep, slow-breathing waves of sound designed for comforting relaxation.',
    engineId: 'sine',
    params: {
      rootFreq: 55,
      spread: 0.75,
      density: 4,
      coupling: 0.8,
      drift: 0.3,
      brightness: 0.2,
      space: 0.6,
    },
  },
  {
    id: 'cosmic-cathedral',
    name: 'Cosmic Cathedral',
    description:
      'Vast, starry halls filled with shimmering glassy tones echoing infinitely.',
    engineId: 'sine',
    params: {
      rootFreq: 110,
      spread: 1.05,
      density: 7,
      coupling: 0.6,
      drift: 0.5,
      brightness: 0.45,
      space: 0.85,
    },
  },
  {
    id: 'tibetan-bowls',
    name: 'Tibetan Bowls',
    description:
      'Rich, metallic vibrations simulating peaceful singing bowls in a quiet sanctuary.',
    engineId: 'fm',
    params: {
      rootFreq: 87,
      spread: 1.15,
      density: 5,
      coupling: 0.25,
      drift: 0.7,
      brightness: 0.6,
      space: 0.75,
    },
    engineParams: {
      modRatio: 2.02,
      modIndex: 3.5,
      feedback: 0.3,
    },
  },
  {
    id: 'solar-wind',
    name: 'Solar Wind',
    description:
      'Active, crisp, and bright electronic waves that sweep together.',
    engineId: 'fm',
    params: {
      rootFreq: 130,
      spread: 0.88,
      density: 6,
      coupling: 0.9,
      drift: 0.8,
      brightness: 0.75,
      space: 0.5,
    },
    engineParams: {
      modRatio: 1.41,
      modIndex: 6.5,
      feedback: 0.5,
    },
  },
  {
    id: 'autumn-rain',
    name: 'Autumn Rain',
    description:
      'Organic clouds of gentle, sparse raindrops pattering on window glass.',
    engineId: 'granular',
    params: {
      rootFreq: 98,
      spread: 1.2,
      density: 5,
      coupling: 0.4,
      drift: 0.65,
      brightness: 0.5,
      space: 0.7,
    },
    engineParams: {
      source: 6, // Rain Glass
      size: 0.15,
      density: 60,
      posJitter: 0.8,
      pitchJitter: 0.05,
      posCenter: 0.4,
    },
  },
  {
    id: 'breathing-organ',
    name: 'Breathing Organ',
    description:
      'A warm, breathy, and vintage tape-saturated organ rising and falling like breath.',
    engineId: 'granular',
    params: {
      rootFreq: 110,
      spread: 0.95,
      density: 7,
      coupling: 0.75,
      drift: 0.45,
      brightness: 0.65,
      space: 0.6,
    },
    engineParams: {
      source: 2, // Tape Organ
      size: 0.28,
      density: 50,
      posJitter: 0.3,
      pitchJitter: 0.02,
      posCenter: 0.5,
    },
  },
  {
    id: 'string-quartet',
    name: 'String Quartet',
    description:
      'Rich, resonant bowed strings modeled after acoustic instruments playing in unison.',
    engineId: 'physical',
    params: {
      rootFreq: 73,
      spread: 0.92,
      density: 6,
      coupling: 0.65,
      drift: 0.5,
      brightness: 0.4,
      space: 0.8,
    },
    engineParams: {
      model: 0, // String
      excitationLevel: 0.85,
      damping: 0.35,
      brightness: 0.5,
    },
  },
  {
    id: 'ringing-gongs',
    name: 'Ringing Gongs',
    description:
      'Sparsely struck resonant plates generating a mysterious, cavernous metallic ring.',
    engineId: 'physical',
    params: {
      rootFreq: 65,
      spread: 1.3,
      density: 4,
      coupling: 0.15,
      drift: 0.9,
      brightness: 0.7,
      space: 0.9,
    },
    engineParams: {
      model: 2, // Plate
      excitationLevel: 0.9,
      damping: 0.15,
      inharm: 0.75,
      brightness: 0.65,
    },
  },
];
