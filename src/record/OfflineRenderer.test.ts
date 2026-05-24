import { describe, expect, it } from 'vitest';
import {
  driftCheckpoints,
  DEFAULT_OPEN_RENDER_SEC,
  isOfflineRenderSupported,
} from '@/record/OfflineRenderer';

describe('OfflineRenderer — drift checkpoints', () => {
  it('spaces checkpoints every 50ms across the duration', () => {
    const cps = driftCheckpoints(1);
    expect(cps[0]).toBeCloseTo(0.05, 5);
    expect(cps).toHaveLength(19); // 0.05 .. 0.95
    expect(Math.max(...cps)).toBeLessThan(1);
  });

  it('returns nothing for a zero-length render', () => {
    expect(driftCheckpoints(0)).toEqual([]);
  });

  it('defaults open renders to 5 minutes', () => {
    expect(DEFAULT_OPEN_RENDER_SEC).toBe(300);
  });

  it('reports offline support based on OfflineAudioContext presence', () => {
    expect(typeof isOfflineRenderSupported()).toBe('boolean');
  });
});
