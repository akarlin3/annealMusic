/* eslint-disable */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { validateFile } from './validate.js';
import { NodeRenderEngine } from '../engines/node.js';
import { BrowserRenderEngine } from '../engines/browser.js';
import { decodeState } from '@/share/encode.js';
import { SCHEMA_VERSION } from '@/share/schema.js';

export async function runPiece(file: string, options: any): Promise<void> {
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
      `❌ Expected a piece file for 'piece' command. Decoded kind is '${decoded.kind}'.`,
    );
    process.exit(1);
  }

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

  const seed = options.seed ? parseInt(options.seed, 10) : 42;

  console.log(`🎵 Rendering Piece: "${decoded.piece?.title || 'Untitled'}"...`);
  console.log(`- Engine:       ${options.engine.toUpperCase()}`);
  console.log(`- Duration:     ${durationSec}s (${durationSec * 1000}ms)`);
  console.log(`- Seed:         ${seed}`);
  console.log(`- Output Path:  ${options.output}`);

  const outputDir = path.dirname(options.output);
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
      seed,
      perPartial: false,
      withFx: true,
    });

    const wavBuffer = result.outputs['master'];
    if (!wavBuffer) {
      throw new Error(`Engine did not return a master audio render.`);
    }

    fs.writeFileSync(options.output, Buffer.from(wavBuffer));
    console.log(
      `✅ Piece render completed successfully! Output saved to: ${options.output}`,
    );
  } catch (err: any) {
    console.error(`❌ Piece render failed: ${err.message}`);
    process.exit(1);
  }
}
