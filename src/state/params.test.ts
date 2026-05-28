import { beforeEach, describe, expect, it } from 'vitest';
import {
  CONTROL_DEFS,
  DEFAULT_PARAMS,
  VOLUME_DEF,
  clampParam,
  useParamStore,
  getClosestNote,
} from '@/state/params';

const ALL_DEFS = [...CONTROL_DEFS, VOLUME_DEF];

describe('control definitions', () => {
  it('have defaults within their declared min/max', () => {
    for (const def of ALL_DEFS) {
      const value = DEFAULT_PARAMS[def.key];
      expect(value, `${def.key} default`).toBeGreaterThanOrEqual(def.min);
      expect(value, `${def.key} default`).toBeLessThanOrEqual(def.max);
    }
  });

  it('declare a positive step and min < max', () => {
    for (const def of ALL_DEFS) {
      expect(def.step, `${def.key} step`).toBeGreaterThan(0);
      expect(def.min, `${def.key} bounds`).toBeLessThan(def.max);
    }
  });
});

describe('clampParam', () => {
  it('clamps below min and above max', () => {
    expect(clampParam('rootFreq', 10)).toBe(55);
    expect(clampParam('rootFreq', 999)).toBe(220);
    expect(clampParam('volume', -1)).toBe(0);
    expect(clampParam('volume', 5)).toBe(0.8);
  });

  it('passes through in-range values unchanged', () => {
    expect(clampParam('coupling', 0.42)).toBe(0.42);
  });
});

describe('useParamStore.setParam', () => {
  beforeEach(() => {
    useParamStore.getState().reset();
  });

  it('respects bounds when setting', () => {
    useParamStore.getState().setParam('rootFreq', 9999);
    expect(useParamStore.getState().params.rootFreq).toBe(220);

    useParamStore.getState().setParam('drift', -3);
    expect(useParamStore.getState().params.drift).toBe(0);
  });

  it('updates an in-range value', () => {
    useParamStore.getState().setParam('spread', 1.1);
    expect(useParamStore.getState().params.spread).toBe(1.1);
  });
});

describe('getClosestNote', () => {
  it('correctly maps octaves of A', () => {
    expect(getClosestNote(55)).toBe('A1');
    expect(getClosestNote(110)).toBe('A2');
    expect(getClosestNote(220)).toBe('A3');
  });

  it('correctly identifies other notes in the range', () => {
    // E2 is roughly 82.4 Hz
    expect(getClosestNote(82)).toBe('E2');
    expect(getClosestNote(83)).toBe('E2');

    // C3 is roughly 130.8 Hz
    expect(getClosestNote(131)).toBe('C3');

    // Middle C (C4) is roughly 261.6 Hz
    expect(getClosestNote(262)).toBe('C4');
  });
});
