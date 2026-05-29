import { create } from 'zustand';
import {
  clampEngineParam,
  makeDefaultEngineParams,
} from '@/audio/engines/index';
import type { EngineId, EngineParams } from '@/audio/engines/types';
import { ARC_DURATION, clampArcDuration } from '@/session/arcs';
import type { SessionMode } from '@/session/types';
import {
  makeDefaultLoopConfig,
  type LoopConfigMap,
  type SlotConfig,
  type SlotId,
} from '@/loop/types';

export interface AnnealMusicParams {
  rootFreq: number;
  spread: number;
  density: number;
  coupling: number;
  drift: number;
  brightness: number;
  space: number;
  volume: number;
}

export type ParamKey = keyof AnnealMusicParams;

export const DEFAULT_PARAMS: AnnealMusicParams = {
  rootFreq: 110,
  spread: 1.0,
  density: 6,
  coupling: 0.3,
  drift: 0.5,
  brightness: 0.5,
  space: 0.4,
  volume: 0.35,
};

export type ControlGroup = 'Pitch' | 'Physics' | 'Tone';

export interface ControlDef {
  key: ParamKey;
  label: string;
  group: ControlGroup;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  /** When true, the control is disabled while audio is playing. */
  lockWhilePlaying?: boolean;
}

/** Convert a frequency in Hz to the closest standard Western musical note name (e.g. A2). */
export function getClosestNote(freq: number): string {
  const NOTE_NAMES = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ];
  const midi = Math.round(12 * Math.log2(freq / 440) + 69);
  const noteName = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${noteName}${octave}`;
}

/** Convert a Western piano note name (e.g. A4, C#3, Gb5) to its frequency in Hz. */
export function pianoNoteToFreq(note: string): number | null {
  const cleaned = note.trim().replace(/\s+/g, '');
  const match = cleaned.match(/^([A-G]|[a-g])(#|b|♯|♭)?(-?\d+)$/);
  if (!match) return null;

  const name = match[1] ? match[1].toUpperCase() : '';
  const accidental = match[2] || '';
  const octaveStr = match[3] || '';
  const octave = parseInt(octaveStr, 10);

  const NOTE_TO_PITCH: Record<string, number> = {
    C: 0,
    'C#': 1,
    D: 2,
    'D#': 3,
    E: 4,
    F: 5,
    'F#': 6,
    G: 7,
    'G#': 8,
    A: 9,
    'A#': 10,
    B: 11,
  };

  let pitch = NOTE_TO_PITCH[name];
  if (pitch === undefined) return null;

  if (accidental === 'b' || accidental === '♭') {
    pitch -= 1;
  } else if (accidental === '#' || accidental === '♯') {
    pitch += 1;
  }

  const midi = (octave + 1) * 12 + pitch;
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  return isNaN(freq) ? null : freq;
}

/** Grouped controls rendered in the control panel (excludes volume). */
export const CONTROL_DEFS: readonly ControlDef[] = [
  {
    key: 'rootFreq',
    label: 'Root',
    group: 'Pitch',
    min: 20,
    max: 4200,
    step: 1,
    fmt: (v) => `${v.toFixed(0)} Hz (${getClosestNote(v)})`,
  },
  {
    key: 'spread',
    label: 'Spread',
    group: 'Pitch',
    min: 0.7,
    max: 1.3,
    step: 0.01,
    fmt: (v) => v.toFixed(2),
  },
  {
    key: 'density',
    label: 'Density',
    group: 'Pitch',
    min: 2,
    max: 8,
    step: 1,
    fmt: (v) => `${v.toFixed(0)}`,
    lockWhilePlaying: true,
  },
  {
    key: 'coupling',
    label: 'Coupling',
    group: 'Physics',
    min: 0,
    max: 1,
    step: 0.01,
    fmt: (v) => v.toFixed(2),
  },
  {
    key: 'drift',
    label: 'Drift',
    group: 'Physics',
    min: 0,
    max: 1,
    step: 0.01,
    fmt: (v) => v.toFixed(2),
  },
  {
    key: 'brightness',
    label: 'Brightness',
    group: 'Tone',
    min: 0,
    max: 1,
    step: 0.01,
    fmt: (v) => v.toFixed(2),
  },
  {
    key: 'space',
    label: 'Space',
    group: 'Tone',
    min: 0,
    max: 1,
    step: 0.01,
    fmt: (v) => v.toFixed(2),
  },
];

/** The volume control, kept separate from the grouped grid (matches prototype). */
export const VOLUME_DEF: ControlDef = {
  key: 'volume',
  label: 'Volume',
  group: 'Tone',
  min: 0,
  max: 0.8,
  step: 0.01,
  fmt: (v) => `${(v * 100).toFixed(0)}%`,
};

const BOUNDS: Record<ParamKey, { min: number; max: number }> = (() => {
  const out = {} as Record<ParamKey, { min: number; max: number }>;
  for (const def of [...CONTROL_DEFS, VOLUME_DEF]) {
    out[def.key] = { min: def.min, max: def.max };
  }
  return out;
})();

/** Clamp a value to the declared bounds for the given param key. */
export function clampParam(key: ParamKey, value: number): number {
  const b = BOUNDS[key];
  return Math.min(b.max, Math.max(b.min, value));
}

export const DEFAULT_ENGINE_ID: EngineId = 'sine';
export const DEFAULT_SESSION_MODE: SessionMode = 'open';
export const DEFAULT_ARC_ID = 'bell';

export interface ParamStore {
  params: AnnealMusicParams;
  /** Active synthesis engine. */
  engineId: EngineId;
  /** Per-engine param bags, retained across switches. */
  engineParams: Partial<Record<EngineId, EngineParams>>;
  /** Session selection (pre-Begin): open jam vs. a scripted arc. */
  sessionMode: SessionMode;
  /** Selected preset arc id (used when `sessionMode === 'arc'`). */
  arcId: string;
  /** Selected arc duration in seconds (clamped to `ARC_DURATION`). */
  arcDurationSec: number;
  /** Per-slot loop config (URL-encodable; buffers are runtime-only). */
  loops: LoopConfigMap;
  setParam: (key: ParamKey, value: number) => void;
  setMany: (partial: Partial<AnnealMusicParams>) => void;
  setEngine: (id: EngineId) => void;
  setEngineParam: (id: EngineId, key: string, value: number) => void;
  setSessionMode: (mode: SessionMode) => void;
  setArcId: (id: string) => void;
  setArcDurationSec: (sec: number) => void;
  setLoopConfig: (id: SlotId, config: SlotConfig) => void;
  reset: () => void;
}

export const useParamStore = create<ParamStore>((set) => ({
  params: DEFAULT_PARAMS,
  engineId: DEFAULT_ENGINE_ID,
  engineParams: makeDefaultEngineParams(),
  sessionMode: DEFAULT_SESSION_MODE,
  arcId: DEFAULT_ARC_ID,
  arcDurationSec: ARC_DURATION.default,
  loops: makeDefaultLoopConfig(),
  setParam: (key, value) =>
    set((state) => ({
      params: { ...state.params, [key]: clampParam(key, value) },
    })),
  setMany: (partial) =>
    set((state) => {
      const next = { ...state.params };
      for (const key of Object.keys(partial) as ParamKey[]) {
        const value = partial[key];
        if (value !== undefined) next[key] = clampParam(key, value);
      }
      return { params: next };
    }),
  setEngine: (id) => set({ engineId: id }),
  setEngineParam: (id, key, value) =>
    set((state) => ({
      engineParams: {
        ...state.engineParams,
        [id]: {
          ...state.engineParams[id],
          [key]: clampEngineParam(id, key, value),
        },
      },
    })),
  setSessionMode: (mode) => set({ sessionMode: mode }),
  setArcId: (id) => set({ arcId: id }),
  setArcDurationSec: (sec) => set({ arcDurationSec: clampArcDuration(sec) }),
  setLoopConfig: (id, config) =>
    set((state) => ({ loops: { ...state.loops, [id]: config } })),
  reset: () =>
    set({
      params: DEFAULT_PARAMS,
      engineId: DEFAULT_ENGINE_ID,
      engineParams: makeDefaultEngineParams(),
      sessionMode: DEFAULT_SESSION_MODE,
      arcId: DEFAULT_ARC_ID,
      arcDurationSec: ARC_DURATION.default,
      loops: makeDefaultLoopConfig(),
    }),
}));
