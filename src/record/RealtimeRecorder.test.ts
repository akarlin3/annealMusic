import { describe, expect, it, vi } from 'vitest';
import {
  startRealtimeRecording,
  OPUS_MIME,
  type RecorderOptions,
} from '@/record/RealtimeRecorder';
import { MockAudioContext, MockAudioBuffer, MockNode } from '@/test/audioMock';
import type { CaptureFactory } from '@/loop/capture';

function ctxNode(): { ctx: AudioContext; source: AudioNode } {
  const ctx = new MockAudioContext();
  return {
    ctx: ctx as unknown as AudioContext,
    source: new MockNode('gain') as unknown as AudioNode,
  };
}

/** A capture factory that yields a fixed two-channel buffer on stop. */
function fakeWavCapture(buffer: AudioBuffer): CaptureFactory {
  return () =>
    Promise.resolve({
      stop: () => Promise.resolve(buffer),
      dispose: () => undefined,
    });
}

/** A minimal MediaRecorder stand-in that emits one chunk on stop. */
class FakeMediaRecorder {
  ondataavailable: ((e: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  started = false;
  constructor(
    readonly stream: MediaStream,
    readonly opts: { mimeType: string },
  ) {}
  start(): void {
    this.started = true;
  }
  stop(): void {
    this.ondataavailable?.({
      data: new Blob([new Uint8Array([1, 2, 3, 4])], {
        type: this.opts.mimeType,
      }),
    } as BlobEvent);
    this.onstop?.();
  }
}

describe('RealtimeRecorder — WAV path', () => {
  it('produces a WAV blob from the captured buffer', async () => {
    const { ctx, source } = ctxNode();
    const buffer = new MockAudioBuffer(
      2,
      48000,
      48000,
    ) as unknown as AudioBuffer;
    const handles = await startRealtimeRecording(ctx, source, {
      format: 'wav',
      captureFactory: fakeWavCapture(buffer),
    });
    const rec = await handles.stop();
    expect(rec).not.toBeNull();
    expect(rec?.format).toBe('wav');
    expect(rec?.mime).toBe('audio/wav');
    expect(rec?.durationMs).toBe(1000); // 48000 frames / 48000 Hz
    // 2ch × 48000 frames × 2 bytes + 44-byte header (RIFF bytes are
    // covered by wav.test.ts).
    expect(rec?.blob.size).toBe(44 + 2 * 48000 * 2);
  });
});

describe('RealtimeRecorder — Opus path', () => {
  function opusOpts(extra: Partial<RecorderOptions> = {}): RecorderOptions {
    return {
      format: 'opus',
      mediaRecorderFactory: (stream, mime) =>
        new FakeMediaRecorder(stream, {
          mimeType: mime,
        }) as unknown as MediaRecorder,
      ...extra,
    };
  }

  it('records via MediaRecorder and finalizes an Opus blob', async () => {
    const { ctx, source } = ctxNode();
    const handles = await startRealtimeRecording(ctx, source, opusOpts());
    const rec = await handles.stop();
    expect(rec?.format).toBe('opus');
    expect(rec?.mime).toBe(OPUS_MIME);
    expect(rec?.blob.size).toBeGreaterThan(0);
  });

  it('cancel produces no recording on a later stop', async () => {
    const { ctx, source } = ctxNode();
    const handles = await startRealtimeRecording(ctx, source, opusOpts());
    handles.cancel();
    expect(await handles.stop()).toBeNull();
  });

  it('fires the warn callback after the 50-minute threshold', async () => {
    vi.useFakeTimers();
    const { ctx, source } = ctxNode();
    const onWarn = vi.fn();
    const mockCtx = ctx as unknown as MockAudioContext;
    const handles = await startRealtimeRecording(
      ctx,
      source,
      opusOpts({ onWarn }),
    );
    // Advance the audio clock past the warn threshold, then let the tick fire.
    mockCtx.currentTime = 50 * 60 + 1;
    vi.advanceTimersByTime(1000);
    expect(onWarn).toHaveBeenCalledOnce();
    handles.cancel();
    vi.useRealTimers();
  });
});
