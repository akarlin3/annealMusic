import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mutable native-platform flag the mocked Capacitor reads.
let nativePlatform = false;
const impact = vi.fn().mockResolvedValue(undefined);

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => nativePlatform },
}));

vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: (...args: unknown[]) => impact(...args) },
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
}));

import {
  isHapticsAvailable,
  pulsePhaseTransition,
} from '@/breath/hapticBridge';

describe('hapticBridge', () => {
  beforeEach(() => {
    impact.mockClear();
  });
  afterEach(() => {
    nativePlatform = false;
  });

  it('reports unavailable on web (non-native)', () => {
    nativePlatform = false;
    expect(isHapticsAvailable()).toBe(false);
  });

  it('is a no-op on web — never calls Haptics.impact', async () => {
    nativePlatform = false;
    await pulsePhaseTransition('inhale');
    expect(impact).not.toHaveBeenCalled();
  });

  it('fires an impact at a phase transition on a native platform', async () => {
    nativePlatform = true;
    expect(isHapticsAvailable()).toBe(true);
    await pulsePhaseTransition('inhale');
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith({ style: 'LIGHT' });
  });
});
