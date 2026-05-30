import { encodeWav } from '@/export/WavEncoder.js';
import type { WavEncoderOptions } from '@/export/WavEncoder.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Encodes an AudioBuffer into a WAV/BWF file and writes it to disk.
 */
export function writeWavFile(
  buffer: AudioBuffer,
  filePath: string,
  options: Omit<
    WavEncoderOptions,
    'patchTitle' | 'patchHash' | 'engineType'
  > & {
    patchTitle?: string;
    patchHash?: string;
    engineType?: string;
  },
): void {
  const wavBuffer = encodeWav(buffer, {
    bitDepth: options.bitDepth,
    stemName: options.stemName,
    label: options.label,
    patchTitle: options.patchTitle ?? 'CLI Render',
    patchHash: options.patchHash ?? 'headless',
    engineType: options.engineType ?? 'sine',
    partialIndex: options.partialIndex,
  });

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, Buffer.from(wavBuffer));
}
