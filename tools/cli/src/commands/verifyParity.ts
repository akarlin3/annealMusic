/* eslint-disable */
import * as fs from 'node:fs';
import { OfflineAudioContext } from 'node-web-audio-api';

export async function runVerifyParity(
  fileA: string,
  fileB: string,
): Promise<void> {
  if (!fs.existsSync(fileA)) {
    console.error(`File not found: ${fileA}`);
    process.exit(1);
  }
  if (!fs.existsSync(fileB)) {
    console.error(`File not found: ${fileB}`);
    process.exit(1);
  }

  console.log(`Analyzing audio parity between:`);
  console.log(`- File A: ${fileA}`);
  console.log(`- File B: ${fileB}`);

  // Create an offline context just to decode audio data
  const ctx = new OfflineAudioContext(1, 1, 48000);

  const bufA = fs.readFileSync(fileA);
  const bufB = fs.readFileSync(fileB);

  try {
    const audioA = await ctx.decodeAudioData(
      bufA.buffer.slice(bufA.byteOffset, bufA.byteOffset + bufA.byteLength),
    );
    const audioB = await ctx.decodeAudioData(
      bufB.buffer.slice(bufB.byteOffset, bufB.byteOffset + bufB.byteLength),
    );

    if (audioA.numberOfChannels !== audioB.numberOfChannels) {
      console.error(
        `❌ Mismatch in channel count: A has ${audioA.numberOfChannels}, B has ${audioB.numberOfChannels}`,
      );
      process.exit(1);
    }
    if (audioA.sampleRate !== audioB.sampleRate) {
      console.error(
        `❌ Mismatch in sample rate: A has ${audioA.sampleRate}Hz, B has ${audioB.sampleRate}Hz`,
      );
      process.exit(1);
    }
    if (audioA.length !== audioB.length) {
      console.error(
        `⚠️ Length mismatch: A has ${audioA.length} frames, B has ${audioB.length} frames`,
      );
    }

    const channels = audioA.numberOfChannels;
    const length = Math.min(audioA.length, audioB.length);
    let totalSqError = 0;
    let sampleCount = 0;
    let maxDiff = 0;

    for (let c = 0; c < channels; c++) {
      const dataA = audioA.getChannelData(c);
      const dataB = audioB.getChannelData(c);

      for (let i = 0; i < length; i++) {
        const sampleA = dataA[i] ?? 0;
        const sampleB = dataB[i] ?? 0;
        const diff = sampleA - sampleB;
        totalSqError += diff * diff;
        sampleCount++;

        const absDiff = Math.abs(diff);
        if (absDiff > maxDiff) {
          maxDiff = absDiff;
        }
      }
    }

    const mse = totalSqError / sampleCount;
    const rmse = Math.sqrt(mse);

    console.log(`-----------------------------------------`);
    console.log(`Parity Metrics:`);
    console.log(`- Frames Compared:  ${length}`);
    console.log(`- Max Difference:   ${maxDiff.toExponential(6)}`);
    console.log(`- Mean Squared Err: ${mse.toExponential(6)}`);
    console.log(`- Root Mean Sq Err: ${rmse.toExponential(6)}`);
    console.log(`-----------------------------------------`);

    const threshold = 1e-4;
    if (mse < threshold) {
      console.log(
        `✅ EXCELLENT PARITY: Audio samples are functionally identical (MSE < ${threshold})`,
      );
    } else {
      console.log(
        `⚠️ PARITY DIVERGENCE: Sound output differs significantly (MSE >= ${threshold})`,
      );
    }
  } catch (err: any) {
    console.error(`Failed to decode audio files: ${err.message}`);
    process.exit(1);
  }
}
