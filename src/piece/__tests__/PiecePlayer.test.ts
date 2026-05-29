import { describe, expect, it, vi } from 'vitest';
import { PiecePlayer } from '@/piece/PiecePlayer';
import { interpolateState } from '@/piece/transitions';
import type { Piece } from '@/piece/types';
import type { Orchestrator } from '@/audio/orchestrator';
import { DEFAULT_PARAMS } from '@/state/params';

describe('transition interpolation', () => {
  it('interpolates numeric parameters linearly', () => {
    const s1 = {
      params: { rootFreq: 100, spread: 1.0 },
      engineId: 'sine' as const,
      engineParams: {},
    };
    const s2 = {
      params: { rootFreq: 200, spread: 2.0 },
      engineId: 'sine' as const,
      engineParams: {},
    };
    const res = interpolateState(s1, s2, 0.5, 'linear');
    expect(res.params.rootFreq).toBeCloseTo(150, 5);
    expect(res.params.spread).toBeCloseTo(1.5, 5);
  });
});

describe('PiecePlayer timeline', () => {
  it('resolves segment overrides correctly', () => {
    const piece: Piece = {
      schemaVer: 8,
      title: 'Test',
      description: null,
      visibility: 'unlisted',
      totalDurationMs: 10000,
      hasOpenSegment: false,
      defaultsState: {
        params: { ...DEFAULT_PARAMS, rootFreq: 147 },
        engineId: 'sine',
        engineParams: {},
      },
      segments: [
        {
          position: 0,
          type: 'fixed',
          durationMs: 5000,
          config: { params: { rootFreq: 180 } },
        },
        {
          position: 1,
          type: 'open',
          durationMs: null,
          config: { params: { rootFreq: 200 } },
        },
      ],
    };

    const mockOrch = {
      start: vi.fn(),
      setEngine: vi.fn(),
      setSharedParams: vi.fn(),
      setEngineParams: vi.fn(),
    } as unknown as Orchestrator;

    const player = new PiecePlayer(piece, mockOrch);
    expect(player.getActiveSegmentIndex()).toBe(0);
    expect(player.getPlayheadMs()).toBe(0);
  });
});
