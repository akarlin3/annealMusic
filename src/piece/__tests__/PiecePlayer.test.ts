/* eslint-disable @typescript-eslint/no-explicit-any */
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
      tempoBpm: null,
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

  it('overrides root frequency based on notation notes during playback', () => {
    const piece: Piece = {
      schemaVer: 10,
      tempoBpm: null,
      title: 'Notation Test',
      description: null,
      visibility: 'unlisted',
      totalDurationMs: 6000,
      hasOpenSegment: false,
      defaultsState: {
        params: { ...DEFAULT_PARAMS, rootFreq: 150 },
        engineId: 'sine',
        engineParams: {},
      },
      segments: [
        {
          position: 0,
          type: 'fixed',
          durationMs: 6000,
          config: { params: {} },
        },
      ],
      notation: [
        { id: 'note-0', onset_ms: 2000, duration_ms: 2000, pitch_midi: 60 }, // C4 ~ 261.63 Hz
      ],
    };

    const mockOrch = {
      start: vi.fn(),
      setEngine: vi.fn(),
      setSharedParams: vi.fn(),
      setEngineParams: vi.fn(),
      setTempoBpm: vi.fn(),
    } as unknown as Orchestrator;

    const player = new PiecePlayer(piece, mockOrch);

    let mockTime = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => mockTime);

    player.start(); // sets lastTickTime = 1000 and runs first tick

    // At t = 0 (globalPlayheadMs = 0), no active note, defaults to segment rootFreq (150)
    expect(mockOrch.setSharedParams).toHaveBeenCalledWith(
      expect.objectContaining({ rootFreq: 150 }),
      false,
    );

    // Advance by 2.5 seconds (globalPlayheadMs = 2500), note-0 is active (C4 ~ 261.63 Hz)
    mockTime = 3500;
    (player as unknown as { tick: () => void }).tick();

    // At t = 2500ms, note-0 is active, frequency is overridden to C4 ~ 261.63
    expect(mockOrch.setSharedParams).toHaveBeenLastCalledWith(
      expect.objectContaining({ rootFreq: expect.closeTo(261.63, 1) }),
      false,
    );

    // Advance by another 2 seconds (globalPlayheadMs = 4500), note-0 is released
    // Since segment does not override rootFreq, last notation pitch persists!
    mockTime = 5500;
    (player as unknown as { tick: () => void }).tick();

    expect(mockOrch.setSharedParams).toHaveBeenLastCalledWith(
      expect.objectContaining({ rootFreq: expect.closeTo(261.63, 1) }),
      false,
    );
  });

  it('modulates parameters during a meta-arc segment', () => {
    const piece: Piece = {
      schemaVer: 11,
      tempoBpm: null,
      title: 'Meta-Arc Test',
      description: null,
      visibility: 'unlisted',
      totalDurationMs: 5000,
      hasOpenSegment: false,
      defaultsState: {
        params: { ...DEFAULT_PARAMS, rootFreq: 150, brightness: 0.5 },
        engineId: 'sine',
        engineParams: {},
      },
      segments: [
        {
          position: 0,
          type: 'meta-arc',
          durationMs: 5000,
          config: {
            kind: 'random-walk',
            seed: 12345,
            randomWalk: {
              params: ['rootFreq', 'brightness'],
              driftStrength: 0.2,
              meanReversion: 0.1,
              steps: 10,
              bounds: {
                rootFreq: { min: 0.5, max: 2.0 },
                brightness: { min: 0.1, max: 0.9 },
              },
            },
          },
        },
      ],
    };

    const mockOrch = {
      start: vi.fn(),
      setEngine: vi.fn(),
      setSharedParams: vi.fn(),
      setEngineParams: vi.fn(),
      setTempoBpm: vi.fn(),
    } as unknown as Orchestrator;

    const player = new PiecePlayer(piece, mockOrch);
    player.start(); // ticks at t=0

    // Expect setSharedParams to be called at t=0
    expect(mockOrch.setSharedParams).toHaveBeenCalled();

    // Advance playhead and tick
    vi.spyOn(performance, 'now').mockImplementation(() => 2000);
    (player as unknown as { tick: () => void }).tick();

    // Since it's a random-walk meta-arc, the value of rootFreq is modulated!
    expect(mockOrch.setSharedParams).toHaveBeenLastCalledWith(
      expect.objectContaining({
        rootFreq: expect.any(Number),
        brightness: expect.any(Number),
      }),
      false,
    );
  });

  describe('PiecePlayer variations', () => {
    it('applies variations and allows seed re-rolling', () => {
      const piece: Piece = {
        schemaVer: 12,
        tempoBpm: null,
        title: 'Variations Player Test',
        description: null,
        visibility: 'unlisted',
        totalDurationMs: 5000,
        hasOpenSegment: false,
        defaultsState: {
          params: { ...DEFAULT_PARAMS, brightness: 0.5 },
          engineId: 'sine',
          engineParams: {},
        },
        variations: [
          {
            id: 'vp-brightness',
            paramKey: 'brightness',
            constraint: { type: 'range', min: 0.2, max: 0.8 },
            rule: 'per-play',
          },
        ],
        segments: [
          {
            position: 0,
            type: 'fixed',
            durationMs: 5000,
            config: { params: {} },
          },
        ],
      };

      const mockOrch = {
        start: vi.fn(),
        setEngine: vi.fn(),
        setSharedParams: vi.fn(),
        setEngineParams: vi.fn(),
        setTempoBpm: vi.fn(),
      } as unknown as Orchestrator;

      const player = new PiecePlayer(piece, mockOrch);
      player.start();

      // Retrieve first tick shared params call
      const firstCallParams = (mockOrch.setSharedParams as any).mock
        .calls[0][0];
      expect(firstCallParams.brightness).toBeGreaterThanOrEqual(0.2);
      expect(firstCallParams.brightness).toBeLessThanOrEqual(0.8);

      // Re-roll seed and check changes
      player.reRoll();

      const secondCallParams = (mockOrch.setSharedParams as any).mock
        .calls[1][0];
      expect(secondCallParams.brightness).toBeGreaterThanOrEqual(0.2);
      expect(secondCallParams.brightness).toBeLessThanOrEqual(0.8);
    });
  });

  describe('PiecePlayer movements navigation', () => {
    it('skips to movement and replays current movement correctly', () => {
      const piece: Piece = {
        schemaVer: 13,
        tempoBpm: null,
        title: 'Movements Nav Test',
        description: null,
        visibility: 'unlisted',
        totalDurationMs: 15000,
        hasOpenSegment: false,
        defaultsState: {
          params: DEFAULT_PARAMS,
          engineId: 'sine',
          engineParams: {},
        },
        segments: [
          {
            position: 0,
            type: 'fixed',
            durationMs: 5000,
            config: { params: { rootFreq: 100 } },
          },
          {
            position: 1,
            type: 'fixed',
            durationMs: 5000,
            config: { params: { rootFreq: 200 } },
          },
          {
            position: 2,
            type: 'fixed',
            durationMs: 5000,
            config: { params: { rootFreq: 300 } },
          },
        ],
        movements: [
          {
            name: 'Movement I',
            startSegmentIndex: 0,
            endSegmentIndex: 1,
          },
          {
            name: 'Movement II',
            startSegmentIndex: 2,
            endSegmentIndex: 2,
          },
        ],
      };

      const mockOrch = {
        start: vi.fn(),
        setEngine: vi.fn(),
        setSharedParams: vi.fn(),
        setEngineParams: vi.fn(),
        setTempoBpm: vi.fn(),
      } as unknown as Orchestrator;

      const player = new PiecePlayer(piece, mockOrch);
      player.start();

      // Initially at segment 0
      expect(player.getActiveSegmentIndex()).toBe(0);

      // Skip to Movement II (segment 2)
      player.skipToMovement(1);
      expect(player.getActiveSegmentIndex()).toBe(2);
      expect(player.getPlayheadMs()).toBe(0);

      // Skip to Movement I (segment 0)
      player.skipToMovement(0);
      expect(player.getActiveSegmentIndex()).toBe(0);

      // Manually set segment index to 1 (still inside Movement I)
      (player as any).activeSegmentIdx = 1;
      (player as any).playheadMs = 2500;

      // Replay current movement should jump to start of Movement I (segment 0)
      player.replayCurrentMovement();
      expect(player.getActiveSegmentIndex()).toBe(0);
      expect(player.getPlayheadMs()).toBe(0);
    });
  });

  describe('PiecePlayer automation and priority overrides', () => {
    it('evaluates automation points correctly with different interpolation modes', () => {
      const piece: Piece = {
        schemaVer: 14,
        tempoBpm: null,
        title: 'Automation Priority Test',
        description: null,
        visibility: 'unlisted',
        totalDurationMs: 10000,
        hasOpenSegment: false,
        defaultsState: {
          params: { ...DEFAULT_PARAMS, brightness: 0.5, space: 0.2 },
          engineId: 'sine',
          engineParams: {},
        },
        segments: [
          {
            position: 0,
            type: 'fixed',
            durationMs: 10000,
            config: { params: { brightness: 0.3 } },
          },
        ],
        automationTracks: [
          {
            id: 'track-brightness',
            paramKey: 'brightness',
            points: [
              { id: 'p0', timeMs: 1000, value: 0.4, interpolation: 'linear' },
              { id: 'p1', timeMs: 3000, value: 0.8, interpolation: 'linear' },
              { id: 'p2', timeMs: 5000, value: 0.2, interpolation: 'hold' },
              {
                id: 'p3',
                timeMs: 7000,
                value: 0.9,
                interpolation: 'exponential',
              },
              {
                id: 'p4',
                timeMs: 9000,
                value: 0.1,
                interpolation: 'exponential',
              },
            ],
          },
        ],
      };

      const mockOrch = {
        start: vi.fn(),
        setEngine: vi.fn(),
        setSharedParams: vi.fn(),
        setEngineParams: vi.fn(),
        setTempoBpm: vi.fn(),
      } as unknown as Orchestrator;

      const player = new PiecePlayer(piece, mockOrch);

      let mockTime = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => mockTime);
      player.start(); // ticks at t=0

      // Before first point (t=500ms): evaluates to first point value (0.4)
      mockTime = 1500;
      (player as any).tick();
      expect(mockOrch.setSharedParams).toHaveBeenLastCalledWith(
        expect.objectContaining({ brightness: 0.4 }),
        false,
      );

      // Linear interpolation (t=2000ms, halfway between 1000ms [0.4] and 3000ms [0.8]): evaluates to 0.6
      mockTime = 3000;
      (player as any).tick();
      expect(mockOrch.setSharedParams).toHaveBeenLastCalledWith(
        expect.objectContaining({ brightness: expect.closeTo(0.6, 2) }),
        false,
      );

      // Hold interpolation (t=6000ms, between 5000ms [0.2, hold] and 7000ms [0.9]): evaluates to 0.2
      mockTime = 7000;
      (player as any).tick();
      expect(mockOrch.setSharedParams).toHaveBeenLastCalledWith(
        expect.objectContaining({ brightness: 0.2 }),
        false,
      );

      // Exponential interpolation (t=8000ms, halfway between 7000ms [0.9] and 9000ms [0.1]): evaluates to 0.9 * sqrt(0.1 / 0.9) = 0.3
      mockTime = 9000;
      (player as any).tick();
      expect(mockOrch.setSharedParams).toHaveBeenLastCalledWith(
        expect.objectContaining({ brightness: expect.closeTo(0.3, 2) }),
        false,
      );
    });

    it('resolves notation > automation > segment > defaults priority correctly', () => {
      const piece: Piece = {
        schemaVer: 14,
        tempoBpm: null,
        title: 'Full Priority Test',
        description: null,
        visibility: 'unlisted',
        totalDurationMs: 10000,
        hasOpenSegment: false,
        defaultsState: {
          params: { ...DEFAULT_PARAMS, rootFreq: 150, brightness: 0.5 },
          engineId: 'sine',
          engineParams: {},
        },
        segments: [
          {
            position: 0,
            type: 'fixed',
            durationMs: 10000,
            config: { params: { rootFreq: 180, brightness: 0.3 } }, // segment overrides
          },
        ],
        automationTracks: [
          {
            id: 'track-rootFreq',
            paramKey: 'rootFreq',
            points: [
              { id: 'p0', timeMs: 2000, value: 220, interpolation: 'hold' }, // automation override
            ],
          },
        ],
        notation: [
          { id: 'n0', onset_ms: 4000, duration_ms: 2000, pitch_midi: 69 }, // notation override A4=440Hz
        ],
      };

      const mockOrch = {
        start: vi.fn(),
        setEngine: vi.fn(),
        setSharedParams: vi.fn(),
        setEngineParams: vi.fn(),
        setTempoBpm: vi.fn(),
      } as unknown as Orchestrator;

      const player = new PiecePlayer(piece, mockOrch);
      let mockTime = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => mockTime);
      player.start();

      // At t=500ms (globalPlayheadMs=0): segment overrides defaults for brightness (0.3), automation overrides segment for rootFreq (220)
      expect(mockOrch.setSharedParams).toHaveBeenLastCalledWith(
        expect.objectContaining({ brightness: 0.3, rootFreq: 220 }),
        false,
      );

      // At t=3500ms (globalPlayheadMs=2500): automation overrides segment for rootFreq -> 220
      mockTime = 3500;
      (player as any).tick();
      expect(mockOrch.setSharedParams).toHaveBeenLastCalledWith(
        expect.objectContaining({ rootFreq: 220 }),
        false,
      );

      // At t=6000ms (globalPlayheadMs=5000): notation overrides automation for rootFreq -> A4 (440)
      mockTime = 6000;
      (player as any).tick();
      expect(mockOrch.setSharedParams).toHaveBeenLastCalledWith(
        expect.objectContaining({ rootFreq: 440 }),
        false,
      );
    });
  });
});
