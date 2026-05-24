/**
 * Realtime session capture — records exactly what the user hears (engine + live
 * input + loops, tapped post-fx) into a downloadable blob.
 *
 * Two formats:
 *  - **Opus** (default, compressed): the tap → `MediaStreamAudioDestinationNode`
 *    → `MediaRecorder` (`audio/webm;codecs=opus`). Small files; the server
 *    repackages WebM/Opus to Ogg/Opus exactly as it does v0.8 previews.
 *  - **WAV** (lossless, opt-in): a `MediaStreamAudioDestinationNode` feeds an
 *    `OfflineAudioContext`-free PCM accumulator built on the same AudioWorklet
 *    tap the loop pedal uses (`loop/capture.ts`), finalized with `encodeWav`.
 *
 * Hard cap at 60 min; a warning callback fires at 50 min; auto-stop at 60.
 */
import { encodeWav } from '@/api/wav';
import { createWorkletCapture, type CaptureFactory } from '@/loop/capture';

export type RecordingFormat = 'opus' | 'wav';

export const MAX_RECORDING_SECONDS = 60 * 60;
export const WARN_RECORDING_SECONDS = 50 * 60;

/** MIME used for the Opus path; the server transcodes to Ogg/Opus. */
export const OPUS_MIME = 'audio/webm;codecs=opus';

export interface RealtimeRecording {
  blob: Blob;
  format: RecordingFormat;
  /** Container/content MIME of `blob`. */
  mime: string;
  durationMs: number;
}

export interface RecorderHandles {
  /** Stop and resolve the finished recording (null if nothing usable). */
  stop(): Promise<RealtimeRecording | null>;
  /** Tear down without producing a recording. */
  cancel(): void;
}

export interface RecorderOptions {
  format: RecordingFormat;
  /** Fired ~once/sec with elapsed seconds, for the UI counter. */
  onTick?: (elapsedSec: number) => void;
  /** Fired once when crossing the warn threshold (50 min). */
  onWarn?: () => void;
  /** Fired when the 60-min cap auto-stops the recording. */
  onAutoStop?: (recording: RealtimeRecording | null) => void;
  /** Injected for tests; defaults to the real worklet PCM capture. */
  captureFactory?: CaptureFactory;
  /** Injected for tests; builds a MediaRecorder around a stream. */
  mediaRecorderFactory?: (stream: MediaStream, mime: string) => MediaRecorder;
}

/** True when this browser can record Opus via MediaRecorder. */
export function isOpusSupported(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof MediaRecorder.isTypeSupported === 'function' &&
    MediaRecorder.isTypeSupported(OPUS_MIME)
  );
}

function defaultMediaRecorder(
  stream: MediaStream,
  mime: string,
): MediaRecorder {
  return new MediaRecorder(stream, { mimeType: mime });
}

/**
 * Begin recording the given source node. `ctx` and `source` come from the
 * orchestrator's recording tap. The recorder owns its own muted sink so it never
 * perturbs the speaker path.
 */
export async function startRealtimeRecording(
  ctx: AudioContext,
  source: AudioNode,
  opts: RecorderOptions,
): Promise<RecorderHandles> {
  const start = ctx.currentTime;
  let warned = false;
  let stopped = false;

  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let capTimer: ReturnType<typeof setTimeout> | null = null;

  const elapsedSec = (): number => Math.max(0, ctx.currentTime - start);

  const clearTimers = (): void => {
    if (tickTimer !== null) clearInterval(tickTimer);
    if (capTimer !== null) clearTimeout(capTimer);
    tickTimer = capTimer = null;
  };

  if (opts.format === 'wav') {
    const factory = opts.captureFactory ?? createWorkletCapture;
    const controller = await factory(ctx, source, {
      maxSeconds: MAX_RECORDING_SECONDS,
      onAutoStop: (buffer) => {
        const rec = buffer ? wavRecording(buffer) : null;
        opts.onAutoStop?.(rec);
      },
    });

    const finish = async (): Promise<RealtimeRecording | null> => {
      if (stopped) return null;
      stopped = true;
      clearTimers();
      const buffer = await controller.stop();
      return buffer ? wavRecording(buffer) : null;
    };

    startWatchdog();
    return {
      stop: finish,
      cancel: () => {
        stopped = true;
        clearTimers();
        controller.dispose();
      },
    };
  }

  // Opus path: tap → MediaStreamDestination → MediaRecorder.
  const dest = ctx.createMediaStreamDestination();
  source.connect(dest);
  const makeRecorder = opts.mediaRecorderFactory ?? defaultMediaRecorder;
  const recorder = makeRecorder(dest.stream, OPUS_MIME);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e: BlobEvent): void => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const finalize = (): RealtimeRecording => ({
    blob: new Blob(chunks, { type: OPUS_MIME }),
    format: 'opus',
    mime: OPUS_MIME,
    durationMs: Math.round(elapsedSec() * 1000),
  });

  const teardown = (): void => {
    try {
      source.disconnect(dest);
    } catch {
      // already detached
    }
  };

  recorder.start();

  const finish = (): Promise<RealtimeRecording | null> =>
    new Promise((resolve) => {
      if (stopped) return resolve(null);
      stopped = true;
      clearTimers();
      recorder.onstop = (): void => {
        teardown();
        resolve(finalize());
      };
      recorder.stop();
    });

  startWatchdog();
  return {
    stop: finish,
    cancel: (): void => {
      stopped = true;
      clearTimers();
      try {
        recorder.stop();
      } catch {
        // already stopped
      }
      teardown();
    },
  };

  // --- shared watchdog: tick counter + warn + hard cap --------------------
  function startWatchdog(): void {
    tickTimer = setInterval(() => {
      const s = elapsedSec();
      opts.onTick?.(s);
      if (!warned && s >= WARN_RECORDING_SECONDS) {
        warned = true;
        opts.onWarn?.();
      }
    }, 1000);
    // The WAV path enforces its own maxSeconds inside the worklet; the Opus
    // path needs an explicit cap timer.
    if (opts.format === 'opus') {
      capTimer = setTimeout(() => {
        void finish().then((rec) => opts.onAutoStop?.(rec));
      }, MAX_RECORDING_SECONDS * 1000);
    }
  }
}

function wavRecording(buffer: AudioBuffer): RealtimeRecording {
  return {
    blob: encodeWav(buffer),
    format: 'wav',
    mime: 'audio/wav',
    durationMs: Math.round((buffer.length / buffer.sampleRate) * 1000),
  };
}
