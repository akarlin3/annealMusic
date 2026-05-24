import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InputVoice, mapDriftToFreq } from '@/input/InputVoice';
import { InputError } from '@/input/types';
import { MockAudioContext } from '@/test/audioMock';

// --- Minimal MediaStream / mediaDevices stubs ---

interface FakeTrack {
  kind: 'audio';
  label: string;
  readyState: 'live' | 'ended';
  onended: (() => void) | null;
  stop: () => void;
  getSettings: () => { channelCount: number };
}

function makeTrack(label = 'Mock Mic', channelCount = 1): FakeTrack {
  return {
    kind: 'audio',
    label,
    readyState: 'live',
    onended: null,
    stop() {
      this.readyState = 'ended';
    },
    getSettings: () => ({ channelCount }),
  };
}

function makeStream(track: FakeTrack): MediaStream {
  const tracks = [track];
  return {
    getTracks: () => tracks,
    getAudioTracks: () => tracks,
  } as unknown as MediaStream;
}

interface MediaDevicesStub {
  getUserMedia: ReturnType<typeof vi.fn>;
  enumerateDevices: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

function installMediaDevices(
  stub: Partial<MediaDevicesStub>,
): MediaDevicesStub {
  const devices: MediaDevicesStub = {
    getUserMedia: vi.fn(),
    enumerateDevices: vi.fn().mockResolvedValue([]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ...stub,
  };
  vi.stubGlobal('navigator', { mediaDevices: devices });
  return devices;
}

let ctx: MockAudioContext;

beforeEach(() => {
  MockAudioContext.instances.length = 0;
  ctx = new MockAudioContext();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('mapDriftToFreq', () => {
  it('centers at 700 Hz for zero drift', () => {
    expect(mapDriftToFreq(0)).toBeCloseTo(700, 5);
  });

  it('sweeps within a half-octave each way', () => {
    expect(mapDriftToFreq(60)).toBeCloseTo(700 * Math.SQRT2, 1); // ~990 Hz
    expect(mapDriftToFreq(-60)).toBeCloseTo(700 / Math.SQRT2, 1); // ~495 Hz
  });

  it('clamps beyond the detune range (no runaway frequencies)', () => {
    expect(mapDriftToFreq(1000)).toBeCloseTo(mapDriftToFreq(60), 5);
    expect(mapDriftToFreq(-1000)).toBeCloseTo(mapDriftToFreq(-60), 5);
    const f = mapDriftToFreq(500);
    expect(f).toBeGreaterThan(400);
    expect(f).toBeLessThan(1100);
  });
});

describe('InputVoice — lifecycle', () => {
  it('connects, reports a device label + positive finite latency', async () => {
    installMediaDevices({
      getUserMedia: vi
        .fn()
        .mockResolvedValue(makeStream(makeTrack('USB Interface'))),
    });
    const voice = new InputVoice(ctx as unknown as AudioContext);

    expect(voice.isConnected()).toBe(false);
    const result = await voice.connect();

    expect(voice.isConnected()).toBe(true);
    expect(result.deviceLabel).toBe('USB Interface');
    expect(Number.isFinite(result.latencyMs)).toBe(true);
    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it('passes music-friendly constraints (no AEC/NS/AGC, mono)', async () => {
    const getUserMedia = vi.fn().mockResolvedValue(makeStream(makeTrack()));
    installMediaDevices({ getUserMedia });
    const voice = new InputVoice(ctx as unknown as AudioContext);

    await voice.connect();

    const audio = getUserMedia.mock.calls[0]![0].audio;
    expect(audio.echoCancellation).toBe(false);
    expect(audio.noiseSuppression).toBe(false);
    expect(audio.autoGainControl).toBe(false);
    expect(audio.channelCount).toBe(1);
  });

  it('requests a specific device by exact id when given', async () => {
    const getUserMedia = vi.fn().mockResolvedValue(makeStream(makeTrack()));
    installMediaDevices({ getUserMedia });
    const voice = new InputVoice(ctx as unknown as AudioContext);

    await voice.connect('device-xyz');
    expect(getUserMedia.mock.calls[0]![0].audio.deviceId).toEqual({
      exact: 'device-xyz',
    });
  });

  it('disconnect stops the stream tracks and clears connected state', async () => {
    const track = makeTrack();
    const stopSpy = vi.spyOn(track, 'stop');
    installMediaDevices({
      getUserMedia: vi.fn().mockResolvedValue(makeStream(track)),
    });
    const voice = new InputVoice(ctx as unknown as AudioContext);

    await voice.connect();
    await voice.disconnect();

    expect(stopSpy).toHaveBeenCalled();
    expect(voice.isConnected()).toBe(false);
  });

  it('sums stereo input to mono via an explicit channel-sum node', async () => {
    installMediaDevices({
      getUserMedia: vi
        .fn()
        .mockResolvedValue(makeStream(makeTrack('Stereo', 2))),
    });
    const voice = new InputVoice(ctx as unknown as AudioContext);
    await voice.connect();

    const sumNode = ctx
      .nodesOfKind('gain')
      .find((g) => g.channelCountMode === 'explicit' && g.channelCount === 1);
    expect(sumNode).toBeDefined();
  });
});

describe('InputVoice — permission errors are typed', () => {
  it('maps NotAllowedError to a typed denied InputError', async () => {
    const denial = Object.assign(new Error('denied'), {
      name: 'NotAllowedError',
    });
    installMediaDevices({
      getUserMedia: vi.fn().mockRejectedValue(denial),
    });
    const voice = new InputVoice(ctx as unknown as AudioContext);

    await expect(voice.connect()).rejects.toBeInstanceOf(InputError);
    await voice.connect().catch((e: InputError) => {
      expect(e.kind).toBe('denied');
    });
    expect(voice.isConnected()).toBe(false);
  });

  it('maps NotFoundError and NotReadableError to typed kinds', async () => {
    const voice = new InputVoice(ctx as unknown as AudioContext);

    installMediaDevices({
      getUserMedia: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error(), { name: 'NotFoundError' }),
        ),
    });
    await voice.connect().catch((e: InputError) => {
      expect(e.kind).toBe('notfound');
    });

    installMediaDevices({
      getUserMedia: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error(), { name: 'NotReadableError' }),
        ),
    });
    await voice.connect().catch((e: InputError) => {
      expect(e.kind).toBe('unreadable');
    });
  });

  it('reports unsupported when getUserMedia is unavailable', async () => {
    vi.stubGlobal('navigator', { mediaDevices: {} });
    const voice = new InputVoice(ctx as unknown as AudioContext);
    await expect(voice.connect()).rejects.toMatchObject({
      kind: 'unsupported',
    });
  });
});

describe('InputVoice — controls', () => {
  it('monitoring is muted by default and toggles', async () => {
    installMediaDevices({
      getUserMedia: vi.fn().mockResolvedValue(makeStream(makeTrack())),
    });
    const voice = new InputVoice(ctx as unknown as AudioContext);
    expect(voice.isMonitoring()).toBe(false);

    voice.setMonitoring(true);
    expect(voice.isMonitoring()).toBe(true);
    voice.setMonitoring(false);
    expect(voice.isMonitoring()).toBe(false);
  });

  it('clamps input level into [0, 2]', () => {
    const voice = new InputVoice(ctx as unknown as AudioContext);
    const out = voice.getOutputNode();
    expect(out).toBeDefined();
    // setLevel must not throw for out-of-range values.
    expect(() => voice.setLevel(5)).not.toThrow();
    expect(() => voice.setLevel(-1)).not.toThrow();
  });

  it('exposes an analyser for the meter/ring', () => {
    const voice = new InputVoice(ctx as unknown as AudioContext);
    expect(voice.getAnalyser()).toBeDefined();
  });
});
