import { readRms } from '@/input/meter';
import { GranularPlayer } from '@/loop/GranularPlayer';
import { SeamLoopPlayer } from '@/loop/SeamLoopPlayer';
import {
  createWorkletCapture,
  type CaptureController,
  type CaptureFactory,
} from '@/loop/capture';
import {
  CAPTURE_TRIGGER_RMS,
  MAX_CAPTURE_SEC,
  MIN_CAPTURE_SEC,
  type GrainParams,
  type SlotConfig,
  type SlotId,
  type SlotState,
} from '@/loop/types';

const MUTE_RAMP_TC = 0.06;
const ARM_POLL_MS = 50;

/**
 * Owns one loop slot's full lifecycle: arm → capture → loop playback → freeze
 * (granular) → mute → clear. Routes through a per-slot mute gain into the shared
 * loop bus, and exposes a post-mute analyser for the level meter + visualizer.
 * Knows nothing about React or the URL — config in / state-change events out.
 */
export class LoopSlot {
  readonly id: SlotId;
  private state: SlotState = 'empty';
  private buffer: AudioBuffer | null = null;

  private readonly slotGain: GainNode;
  private readonly analyser: AnalyserNode;

  private seam: SeamLoopPlayer | null = null;
  private granular: GranularPlayer | null = null;

  private armSource: AudioNode | null = null;
  private armAnalyser: AnalyserNode | null = null;
  private armTimer: ReturnType<typeof setInterval> | null = null;
  private capture: CaptureController | null = null;
  private committing = false;
  private meanDrift = 0;

  private readonly listeners = new Set<(s: SlotState) => void>();

  constructor(
    id: SlotId,
    private readonly ctx: AudioContext,
    output: AudioNode,
    private config: SlotConfig,
    private readonly captureFactory: CaptureFactory = createWorkletCapture,
  ) {
    this.id = id;

    this.slotGain = ctx.createGain();
    this.slotGain.gain.setValueAtTime(config.muted ? 0 : 1, ctx.currentTime);

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.6;

    this.slotGain.connect(output);
    this.slotGain.connect(this.analyser);
  }

  // --- introspection -------------------------------------------------------

  getState(): SlotState {
    return this.state;
  }

  hasBuffer(): boolean {
    return this.buffer !== null;
  }

  getBuffer(): AudioBuffer | null {
    return this.buffer;
  }

  getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  getConfig(): SlotConfig {
    return this.config;
  }

  onStateChange(fn: (s: SlotState) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private setState(next: SlotState): void {
    if (next === this.state) return;
    this.state = next;
    for (const fn of this.listeners) fn(next);
  }

  // --- arm + capture -------------------------------------------------------

  /** `empty → armed`. Listens on `source` to auto-start capture on first sound. */
  arm(source: AudioNode): void {
    if (this.state !== 'empty') return;
    this.armSource = source;
    this.setState('armed');

    const a = this.ctx.createAnalyser();
    a.fftSize = 1024;
    source.connect(a);
    this.armAnalyser = a;
    this.armTimer = setInterval(() => {
      if (
        this.armAnalyser &&
        readRms(this.armAnalyser) >= CAPTURE_TRIGGER_RMS
      ) {
        this.startCapture();
      }
    }, ARM_POLL_MS);
  }

  /** `armed → empty`. */
  disarm(): void {
    if (this.state !== 'armed') return;
    this.teardownArm();
    this.setState('empty');
  }

  /** `armed → capturing`. Auto-fired on first sound; also a manual override. */
  startCapture(): void {
    if (this.state !== 'armed') return;
    const source = this.armSource;
    if (!source) return;
    this.teardownArm();
    this.setState('capturing');

    void this.captureFactory(this.ctx, source, {
      maxSeconds: MAX_CAPTURE_SEC,
      onAutoStop: (buffer) => this.commit(buffer),
    })
      .then((controller) => {
        // A stop() may have arrived before the controller resolved.
        if (this.state === 'capturing') this.capture = controller;
        else controller.dispose();
      })
      .catch(() => {
        this.capture = null;
        if (this.state === 'capturing') this.setState('empty');
      });
  }

  /** `capturing → playing` (commit) or `→ empty` (discard sub-minimum capture). */
  stopCapture(): void {
    if (this.state !== 'capturing') return;
    const controller = this.capture;
    if (!controller) {
      // Controller not ready yet — flip to empty; the pending arm resolved path
      // will dispose it.
      this.setState('empty');
      return;
    }
    void controller.stop().then((buffer) => this.commit(buffer));
  }

  private clampBuffer(buffer: AudioBuffer): AudioBuffer {
    if (buffer.duration <= MAX_CAPTURE_SEC) return buffer;

    const sampleRate = buffer.sampleRate;
    const maxSamples = Math.floor(MAX_CAPTURE_SEC * sampleRate);
    const capped = this.ctx.createBuffer(
      buffer.numberOfChannels,
      maxSamples,
      sampleRate,
    );

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const srcData = buffer.getChannelData(ch);
      const dstData = capped.getChannelData(ch);
      dstData.set(srcData.subarray(0, maxSamples));
    }
    return capped;
  }

