/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ListeningSessionPlayer } from '../ListeningSessionPlayer';
import { playBell } from '../punctuation';
import type { Piece } from '@/piece/types';
import type { Orchestrator } from '@/audio/orchestrator';
import { DEFAULT_PARAMS } from '@/state/params';

describe('playBell Punctuation', () => {
  it('synthesizes a dual-resonator bell successfully', () => {
    const mockChannelData = new Float32Array(100);
    const mockBuffer = {
      getChannelData: vi.fn().mockReturnValue(mockChannelData),
    };

    const mockSource = {
      connect: vi.fn().mockReturnThis(),
      start: vi.fn(),
      buffer: null as any,
    };

    const mockFilter = {
      type: 'bandpass',
      frequency: { value: 0, setValueAtTime: vi.fn() },
      Q: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn().mockReturnThis(),
    };

    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn().mockReturnThis(),
    };

    const mockCtx = {
      sampleRate: 48000,
      currentTime: 10,
      createBuffer: vi.fn().mockReturnValue(mockBuffer),
      createBufferSource: vi.fn().mockReturnValue(mockSource),
      createBiquadFilter: vi.fn().mockReturnValue(mockFilter),
      createGain: vi.fn().mockReturnValue(mockGain),
    } as unknown as BaseAudioContext;

    const mockDestination = {} as AudioNode;

    playBell(mockCtx, mockDestination, 660, 10);

    expect(mockCtx.createBuffer).toHaveBeenCalled();
    expect(mockCtx.createBufferSource).toHaveBeenCalled();
    expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(2);
    expect(mockCtx.createGain).toHaveBeenCalledTimes(2);
    expect(mockSource.start).toHaveBeenCalledWith(10);
  });
});

describe('ListeningSessionPlayer', () => {
  let mockOrch: any;
  let piece: Piece;
  let mockBuffer: any;
  let mockTime = 1000;

  beforeEach(() => {
    mockTime = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => mockTime);

    piece = {
      schemaVer: 16,
      tempoBpm: null,
      title: 'Meditation Journey',
      description: 'A deep sitting piece.',
      visibility: 'unlisted',
      totalDurationMs: 10000,
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
          config: { params: {} },
        },
        {
          position: 1,
          type: 'fixed',
          durationMs: 5000,
          config: { params: {} },
        },
      ],
    };

    const mockChannelData = new Float32Array(100);
    mockBuffer = {
      getChannelData: vi.fn().mockReturnValue(mockChannelData),
    };

    const mockSource = {
      connect: vi.fn().mockReturnThis(),
      start: vi.fn(),
      buffer: null as any,
    };

    const mockFilter = {
      type: 'bandpass',
      frequency: { value: 0, setValueAtTime: vi.fn() },
      Q: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn().mockReturnThis(),
    };

    const mockGainNode = {
      gain: {
        value: 1.0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn().mockReturnThis(),
    };

    const mockCtx = {
      currentTime: 0,
      sampleRate: 48000,
      createBuffer: vi.fn().mockReturnValue(mockBuffer),
      createBufferSource: vi.fn().mockReturnValue(mockSource),
      createBiquadFilter: vi.fn().mockReturnValue(mockFilter),
      createGain: vi.fn().mockReturnValue(mockGainNode),
    } as any;

    mockOrch = {
      start: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
      isRunning: vi.fn().mockReturnValue(true),
      setTempoBpm: vi.fn(),
      setEngine: vi.fn(),
      setSharedParams: vi.fn(),
      setEngineParams: vi.fn(),
      getNodes: vi
        .fn()
        .mockReturnValue({ masterVol: mockGainNode, master: {} as any }),
      getRecordingTap: vi.fn().mockReturnValue({
        ctx: mockCtx,
        node: mockGainNode as any,
      }),
      getAnalyser: vi.fn().mockReturnValue({}),
    } as unknown as Orchestrator;
  });

  it('calculates duration and handles opening bell successfully', () => {
    const config = {
      piece,
      settleInMs: 3000,
      integrationMs: 3000,
      bellSchedule: [
        { bellId: 'zen_bell_rin', trigger: 'at-start' as const, volume: 0.7 },
      ],
    };

    const player = new ListeningSessionPlayer(config, mockOrch);
    expect(player.getTotalDurationMs()).toBe(10000); // exactly the piece duration
    expect(player.getSessionState()).toBe('idle');

    player.start();
    expect(mockOrch.start).toHaveBeenCalled();
    expect(player.getSessionState()).toBe('sounding');

    // Fast forward by 4.1s
    mockTime = 5100;
    (player as any).tick();
    expect(player.getSessionState()).toBe('sounding');
  });

  it('computes correct fade factors for settle-in and integration', () => {
    const config = {
      piece,
      settleInMs: 2000,
      integrationMs: 4000,
      bellSchedule: [],
    };

    const player = new ListeningSessionPlayer(config, mockOrch);
    expect(player.getTotalDurationMs()).toBe(10000);

    player.start(); // elapsedMs starts at 0, lastTickTime=1000
    expect(player.getSessionState()).toBe('sounding');

    const masterVol = mockOrch.getNodes().masterVol;

    // Settle-in: mock PiecePlayer to return 1000ms elapsed (50% of settleInMs)
    vi.spyOn(player['piecePlayer'], 'getActiveSegmentIndex').mockReturnValue(0);
    vi.spyOn(player['piecePlayer'], 'getPlayheadMs').mockReturnValue(1000);

    mockTime = 2000;
    (player as any).tick();
    expect(masterVol.gain.setValueAtTime).toHaveBeenLastCalledWith(
      expect.closeTo(0.5, 2),
      expect.any(Number),
    );

    // Middle portion: mock PiecePlayer to return 4000ms elapsed
    vi.spyOn(player['piecePlayer'], 'getPlayheadMs').mockReturnValue(4000);
    mockTime = 5000;
    (player as any).tick();
    expect(masterVol.gain.setValueAtTime).toHaveBeenLastCalledWith(
      expect.closeTo(1.0, 2),
      expect.any(Number),
    );

    // Integration: mock PiecePlayer to return segment 1 (index 1) at 3000ms elapsed -> total 8000ms elapsed
    // 10000 - 8000 = 2000ms remaining (50% of integrationMs)
    vi.spyOn(player['piecePlayer'], 'getActiveSegmentIndex').mockReturnValue(1);
    vi.spyOn(player['piecePlayer'], 'getPlayheadMs').mockReturnValue(3000);
    mockTime = 9000;
    (player as any).tick();
    expect(masterVol.gain.setValueAtTime).toHaveBeenLastCalledWith(
      expect.closeTo(0.5, 2),
      expect.any(Number),
    );
  });

  it('executes pause and resume correctly', () => {
    const config = {
      piece,
      settleInMs: 2000,
      integrationMs: 4000,
      bellSchedule: [],
    };

    const player = new ListeningSessionPlayer(config, mockOrch);
    player.start(); // elapsedMs = 0, lastTickTime=1000

    mockTime = 2000;
    (player as any).tick(); // elapsedMs = 1000
    const elapsedBeforePause = player.getElapsedMs();

    player.pause();
    expect(player.getElapsedMs()).toBe(elapsedBeforePause);

    // Fast-forward real time while paused -> elapsed should not advance on tick
    mockTime = 7000;
    (player as any).tick();
    expect(player.getElapsedMs()).toBe(elapsedBeforePause);

    player.resume(); // lastTickTime=7000
    mockTime = 8000;
    (player as any).tick();
    expect(player.getElapsedMs()).toBeGreaterThan(elapsedBeforePause);
  });
});
