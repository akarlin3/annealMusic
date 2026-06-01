import { describe, expect, it } from 'vitest';
import { encodeAudioBufferToWav } from './upload';

function fakeBuffer(
  frames: number,
  channels: number,
  sampleRate: number,
): AudioBuffer {
  const data = Array.from({ length: channels }, () => new Float32Array(frames));
  return {
    numberOfChannels: channels,
    sampleRate,
    length: frames,
    duration: frames / sampleRate,
    getChannelData: (c: number) => data[c]!,
  } as unknown as AudioBuffer;
}

describe('encodeAudioBufferToWav downmixing', () => {
  it('prevents phase cancellation by picking Left channel instead of averaging', async () => {
    const frames = 10;
    const channels = 2;
    const buf = fakeBuffer(frames, channels, 44100);

    // Fill Left channel with 1.0 (positive)
    const left = buf.getChannelData(0);
    left.fill(1.0);

    // Fill Right channel with -1.0 (phase-inverted negative)
    const right = buf.getChannelData(1);
    right.fill(-1.0);

    const wavBlob = encodeAudioBufferToWav(buf, 0, 1);
    const arrayBuf = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(wavBlob);
    });
    const view = new DataView(arrayBuf);

    // Verify WAV format headers
    expect(view.getUint16(22, true)).toBe(1); // Mono downmixed channel
    expect(view.getUint32(24, true)).toBe(44100); // sampleRate

    // Read the first sample in the data section (offset 44)
    // For 16-bit PCM:
    const sample = view.getInt16(44, true);
    // Since Left was 1.0, and we picked Left-only:
    // If it averaged (1.0 + -1.0)/2 = 0, we would get 0.
    // Since we picked Left-only (1.0), it should be around 32767 (0x7fff).
    expect(sample).toBeGreaterThan(30000);
  });
});
