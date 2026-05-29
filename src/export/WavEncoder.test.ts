import { describe, expect, it } from 'vitest';
import { encodeWav } from './WavEncoder';
import { MockAudioContext } from '@/test/audioMock';

function findChunk(
  buf: ArrayBuffer,
  id: string,
): { offset: number; size: number } | null {
  const view = new DataView(buf);
  let offset = 12; // skip RIFF header
  while (offset < buf.byteLength) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
    const size = view.getUint32(offset + 4, true);
    if (chunkId === id) {
      return { offset: offset + 8, size };
    }
    // skip chunk header (8 bytes) + size (aligned to 2 bytes)
    offset += 8 + size + (size % 2 === 0 ? 0 : 1);
  }
  return null;
}

describe('WavEncoder', () => {
  it('encodes an AudioBuffer into a 24-bit PCM WAV with correct headers and bext metadata', () => {
    const ctx = new MockAudioContext();
    const buffer = ctx.createBuffer(2, 48000, 48000) as unknown as AudioBuffer;

    // Fill buffer with a simple constant value to verify sample mapping
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    left.fill(0.5);
    right.fill(-0.5);

    const wavBytes = encodeWav(buffer, {
      bitDepth: 24,
      stemName: 'engine',
      label: 'Engine Output (Raw)',
      patchTitle: 'Ambient Morning',
      patchHash: 'a5e4b10',
      engineType: 'fm',
    });

    expect(wavBytes).toBeDefined();

    // Verify RIFF and WAVE signatures
    const view = new DataView(wavBytes);
    const riff = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3),
    );
    const wave = String.fromCharCode(
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11),
    );
    expect(riff).toBe('RIFF');
    expect(wave).toBe('WAVE');

    // Find and verify 'fmt ' chunk
    const fmt = findChunk(wavBytes, 'fmt ');
    expect(fmt).not.toBeNull();
    const fmtView = new DataView(wavBytes, fmt!.offset, fmt!.size);
    expect(fmtView.getUint16(0, true)).toBe(1); // PCM format tag = 1
    expect(fmtView.getUint16(2, true)).toBe(2); // 2 channels
    expect(fmtView.getUint32(4, true)).toBe(48000); // 48kHz sample rate
    expect(fmtView.getUint16(14, true)).toBe(24); // 24-bit depth

    // Find and verify 'bext' chunk
    const bext = findChunk(wavBytes, 'bext');
    expect(bext).not.toBeNull();
    expect(bext!.size).toBe(602);

    const bextText = new Uint8Array(wavBytes, bext!.offset, 256);
    const desc = new TextDecoder().decode(bextText).replace(/\0/g, '');
    expect(desc).toContain('Stem: Engine Output (Raw)');
    expect(desc).toContain('Engine: fm');

    const originatorText = new Uint8Array(wavBytes, bext!.offset + 256, 32);
    const orig = new TextDecoder().decode(originatorText).replace(/\0/g, '');
    expect(orig).toBe('AnnealMusic v1.5.0');

    // Find and verify 'iXML' chunk
    const ixml = findChunk(wavBytes, 'iXML');
    expect(ixml).not.toBeNull();
    const ixmlText = new Uint8Array(wavBytes, ixml!.offset, ixml!.size);
    const xml = new TextDecoder().decode(ixmlText);
    expect(xml).toContain('<PROJECT>AnnealMusic</PROJECT>');
    expect(xml).toContain('<STEM_NAME>engine</STEM_NAME>');
    expect(xml).toContain('<ENGINE_TYPE>fm</ENGINE_TYPE>');
    expect(xml).toContain('<PATCH_TITLE>Ambient Morning</PATCH_TITLE>');
    expect(xml).toContain('<PATCH_HASH>a5e4b10</PATCH_HASH>');

    // Find and verify 'data' chunk
    const data = findChunk(wavBytes, 'data');
    expect(data).not.toBeNull();

    // Verify first sample value mapping
    const sampleOffset = data!.offset;
    // For 24-bit PCM: 3 bytes per sample. First channel: 0.5 * 8388607 = 4194303.5 ~ 4194304 (0x400000)
    // Low: 0x00, Mid: 0x00, High: 0x40
    expect(view.getUint8(sampleOffset)).toBe(0);
    expect(view.getUint8(sampleOffset + 1)).toBe(0);
    expect(view.getUint8(sampleOffset + 2)).toBe(64);
  });

  it('encodes an AudioBuffer into a 32-bit float WAV correctly', () => {
    const ctx = new MockAudioContext();
    const buffer = ctx.createBuffer(1, 100, 44100) as unknown as AudioBuffer;

    const chan = buffer.getChannelData(0);
    chan[0] = 0.75;

    const wavBytes = encodeWav(buffer, {
      bitDepth: 32,
      stemName: 'master',
      patchTitle: 'Float Session',
      patchHash: 'f7200',
      engineType: 'sine',
    });

    const fmt = findChunk(wavBytes, 'fmt ');
    expect(fmt).not.toBeNull();
    const fmtView = new DataView(wavBytes, fmt!.offset, fmt!.size);
    expect(fmtView.getUint16(0, true)).toBe(3); // IEEE Float format tag = 3
    expect(fmtView.getUint16(14, true)).toBe(32); // 32-bit float depth

    const data = findChunk(wavBytes, 'data');
    expect(data).not.toBeNull();
    const dataView = new DataView(wavBytes, data!.offset, data!.size);
    expect(dataView.getFloat32(0, true)).toBe(0.75); // exact float value
  });
});
