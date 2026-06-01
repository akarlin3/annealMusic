import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { makeIR, resampleAudioBuffer, setupConvolverBuffer } from './ir';
import { MockAudioContext, MockAudioBuffer } from '@/test/audioMock';

describe('ir utility functions', () => {
  let originalOfflineAudioContext: any;

  beforeEach(() => {
    originalOfflineAudioContext = (globalThis as any).OfflineAudioContext;
  });

  afterEach(() => {
    (globalThis as any).OfflineAudioContext = originalOfflineAudioContext;
  });

  it('makeIR synthesizes a buffer correctly', () => {
    const ctx = new MockAudioContext() as any;
    const buf = makeIR(ctx, 2.0, 2.0);
    expect(buf.numberOfChannels).toBe(2);
    expect(buf.sampleRate).toBe(ctx.sampleRate);
    expect(buf.duration).toBeCloseTo(2.0, 1);
  });

  it('resampleAudioBuffer returns same buffer if sample rates match', async () => {
    const buffer = new MockAudioBuffer(
      2,
      48000,
      48000,
    ) as unknown as AudioBuffer;
    const resampled = await resampleAudioBuffer(buffer, 48000);
    expect(resampled).toBe(buffer);
  });

  it('resampleAudioBuffer resamples buffer using mock OfflineAudioContext', async () => {
    // Define a mock OfflineAudioContext class
    class MockOfflineCtx {
      readonly destination = {};
      constructor(
        public numberOfChannels: number,
        public length: number,
        public sampleRate: number,
      ) {}
      createBufferSource() {
        return {
          buffer: null,
          connect() {},
          start() {},
        };
      }
      async startRendering() {
        return new MockAudioBuffer(
          this.numberOfChannels,
          this.length,
          this.sampleRate,
        ) as unknown as AudioBuffer;
      }
    }

    (globalThis as any).OfflineAudioContext = MockOfflineCtx;

    const sourceBuffer = new MockAudioBuffer(
      2,
      44100,
      44100,
    ) as unknown as AudioBuffer;
    const resampled = await resampleAudioBuffer(sourceBuffer, 48000);
    expect(resampled.sampleRate).toBe(48000);
    expect(resampled.numberOfChannels).toBe(2);
    expect(resampled.length).toBe(48000);
  });

  it('setupConvolverBuffer sets buffer synchronously if sample rates match', async () => {
    const ctx = new MockAudioContext() as any;
    const convolver = { buffer: null } as any;
    const buffer = new MockAudioBuffer(
      2,
      48000,
      48000,
    ) as unknown as AudioBuffer;

    const result = await setupConvolverBuffer(ctx, convolver, buffer);
    expect(convolver.buffer).toBe(buffer);
    expect(result).toBe(buffer);
  });
});
