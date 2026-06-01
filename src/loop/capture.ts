/**
 * Live-input capture into a raw `AudioBuffer`, via an `AudioWorklet`.
 *
 * Why AudioWorklet (not MediaRecorder, not ScriptProcessor): we want loss-less
 * PCM of the *processed* voice (so the seam crossfade and granular freeze have
 * exact samples), captured on the audio thread. `MediaRecorder` only yields
 * encoded (lossy) blobs and needs a decode round-trip; `ScriptProcessor` is
 * deprecated and runs on the main thread (glitch-prone). The worklet copies its
 * input blocks and streams them to the main thread, which concatenates into an
 * `AudioBuffer` on stop. Capture auto-stops at `maxSeconds`.
 *
 * The worklet source is shipped as a Blob URL so it needs no build-pipeline
 * wiring and stays colocated with this module.
 */

export interface CaptureOptions {
  maxSeconds: number;
  /** Fired when capture auto-stops at `maxSeconds`; receives the final buffer. */
  onAutoStop?: (buffer: AudioBuffer | null) => void;
}

export interface CaptureController {
  /** Commit and return the captured buffer (null if nothing usable was recorded). */
  stop(): Promise<AudioBuffer | null>;
  /** Tear down without committing. */
  dispose(): void;
}

/** Builds a capture controller for `source`. Injectable for tests. */
export type CaptureFactory = (
  ctx: AudioContext,
  source: AudioNode,
  opts: CaptureOptions,
) => Promise<CaptureController>;

interface CaptureChunk {
  channels: Float32Array[];
  frames: number;
}

const WORKLET_NAME = 'loop-capture';

const WORKLET_SOURCE = `
class LoopCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._batchFrames = 4096;
    this._channels = 0;
    this._batch = null;
    this._fill = 0;
    this._stopped = false;
    this.port.onmessage = (e) => {
      if (e.data === 'stop') {
        this._flush();
        this._stopped = true;
        this.port.postMessage({ type: 'stopped' });
      }
    };
  }
  _alloc(channels) {
    this._channels = channels;
    this._batch = [];
    for (let c = 0; c < channels; c++) this._batch.push(new Float32Array(this._batchFrames));
    this._fill = 0;
  }
  _flush() {
    if (!this._batch || this._fill === 0) return;
    const out = [];
    for (let c = 0; c < this._channels; c++) out.push(this._batch[c].slice(0, this._fill));
    this.port.postMessage({ type: 'chunk', channels: out, frames: this._fill });
    this._fill = 0;
  }
  process(inputs) {
    if (this._stopped) return false;
    const input = inputs[0];
    if (!input || input.length === 0 || !input[0]) return true;
    const channels = input.length;
    const frames = input[0].length;
    if (!this._batch || this._channels !== channels) this._alloc(channels);
    let i = 0;
    while (i < frames) {
      const take = Math.min(this._batchFrames - this._fill, frames - i);
      for (let c = 0; c < channels; c++) {
        const src = input[c] || input[0];
        this._batch[c].set(src.subarray(i, i + take), this._fill);
      }
      this._fill += take;
      i += take;
      if (this._fill === this._batchFrames) this._flush();
    }
    return true;
  }
}
registerProcessor('${WORKLET_NAME}', LoopCaptureProcessor);
`;

const moduleLoaded = new WeakMap<AudioContext, Promise<void>>();

function ensureModule(ctx: AudioContext): Promise<void> {
  let loaded = moduleLoaded.get(ctx);
  if (!loaded) {
    const blob = new Blob([WORKLET_SOURCE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    loaded = ctx.audioWorklet
      .addModule(url)
      .finally(() => URL.revokeObjectURL(url));
    moduleLoaded.set(ctx, loaded);
  }
  return loaded;
}

/** True when this browser can capture loops (AudioWorklet present). */
function isCaptureSupported(ctx: AudioContext): boolean {
  return typeof ctx.audioWorklet?.addModule === 'function';
}

export const createWorkletCapture: CaptureFactory = async (
  ctx,
  source,
  opts,
) => {
  if (!isCaptureSupported(ctx)) {
    throw new Error('Loop capture requires AudioWorklet, unavailable here.');
  }
  await ensureModule(ctx);

  const node = new AudioWorkletNode(ctx, WORKLET_NAME, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });

  // A muted sink keeps the node "actively processing" (pulled by the graph)
  // without routing any signal to the speakers.
  const sink = ctx.createGain();
  sink.gain.setValueAtTime(0, ctx.currentTime);
  source.connect(node);
  node.connect(sink).connect(ctx.destination);

  const chunks: CaptureChunk[] = [];
  let totalFrames = 0;
  let channelCount = 1;
  const maxFrames = Math.floor(opts.maxSeconds * ctx.sampleRate);
  let finalize: ((buffer: AudioBuffer | null) => void) | null = null;
  let finalized = false;

  const build = (): AudioBuffer | null => {
    if (totalFrames === 0) return null;
    const buffer = ctx.createBuffer(channelCount, totalFrames, ctx.sampleRate);
    for (let c = 0; c < channelCount; c++) {
      const data = buffer.getChannelData(c);
      let offset = 0;
      for (const chunk of chunks) {
        const src = chunk.channels[c] ?? chunk.channels[0];
        if (src) data.set(src.subarray(0, chunk.frames), offset);
        offset += chunk.frames;
      }
    }
    return buffer;
  };

  const teardown = (): void => {
    try {
      source.disconnect(node);
    } catch {
      // already detached
    }
    try {
      node.disconnect();
    } catch {
      // already detached
    }
    try {
      sink.disconnect();
    } catch {
      // already detached
    }
    node.port.onmessage = null;
  };

  node.port.onmessage = (e: MessageEvent): void => {
    const data = e.data as
      | { type: 'chunk'; channels: Float32Array[]; frames: number }
      | { type: 'stopped' };
    if (data.type === 'chunk') {
      channelCount = Math.max(channelCount, data.channels.length);
      const remaining = maxFrames - totalFrames;
      if (remaining <= 0) return;
      const frames = Math.min(data.frames, remaining);
      chunks.push({ channels: data.channels, frames });
      totalFrames += frames;
      if (totalFrames >= maxFrames && !finalized) {
        finalized = true;
        node.port.postMessage('stop');
      }
    } else if (data.type === 'stopped') {
      const buffer = build();
      teardown();
      finalize?.(buffer);
      finalize = null;
      opts.onAutoStop?.(buffer);
    }
  };

  return {
    stop(): Promise<AudioBuffer | null> {
      return new Promise((resolve) => {
        finalize = resolve;
        if (!finalized) {
          finalized = true;
          node.port.postMessage('stop');
        }
      });
    },
    dispose(): void {
      finalized = true;
      teardown();
    },
  };
};
