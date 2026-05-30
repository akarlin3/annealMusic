/**
 * useBreathPrefs — device-local breath prefs (v4.4): reduce-motion and the
 * mobile haptic toggle, persisted to `localStorage`. These are cross-surface
 * preferences (not part of any shared session), so they live on the device.
 * Pattern persistence for Drone/Timer is handled by `useBreathPattern`.
 */
import { useCallback, useState } from 'react';
import { isHapticsAvailable } from './hapticBridge';
import type { BreathPattern } from './patterns';

const REDUCE_MOTION_KEY = 'am_breath_reduce_motion';
const HAPTICS_KEY = 'am_breath_haptics';

function readBool(key: string, fallback = false): boolean {
  if (typeof localStorage === 'undefined') return fallback;
  const v = localStorage.getItem(key);
  return v === null ? fallback : v === '1';
}

function writeBool(key: string, value: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, value ? '1' : '0');
}

export interface BreathPrefs {
  /** Force reduced-motion (fade only) regardless of the OS setting. */
  reduceMotion: boolean;
  setReduceMotion: (v: boolean) => void;
  /** Fire gentle haptics at phase transitions (mobile only; off by default). */
  haptics: boolean;
  setHaptics: (v: boolean) => void;
  /** Whether haptics are even meaningful on this device (native platform). */
  hapticsAvailable: boolean;
}

export function useBreathPrefs(): BreathPrefs {
  const [reduceMotion, setReduceMotionState] = useState(() =>
    readBool(REDUCE_MOTION_KEY),
  );
  const [haptics, setHapticsState] = useState(() => readBool(HAPTICS_KEY));

  const setReduceMotion = useCallback((v: boolean) => {
    setReduceMotionState(v);
    writeBool(REDUCE_MOTION_KEY, v);
  }, []);

  const setHaptics = useCallback((v: boolean) => {
    setHapticsState(v);
    writeBool(HAPTICS_KEY, v);
  }, []);

  return {
    reduceMotion,
    setReduceMotion,
    haptics,
    setHaptics,
    hapticsAvailable: isHapticsAvailable(),
  };
}

/**
 * Device-persisted breath pattern, for surfaces where the pattern isn't shared
 * via URL (Drone Mode, Standalone Timer). `storageKey` namespaces the surface
 * (e.g. `am_breath_drone`, `am_breath_timer`).
 */
export function useBreathPattern(
  storageKey: string,
): [BreathPattern | null, (p: BreathPattern | null) => void] {
  const [pattern, setPatternState] = useState<BreathPattern | null>(() => {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as BreathPattern;
    } catch {
      return null;
    }
  });

  const setPattern = useCallback(
    (p: BreathPattern | null) => {
      setPatternState(p);
      if (typeof localStorage === 'undefined') return;
      if (p) localStorage.setItem(storageKey, JSON.stringify(p));
      else localStorage.removeItem(storageKey);
    },
    [storageKey],
  );

  return [pattern, setPattern];
}
