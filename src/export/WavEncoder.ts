/* eslint-disable no-control-regex */
export interface WavEncoderOptions {
  bitDepth: 24 | 32; // 24-bit PCM or 32-bit float
  stemName: string;
  label?: string; // Optional human-facing stem name
  patchTitle: string;
  patchHash: string;
  engineType: string;
  partialIndex?: number;
}

/**
 * Functional WAV (PCM) encoder with Broadcast Wave Format (BWF) and iXML metadata.
 * Produces deterministic, sample-accurate ArrayBuffer exports suitable for professional DAWs.
 */
export function encodeWav(
  buffer: AudioBuffer,
  options: WavEncoderOptions,
): ArrayBuffer {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const frames = buffer.length;

  const bytesPerSample = options.bitDepth === 24 ? 3 : 4;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;

  // 1. Generate bext body
  const bextSize = 602; // BWF Version 0 fixed header size
  const bextBuffer = new ArrayBuffer(bextSize);
  const bextView = new DataView(bextBuffer);

  const writeAscii = (
    view: DataView,
    offset: number,
    str: string,
    maxLen: number,
  ): void => {
    const len = Math.min(str.length, maxLen);
    for (let i = 0; i < len; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
    // Rest is zero-padded by ArrayBuffer initialization
  };

  const now = new Date();
  const padZero = (num: number): string => num.toString().padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${padZero(now.getMonth() + 1)}-${padZero(now.getDate())}`; // YYYY-MM-DD
  const timeStr = `${padZero(now.getHours())}-${padZero(now.getMinutes())}-${padZero(now.getSeconds())}`; // HH-MM-SS

  writeAscii(
    bextView,
    0,
    `Stem: ${options.label ?? options.stemName} | Engine: ${options.engineType}`,
    256,
  ); // Description
  writeAscii(bextView, 256, 'AnnealMusic v1.5.0', 32); // Originator
  writeAscii(
    bextView,
    288,
    `${options.patchTitle.replace(/[^\x00-\x7F]/g, '')}_${options.patchHash}`,
    32,
  ); // OriginatorReference
  writeAscii(bextView, 320, dateStr, 10); // OriginationDate
  writeAscii(bextView, 330, timeStr, 8); // OriginationTime
  // TimeReference is 0 since all stems start at t=0 (offset 338, 8 bytes). Set implicitly to 0.
  bextView.setUint16(346, 0, true); // Version = 0 (offset 346, 2 bytes)
  // Reserved 254 bytes from offset 348 to 602 are 0.

  // 2. Generate iXML body
  const partialXml =
    options.partialIndex !== undefined
      ? `\n    <PARTIAL_INDEX>${options.partialIndex}</PARTIAL_INDEX>`
      : '';
  const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<IXML>
  <PROJECT>AnnealMusic</PROJECT>
  <SPEED>
    <FILE_SAMPLE_RATE>${sampleRate}</FILE_SAMPLE_RATE>
    <AUDIO_BIT_DEPTH>${options.bitDepth}</AUDIO_BIT_DEPTH>
  </SPEED>
  <TRACK_LIST>
    <TRACK>
      <CHANNEL_INDEX>1</CHANNEL_INDEX>
      <NAME>${options.stemName}</NAME>
      <FUNCTION>stem</FUNCTION>
    </TRACK>
  </TRACK_LIST>
  <USER>
    <STEM_NAME>${options.stemName}</STEM_NAME>
    <ENGINE_TYPE>${options.engineType}</ENGINE_TYPE>
    <PATCH_TITLE>${options.patchTitle}</PATCH_TITLE>
    <PATCH_HASH>${options.patchHash}</PATCH_HASH>${partialXml}
  </USER>
</IXML>`;

  const xmlBytes = new TextEncoder().encode(xmlString);
  const xmlLength = xmlBytes.length;
  const xmlPadding = xmlLength % 2 === 0 ? 0 : 1;
  const iXmlChunkSize = 8 + xmlLength + xmlPadding;

  // 3. Compute sizes
  const fmtSize = 16;
  const fmtChunkSize = 8 + fmtSize; // Chunk header + body
  const bextChunkSize = 8 + bextSize;
  const dataChunkSize = 8 + dataSize;

  const totalSize =
    12 + fmtChunkSize + bextChunkSize + iXmlChunkSize + dataChunkSize;
  const riffSize = totalSize - 8;

  const out = new ArrayBuffer(totalSize);
  const view = new DataView(out);

  let offset = 0;
  const writeStr = (s: string): void => {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
    offset += s.length;
  };

  // --- RIFF Header ---
  writeStr('RIFF');
  view.setUint32(offset, riffSize, true);
  offset += 4;
  writeStr('WAVE');

  // --- 'fmt ' Chunk ---
  writeStr('fmt ');
  view.setUint32(offset, fmtSize, true);
  offset += 4;
  view.setUint16(offset, options.bitDepth === 32 ? 3 : 1, true);
  offset += 2; // Format tag (1 = PCM, 3 = IEEE Float)
  view.setUint16(offset, channels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, options.bitDepth, true);
  offset += 2;

  // --- 'bext' Chunk ---
  writeStr('bext');
  view.setUint32(offset, bextSize, true);
  offset += 4;
  const bextBytes = new Uint8Array(bextBuffer);
  new Uint8Array(out, offset, bextSize).set(bextBytes);
  offset += bextSize;

  // --- 'iXML' Chunk ---
  writeStr('iXML');
  view.setUint32(offset, xmlLength, true);
  offset += 4;
  new Uint8Array(out, offset, xmlLength).set(xmlBytes);
  offset += xmlLength;
  if (xmlPadding > 0) {
    view.setUint8(offset, 0);
    offset += 1;
  }

  // --- 'data' Chunk ---
  writeStr('data');
  view.setUint32(offset, dataSize, true);
  offset += 4;

  // 4. Pack audio samples
  const chans: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    chans.push(buffer.getChannelData(c));
  }

  if (options.bitDepth === 24) {
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < channels; c++) {
        const channel = chans[c];
        const sample = channel ? (channel[i] ?? 0) : 0;
        // Clamp float sample to [-1.0, 1.0]
        const clamped = Math.max(-1.0, Math.min(1.0, sample));
        // Map to signed 24-bit range: [-8388608, 8388607]
        const intVal = clamped < 0 ? clamped * 8388608 : clamped * 8388607;
        const rounded = Math.round(intVal);

        // Pack 3 bytes (little-endian)
        view.setUint8(offset, rounded & 0xff);
        view.setUint8(offset + 1, (rounded >> 8) & 0xff);
        view.setUint8(offset + 2, (rounded >> 16) & 0xff);
        offset += 3;
      }
    }
  } else {
    // 32-bit IEEE Float
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < channels; c++) {
        const channel = chans[c];
        const sample = channel ? (channel[i] ?? 0) : 0;
        view.setFloat32(offset, sample, true);
        offset += 4;
      }
    }
  }

  return out;
}
