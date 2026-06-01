import { enumerateInputDevices } from '@/input/devices';
import { estimateLatencyMs } from '@/input/latency';
import {
  InputError,
  type ConnectResult,
  type InputErrorKind,
  type InputVoiceEvent,
} from '@/input/types';

// --- Voice processing chain constants (see docs/v0.5-PLAN.md §4) ---
const HIGHPASS_HZ = 80;
const HIGHPASS_Q = 0.7;
const COMP_THRESHOLD = -24;
const COMP_RATIO = 3;
const COMP_KNEE = 30;
const COMP_ATTACK = 0.01;
const COMP_RELEASE = 0.25;
const DRIFT_FILTER_BASE_HZ = 700;
const DRIFT_FILTER_Q = 1.2;
const DRIFT_FILTER_GAIN_DB = 4;
/** Half-octave sweep each way → ~495 Hz … ~990 Hz. */
const DRIFT_FILTER_OCTAVE_RANGE = 0.5;
/** Normalizes mean detune; matches the drift clamp in `drift.ts`. */
const DETUNE_NORM = 60;
const MONITOR_RAMP_TC = 0.08;
const DRIFT_SMOOTH_TC = 0.08;
const LEVEL_SMOOTH_TC = 0.05;
const MAX_LEVEL = 2;

/**
 * Map the drift loop's mean detune (cents) to the drift-modulated peaking
 * filter's center frequency. The live voice then breathes on the same field as
 * the engine partials — the texture-binding move. Exported for unit testing.
 */
export function mapDriftToFreq(meanCents: number): number {
  const n = Math.max(-1, Math.min(1, meanCents / DETUNE_NORM));
  return DRIFT_FILTER_BASE_HZ * Math.pow(2, n * DRIFT_FILTER_OCTAVE_RANGE);
}

function errorKindFor(name: string): InputErrorKind | null {
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'notfound';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'unreadable';
    default:
      return null;
  }
}

function toInputError(err: unknown): InputError {
  const name = (err as { name?: string } | null)?.name ?? '';
  const kind = errorKindFor(name);
  if (kind === 'denied') {
    return new InputError('denied', 'Microphone permission was denied.');
  }
  if (kind === 'notfound') {
    return new InputError('notfound', 'No input device was found.');
  }
  if (kind === 'unreadable') {
    return new InputError('unreadable', 'The input device is already in use.');
  }
  const message =
    (err as { message?: string } | null)?.message ??
    'Could not connect to the input device.';
  return new InputError('unknown', message);
}

/**
 * Owns the live-input voice chain and its `MediaStream`. The static processing
 * chain (high-pass → compressor → soft-clip → level → drift filter → analyser +
 * monitor gate) is built once in the constructor; `connect()` only opens (and on
 * device switch, re-opens) the `MediaStreamSource` feeding the chain head, so the
 * output node is stable across device switches. The orchestrator routes
 * `getOutputNode()` into the shared post-fx chain and feeds `setDriftModulation`.
 */
export class InputVoice {
  private readonly ctx: AudioContext;

  // Static chain (built once; survives device switches).
  private readonly highpass: BiquadFilterNode;
  private readonly compressor: DynamicsCompressorNode;
  private readonly shaper: WaveShaperNode;
  private readonly voiceGain: GainNode;
  private readonly driftFilter: BiquadFilterNode;
  private readonly analyser: AnalyserNode;
  private readonly monitorGain: GainNode;
  // Stable post-processing tap for loop capture (independent of the monitor gate).
  private readonly captureTap: GainNode;

  // Per-connection source (rebuilt on device switch).
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private channelSum: GainNode | null = null;
  private currentDeviceId: string | undefined;

  private monitoring = false;
  private connected = false;
  private reconnecting = false;

  private readonly listeners = new Set<(e: InputVoiceEvent) => void>();
  private readonly onDeviceChange = (): void => {
    void this.handleDeviceChange();
  };

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    this.highpass = ctx.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.setValueAtTime(HIGHPASS_HZ, ctx.currentTime);
    this.highpass.Q.setValueAtTime(HIGHPASS_Q, ctx.currentTime);

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(COMP_THRESHOLD, ctx.currentTime);
    this.compressor.ratio.setValueAtTime(COMP_RATIO, ctx.currentTime);
    this.compressor.knee.setValueAtTime(COMP_KNEE, ctx.currentTime);
    this.compressor.attack.setValueAtTime(COMP_ATTACK, ctx.currentTime);
    this.compressor.release.setValueAtTime(COMP_RELEASE, ctx.currentTime);

    // Soft-clip shaper, bypassed by default (curve null ⇒ pass-through).
    this.shaper = ctx.createWaveShaper();

    this.voiceGain = ctx.createGain();
    this.voiceGain.gain.setValueAtTime(1, ctx.currentTime);

    this.driftFilter = ctx.createBiquadFilter();
    this.driftFilter.type = 'peaking';
    this.driftFilter.frequency.setValueAtTime(
      DRIFT_FILTER_BASE_HZ,
      ctx.currentTime,
    );
    this.driftFilter.Q.setValueAtTime(DRIFT_FILTER_Q, ctx.currentTime);
    this.driftFilter.gain.setValueAtTime(DRIFT_FILTER_GAIN_DB, ctx.currentTime);

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.6;

    this.monitorGain = ctx.createGain();
    this.monitorGain.gain.setValueAtTime(0, ctx.currentTime); // muted by default — feedback-safe

    this.captureTap = ctx.createGain();
    this.captureTap.gain.setValueAtTime(1, ctx.currentTime);

