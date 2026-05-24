import { describe, expect, it } from 'vitest';
import { encodeWav, encodeWavBuffer } from '@/api/wav';

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

function str(view: DataView, offset: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++)
    s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

describe('encodeWav', () => {
  it('writes a valid RIFF/WAVE header with correct sizes', async () => {
    const frames = 100;
    const channels = 2;
    const buf = fakeBuffer(frames, channels, 48000);
    expect(encodeWav(buf).type).toBe('audio/wav');

    const view = new DataView(encodeWavBuffer(buf));
    expect(str(view, 0, 4)).toBe('RIFF');
    expect(str(view, 8, 4)).toBe('WAVE');
    expect(str(view, 36, 4)).toBe('data');

    expect(view.getUint16(22, true)).toBe(channels);
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint16(34, true)).toBe(16); // bits/sample

    const dataSize = frames * channels * 2;
    expect(view.getUint32(40, true)).toBe(dataSize);
    expect(view.byteLength).toBe(44 + dataSize);
  });
});
