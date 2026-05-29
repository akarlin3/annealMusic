/**
 * Simple client-side helper to encode an AudioBuffer slice to WAV (16-bit signed PCM mono)
 * to be uploaded to the server. Mono is canonical for granular engine sources.
 */
export function encodeAudioBufferToWav(
  buffer: AudioBuffer,
  startSec: number = 0,
  durationSec: number = 60,
): Blob {
  const sampleRate = buffer.sampleRate;
  const startFrame = Math.floor(startSec * sampleRate);
  const endFrame = Math.min(
    buffer.length,
    Math.floor((startSec + durationSec) * sampleRate),
  );
  const frameCount = Math.max(0, endFrame - startFrame);

  // Mix down channels to mono (averaging channels if stereo)
  const channels = buffer.numberOfChannels;
  const monoData = new Float32Array(frameCount);

  // Read samples and average them
  for (let c = 0; c < channels; c++) {
    const channelData = buffer.getChannelData(c);
    for (let i = 0; i < frameCount; i++) {
      const current = monoData[i] ?? 0;
      const sample = channelData[startFrame + i] ?? 0;
      monoData[i] = current + sample;
    }
  }
  if (channels > 1) {
    for (let i = 0; i < frameCount; i++) {
      const current = monoData[i] ?? 0;
      monoData[i] = current / channels;
    }
  }

  // Create WAV buffer: 44 bytes header + 2 bytes per sample
  const bufferLength = 44 + frameCount * 2;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length
  view.setUint32(4, 36 + frameCount * 2, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw PCM = 1)
  view.setUint16(20, 1, true);
  // channel count (1 = mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, frameCount * 2, true);

  // Write PCM samples: map float [-1, 1] to short [-32768, 32767]
  let offset = 44;
  for (let i = 0; i < frameCount; i++) {
    const sample = Math.max(-1, Math.min(1, monoData[i] ?? 0));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
