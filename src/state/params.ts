import { create } from 'zustand';
import {
  clampEngineParam,
  makeDefaultEngineParams,
} from '@/audio/engines/index';
import type { EngineId, EngineParams } from '@/audio/engines/types';

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

/** Grouped controls rendered in the control panel (excludes volume). */
export const CONTROL_DEFS: readonly ControlDef[] = [
  {
    key: 'rootFreq',
    label: 'Root',
    group: 'Pitch',
    min: 55,
    max: 220,
    step: 1,
    fmt: (v) => `${v.toFixed(0)} Hz`,
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

export interface ParamStore {
  params: AnnealMusicParams;
  /** Active synthesis engine. */
  engineId: EngineId;
  /** Per-engine param bags, retained across switches. */
  engineParams: Partial<Record<EngineId, EngineParams>>;
  setParam: (key: ParamKey, value: number) => void;
  setMany: (partial: Partial<AnnealMusicParams>) => void;
  setEngine: (id: EngineId) => void;
  setEngineParam: (id: EngineId, key: string, value: number) => void;
  reset: () => void;
}

export const useParamStore = create<ParamStore>((set) => ({
  params: DEFAULT_PARAMS,
  engineId: DEFAULT_ENGINE_ID,
  engineParams: makeDefaultEngineParams(),
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
  reset: () =>
    set({
      params: DEFAULT_PARAMS,
      engineId: DEFAULT_ENGINE_ID,
      engineParams: makeDefaultEngineParams(),
    }),
}));