    this.highpass
      .connect(this.compressor)
      .connect(this.shaper)
      .connect(this.voiceGain)
      .connect(this.driftFilter);
    // Analyser taps pre-gate so the meter + visualizer ring react even when muted.
    this.driftFilter.connect(this.analyser);
    // The only path to the speakers, gated by the monitor toggle.
    this.driftFilter.connect(this.monitorGain);
    // Loop capture taps the fully-processed voice regardless of monitor state.
    this.driftFilter.connect(this.captureTap);
  }

  /** Subscribe to device-change / loss / error events. Returns an unsubscribe. */
  on(listener: (e: InputVoiceEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(e: InputVoiceEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  /**
   * Request permission (if needed) for `deviceId` (or the default device) and
   * wire its `MediaStreamSource` into the chain head. Calling again switches
   * device on an existing gesture — no new prompt once permission is granted.
   */
  async connect(deviceId?: string): Promise<ConnectResult> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new InputError(
        'unsupported',
        'Audio input is not supported in this browser.',
      );
    }

    // Tear down any previous source (first connect is a no-op here).
    this.teardownSource();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
        video: false,
      });
    } catch (err) {
      throw toInputError(err);
    }

    this.stream = stream;
    this.currentDeviceId = deviceId;

    const track = stream.getAudioTracks()[0];
    const settings = track?.getSettings?.() ?? {};
    const channelCount = settings.channelCount ?? 1;

    const source = this.ctx.createMediaStreamSource(stream);
    this.source = source;

    // Stereo (or multi-channel) devices are summed to mono before the chain.
    if (channelCount > 1) {
      const sum = this.ctx.createGain();
      sum.channelCountMode = 'explicit';
      sum.channelCount = 1;
      this.channelSum = sum;
      source.connect(sum).connect(this.highpass);
    } else {
      source.connect(this.highpass);
    }

    if (track) {
      track.onended = (): void => {
        void this.handleDeviceChange();
      };
    }
    navigator.mediaDevices.addEventListener?.(
      'devicechange',
      this.onDeviceChange,
    );

    this.connected = true;
    const deviceLabel = track?.label || 'Input device';
    return { deviceLabel, latencyMs: estimateLatencyMs(this.ctx) };
  }

  /** Stop the stream, detach listeners, tear down the source nodes. */
  async disconnect(): Promise<void> {
    navigator.mediaDevices?.removeEventListener?.(
      'devicechange',
      this.onDeviceChange,
    );
    this.teardownSource();
    this.connected = false;
    this.currentDeviceId = undefined;
    this.emit({ type: 'disconnected', reason: 'manual' });
    return Promise.resolve();
  }

  private teardownSource(): void {
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        // already detached
      }
      this.source = null;
    }
    if (this.channelSum) {
      try {
        this.channelSum.disconnect();
      } catch {
        // already detached
      }
      this.channelSum = null;
    }
    if (this.stream) {
      for (const t of this.stream.getTracks()) {
        t.onended = null;
        t.stop();
      }
      this.stream = null;
    }
  }

  /**
   * On a `devicechange` or track end, re-enumerate; if our active device has
   * vanished (or the track died), gracefully reconnect to the default device and
   * emit `device-changed`. On failure, emit `error` — the audio graph stays up.
   */
  private async handleDeviceChange(): Promise<void> {
    if (!this.connected || this.reconnecting) return;

    let stillPresent = true;
    if (this.currentDeviceId !== undefined) {
      try {
        const devices = await enumerateInputDevices();
        stillPresent = devices.some((d) => d.deviceId === this.currentDeviceId);
      } catch {
        stillPresent = true; // can't tell — assume present, rely on track state
      }
    }

    const track = this.stream?.getAudioTracks()[0];
    const trackLive = track ? track.readyState === 'live' : false;
    if (stillPresent && trackLive) return; // nothing to recover

    this.reconnecting = true;
    try {
      const result = await this.connect(undefined); // fall back to default
      this.emit({ type: 'device-changed', deviceLabel: result.deviceLabel });
    } catch (err) {
      this.connected = false;
      const error = err instanceof InputError ? err : toInputError(err);
      this.emit({ type: 'error', error });
    } finally {
      this.reconnecting = false;
    }
  }

  /** User "Input Level" (0..2, ≈ −∞..+6 dB), smoothed to avoid zipper noise. */
  setLevel(gain: number): void {
    const g = Math.max(0, Math.min(MAX_LEVEL, gain));
    this.voiceGain.gain.setTargetAtTime(
      g,
      this.ctx.currentTime,
      LEVEL_SMOOTH_TC,
    );
  }

  /** Toggle speaker monitoring (default off). Ramps the gate to avoid clicks. */
  setMonitoring(enabled: boolean): void {
    this.monitoring = enabled;
    this.monitorGain.gain.setTargetAtTime(
      enabled ? 1 : 0,
      this.ctx.currentTime,
      MONITOR_RAMP_TC,
    );
  }

  isMonitoring(): boolean {
    return this.monitoring;
  }

  /** Drive the drift-modulated filter center from the loop's mean detune (cents). */
  setDriftModulation(meanCents: number): void {
    this.driftFilter.frequency.setTargetAtTime(
      mapDriftToFreq(meanCents),
      this.ctx.currentTime,
      DRIFT_SMOOTH_TC,
    );
  }

  /** The single node the orchestrator routes into the shared post-fx chain. */
  getOutputNode(): AudioNode {
    return this.monitorGain;
  }

  /**
   * Post-processing tap (compressed, HP-filtered, drift-modulated) for loop
   * capture. Independent of the monitor gate, so loops capture the processed
   * voice whether or not monitoring is on.
   */
  getCaptureTap(): AudioNode {
    return this.captureTap;
  }

  /** Pre-gate analyser for the level meter + visualizer ring. */
  getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
