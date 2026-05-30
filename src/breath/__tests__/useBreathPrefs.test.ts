import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBreathPattern, useBreathPrefs } from '@/breath/useBreathPrefs';

describe('useBreathPrefs', () => {
  beforeEach(() => localStorage.clear());

  it('defaults reduce-motion and haptics off and persists changes', () => {
    const { result } = renderHook(() => useBreathPrefs());
    expect(result.current.reduceMotion).toBe(false);
    expect(result.current.haptics).toBe(false);

    act(() => result.current.setReduceMotion(true));
    expect(result.current.reduceMotion).toBe(true);
    expect(localStorage.getItem('am_breath_reduce_motion')).toBe('1');

    // A fresh hook reads the persisted value.
    const second = renderHook(() => useBreathPrefs());
    expect(second.result.current.reduceMotion).toBe(true);
  });
});

describe('useBreathPattern', () => {
  beforeEach(() => localStorage.clear());

  it('persists and restores a device-local pattern', () => {
    const { result } = renderHook(() => useBreathPattern('am_breath_drone'));
    expect(result.current[0]).toBeNull();

    act(() => result.current[1]({ pattern: 'coherent' }));
    expect(result.current[0]).toEqual({ pattern: 'coherent' });

    const second = renderHook(() => useBreathPattern('am_breath_drone'));
    expect(second.result.current[0]).toEqual({ pattern: 'coherent' });
  });

  it('clears the stored pattern when set to null', () => {
    const { result } = renderHook(() => useBreathPattern('am_breath_timer'));
    act(() => result.current[1]({ pattern: 'box' }));
    act(() => result.current[1](null));
    expect(result.current[0]).toBeNull();
    expect(localStorage.getItem('am_breath_timer')).toBeNull();
  });
});
