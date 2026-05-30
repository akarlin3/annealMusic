/* eslint-disable */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { validateFile } from './validate.js';
import { NodeRenderEngine } from '../engines/node.js';
import { BrowserRenderEngine } from '../engines/browser.js';
import { decodeState } from '@/share/encode.js';
import { SCHEMA_VERSION } from '@/share/schema.js';

export async function runStems(file: string, options: any): Promise<void> {
  // 1. Validate schema
  const validation = validateFile(file);
  if (!validation.valid) {
    console.error(`❌ Schema validation failed for piece file ${file}:`);
    validation.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }

  // 2. Resolve input payload string
  let payload = '';
  try {
    const content = fs.readFileSync(file, 'utf8').trim();
    if (content.startsWith('{')) {
      const json = JSON.parse(content);
      payload = json.payload || (json.base && json.base.payload);
    } else {
      payload = content;
    }
  } catch (err: any) {
    console.error(`❌ Failed to read file ${file}: ${err.message}`);
    process.exit(1);
  }

  const decoded = decodeState(SCHEMA_VERSION, payload);
  if (decoded.kind !== 'piece') {
    console.error(
      `❌ Expected a piece file for 'stems' command. Decoded kind is '${decoded.kind}'.`,
    );
    process.exit(1);
  }

  const pieceTitle = (decoded.piece?.title || 'piece').replace(/\s+/g, '_');

  // 3. Compute duration based on segments
  let durationSec = 30; // fallback default
  if (decoded.piece && Array.isArray(decoded.piece.segments)) {
    const totalMs = decoded.piece.segments.reduce(
      (acc: number, seg: any) => acc + (seg.durationMs || 0),
      0,
    );
    if (totalMs > 0) {
      durationSec = Math.ceil(totalMs / 1000);
    }
  }

  console.log(
    `📦 Starting Stems Export for Piece: "${decoded.piece?.title || 'Untitled'}"...`,
  );
  console.log(`- Engine:       ${options.engine.toUpperCase()}`);
  console.log(`- Duration:     ${durationSec}s (${durationSec * 1000}ms)`);
  console.log(
    `- Stems Option: ${options.perPartial ? 'Per-Partial' : 'Standard Slots'}`,
  );
  console.log(`- Master FX:    ${options.withFx ? 'Included' : 'Bypassed'}`);

  const outputDir = path.resolve(options.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const engine =
    options.engine === 'browser'
      ? new BrowserRenderEngine()
      : new NodeRenderEngine();

  try {
    const result = await engine.renderPiece(payload, {
      durationSec,
      sampleRate: 48000,
      bitDepth: 24,
      seed: 42,
      perPartial: options.perPartial,
      withFx: options.withFx,
    });

    console.log(`✨ Writing rendered stems to ${outputDir}...`);
    for (const [stemId, wavBuffer] of Object.entries(result.outputs)) {
      const stemFilename = `${pieceTitle}_${stemId}.wav`;
      const destPath = path.join(outputDir, stemFilename);
      fs.writeFileSync(destPath, Buffer.from(wavBuffer));
      console.log(
        `  - Exported: ${stemFilename} (${wavBuffer.byteLength} bytes)`,
      );
    }

    console.log(`✅ Stems export completed successfully!`);
  } catch (err: any) {
    console.error(`❌ Stems export failed: ${err.message}`);
    process.exit(1);
  }
}
