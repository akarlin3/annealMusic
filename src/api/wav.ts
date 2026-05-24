/**
 * Encode an `AudioBuffer` to a 16-bit PCM WAV. This is the deterministic,
 * universal upload format for loop captures — the server transcodes it to Opus
 * (Safari's `MediaRecorder` Opus support is unreliable, and the capture is an
 * in-memory buffer, not a live stream, so client-side Opus isn't a fit).
 */
export function encodeWav(buffer: AudioBuffer): Blob {
  return new Blob([encodeWavBuffer(buffer)], { type: 'audio/wav' });
}

/** The raw WAV bytes (the `encodeWav` payload, exposed for testing). */
export function encodeWavBuffer(buffer: AudioBuffer): ArrayBuffer {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const frames = buffer.length;

  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;
  const headerSize = 44;

  const out = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(out);

  const writeStr = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++)
      view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // format = PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels, clamping floats to the 16-bit range.
  const chans: Float32Array[] = [];
  for (let c = 0; c < channels; c++) chans.push(buffer.getChannelData(c));

  let offset = headerSize;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const channel = chans[c];
      const sample = channel ? (channel[i] ?? 0) : 0;
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(
        offset,
        clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
        true,
      );
      offset += 2;
    }
  }

  return out;
}
