import type { EngineId } from '@/audio/engines/types';

/** Curated subset of synthesis engines suitable for Drone mode. */
export const DRONE_ENGINES: readonly EngineId[] = [
  'sine',
  'granular',
  'physical',
];

/** Check if a given engine is suitable for Drone mode. */
export function isDroneEngine(id: EngineId): boolean {
  return DRONE_ENGINES.includes(id);
}

/** Curated subset of sustained/ambient granular sources. */
export const DRONE_GRANULAR_SOURCES = [
  0, // glasspad (Glass Pad)
  1, // bowedmetal (Bowed Metal)
  2, // tapeorgan (Tape Organ)
  4, // deepdrone (Deep Drone)
  5, // choirair (Choir Air)
  7, // warmtape (Warm Tape)
];

/** Check if a granular source index is curated for Drone mode. */
export function isDroneGranularSource(index: number): boolean {
  return DRONE_GRANULAR_SOURCES.includes(index);
}

/** Curated subset of continuous physical modeling models. */
export const DRONE_PHYSICAL_MODELS = [
  0, // string (sustain)
  4, // bowed
  5, // mallet (sustain / bell)
  7, // bell
];

/** Check if a physical model index is curated for Drone mode. */
export function isDronePhysicalModel(index: number): boolean {
  return DRONE_PHYSICAL_MODELS.includes(index);
}
