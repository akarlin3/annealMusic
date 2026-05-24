import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Orchestrator } from '@/audio/orchestrator';
import { DEFAULT_PARAMS } from '@/state/params';
import { MockAudioContext } from '@/test/audioMock';

function makeTrack(label = 'Mock Mic'): {
  kind: 'audio';
  label: string;
  readyState: 'live' | 'ended';
  onended: (() => void) | null;
  stop: () => void;
  getSettings: () => { channelCount: number };
} {
  return {
    kind: 'audio',
    label,
    readyState: 'live',
    onended: null,
    stop() {
      this.readyState = 'ended';
    },
    getSettings: () => ({ channelCount: 1 }),
  };
}

function makeStream(): MediaStream {
  const tracks = [makeTrack()];
  return {
    getTracks: () => tracks,
    getAudioTracks: () => tracks,
  } as unknown as MediaStream;
}

function installMediaDevices(
  getUserMedia: ReturnType<typeof vi.fn> = vi
    .fn()
    .mockResolvedValue(makeStream()),
): void {
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia,
      enumerateDevices: vi.fn().mockResolvedValue([]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
}

beforeEach(() => {
  vi.stubGlobal('AudioContext', MockAudioContext);
  vi.useFakeTimers();
  MockAudioContext.instances.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Orchestrator — input integration', () => {
  it('connects input with no session running (input before Begin)', async () => {
    installMediaDevices(vi.fn().mockResolvedValue(makeStream()));
    const orch = new Orchestrator(DEFAULT_PARAMS);

    expect(orch.getInputVoice()).toBeNull();
    expect(orch.isRunning()).toBe(false);

    const meta = await orch.connectInput();
    expect(meta.deviceLabel).toBe('Mock Mic');
    expect(orch.getInputVoice()?.isConnected()).toBe(true);
    // A core context exists even though no engine/session runs.
    expect(MockAudioContext.instances.length).toBe(1);

    await orch.disconnectInput();
    expect(orch.getInputVoice()).toBeNull();
  });

  it('keeps the audio core alive across a session stop while input is connected', async () => {
    installMediaDevices(vi.fn().mockResolvedValue(makeStream()));
    const orch = new Orchestrator(DEFAULT_PARAMS);

    await orch.connectInput();
    const ctx = MockAudioContext.instances.at(-1)!;

    orch.start();
    expect(orch.isRunning()).toBe(true);

    const stopped = orch.stop();
    vi.advanceTimersByTime(2200);
    await stopped;

    // Session stopped, but the input + context survive (not closed).
    expect(orch.isRunning()).toBe(false);
    expect(ctx.state).not.toBe('closed');
    expect(orch.getInputVoice()?.isConnected()).toBe(true);
  });

  it('closes the core on session stop when input is not connected', async () => {
    const orch = new Orchestrator(DEFAULT_PARAMS);
    orch.start();
    const ctx = MockAudioContext.instances.at(-1)!;

    const stopped = orch.stop();
    vi.advanceTimersByTime(2200);
    await stopped;

    expect(ctx.state).toBe('closed');
  });

  it('routes the input output into the shared post-fx filter', async () => {
    installMediaDevices(vi.fn().mockResolvedValue(makeStream()));
    const orch = new Orchestrator(DEFAULT_PARAMS);
    await orch.connectInput();

    const ctx = MockAudioContext.instances.at(-1)!;
    const filter = ctx.nodesOfKind('filter')[0]!; // post-fx lowpass is first filter
    const reachesFilter = ctx
      .nodesOfKind('gain')
      .some((g) => g.connections.includes(filter));
    expect(reachesFilter).toBe(true);
  });

  it('feeds mean drift to the input voice each tick', async () => {
    installMediaDevices(vi.fn().mockResolvedValue(makeStream()));
    const orch = new Orchestrator({ ...DEFAULT_PARAMS, drift: 1 });
    await orch.connectInput();

    const voice = orch.getInputVoice()!;
    const spy = vi.spyOn(voice, 'setDriftModulation');
    vi.advanceTimersByTime(150); // three drift ticks
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect(Number.isFinite(call[0])).toBe(true);
    }

    await orch.disconnectInput();
  });

  it('propagates a typed denial and leaves no lingering core', async () => {
    installMediaDevices(
      vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('no'), { name: 'NotAllowedError' }),
        ),
    );
    const orch = new Orchestrator(DEFAULT_PARAMS);

    await expect(orch.connectInput()).rejects.toMatchObject({ kind: 'denied' });
    expect(orch.getInputVoice()).toBeNull();
    // Core was torn down after the failed first connect (no session running).
    const ctx = MockAudioContext.instances.at(-1);
    expect(ctx?.state).toBe('closed');
  });
});