  private commit(buffer: AudioBuffer | null): void {
    if (this.committing || this.state !== 'capturing') return;
    this.committing = true;
    this.capture = null;

    if (!buffer || buffer.duration < MIN_CAPTURE_SEC) {
      this.buffer = null;
      this.committing = false;
      this.setState('empty');
      return;
    }

    this.buffer = this.clampBuffer(buffer);
    this.setState('playing');
    this.startSeam();
    this.committing = false;

    // Apply any URL-remembered config: freeze first, then mute.
    if (this.config.frozen) this.freeze();
    if (this.config.muted) this.mute();
  }

  /**
   * Hydrate a slot from an externally-provided buffer (a capture fetched from
   * the backend), bypassing the live capture path. Applies URL-remembered
   * freeze/mute config exactly as a fresh capture would.
   */
  loadBuffer(buffer: AudioBuffer): void {
    if (buffer.duration < MIN_CAPTURE_SEC) return;
    this.clear();
    this.buffer = this.clampBuffer(buffer);
    this.setState('playing');
    this.startSeam();
    if (this.config.frozen) this.freeze();
    if (this.config.muted) this.mute();
  }

  private teardownArm(): void {
    if (this.armTimer !== null) clearInterval(this.armTimer);
    this.armTimer = null;
    if (this.armAnalyser && this.armSource) {
      try {
        this.armSource.disconnect(this.armAnalyser);
      } catch {
        // already detached
      }
    }
    this.armAnalyser = null;
  }

  // --- playback / freeze ---------------------------------------------------

  private startSeam(): void {
    if (!this.buffer) return;
    this.stopGranular();
    this.seam = new SeamLoopPlayer(this.ctx, this.buffer, this.slotGain);
    this.seam.start();
  }

  private stopSeam(): void {
    this.seam?.stop();
    this.seam = null;
  }

  private stopGranular(): void {
    this.granular?.stop();
    this.granular = null;
  }

  /** `playing → frozen`: swap seam looping for granular re-synthesis. */
  freeze(): void {
    if (this.state !== 'playing' || !this.buffer) return;
    this.config = { ...this.config, frozen: true };
    this.stopSeam();
    this.granular = new GranularPlayer(this.ctx, this.buffer, this.slotGain);
    this.granular.setDriftModulation(this.meanDrift);
    this.granular.start({
      ...this.config.grain,
      driftCoupled: this.config.driftCoupled,
    });
    this.setState('frozen');
  }

  /** `frozen → playing`: tear down granular, resume seam looping. */
  unfreeze(): void {
    if (this.state !== 'frozen') return;
    this.config = { ...this.config, frozen: false };
    this.stopGranular();
    this.setState('playing');
    this.startSeam();
  }

  // --- mute ----------------------------------------------------------------

  private applyMuteGain(muted: boolean): void {
    this.config = { ...this.config, muted };
    this.slotGain.gain.setTargetAtTime(
      muted ? 0 : 1,
      this.ctx.currentTime,
      MUTE_RAMP_TC,
    );
  }

  /** `playing|frozen → muted` (remembers which, to restore on unmute). */
  mute(): void {
    if (this.state !== 'playing' && this.state !== 'frozen') return;
    this.applyMuteGain(true);
    this.setState('muted');
  }

  /** `muted → playing|frozen`, whichever the slot was before muting. */
  unmute(): void {
    if (this.state !== 'muted') return;
    this.applyMuteGain(false);
    this.setState(this.config.frozen ? 'frozen' : 'playing');
  }

  toggleMute(): void {
    if (this.state === 'muted') this.unmute();
    else this.mute();
  }

  // --- grain params --------------------------------------------------------

  setGrain(grain: GrainParams): void {
    this.config = { ...this.config, grain };
    if (this.granular) {
      this.granular.setParams({
        ...grain,
        driftCoupled: this.config.driftCoupled,
      });
    }
  }

  setDriftCoupled(on: boolean): void {
    this.config = { ...this.config, driftCoupled: on };
    if (this.granular) {
      this.granular.setParams({
        ...this.config.grain,
        driftCoupled: on,
      });
    }
  }

  /** Mean drift (normalized −1..1) from the orchestrator, for drift coupling. */
  setDriftModulation(meanNorm: number): void {
    this.meanDrift = meanNorm;
    this.granular?.setDriftModulation(meanNorm);
  }

  // --- clear / dispose -----------------------------------------------------

  /** Any state → `empty`. Tears down players and releases the buffer for GC. */
  clear(): void {
    this.teardownArm();
    this.stopSeam();
    this.stopGranular();
    if (this.capture) {
      this.capture.dispose();
      this.capture = null;
    }
    this.buffer = null;
    this.committing = false;
    this.slotGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.slotGain.gain.setValueAtTime(
      this.config.muted ? 0 : 1,
      this.ctx.currentTime,
    );
    this.setState('empty');
  }

  dispose(): void {
    this.clear();
    try {
      this.slotGain.disconnect();
    } catch {
      // already detached
    }
    this.listeners.clear();
  }
}
