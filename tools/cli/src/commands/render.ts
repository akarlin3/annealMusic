/* eslint-disable */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { validateFile } from './validate.js';
import { NodeRenderEngine } from '../engines/node.js';
import { writeWavFile } from '../output/wavWriter.js';
import { decodeState } from '@/share/encode.js';
import { SCHEMA_VERSION } from '@/share/schema.js';

export interface RenderArgs {
  output: string;
  duration?: string;
  seed?: string;
  format?: string;
  rate?: string;
  depth?: string;
  engine?: string;
  perPartial?: boolean;
  withFx?: boolean;
  logFormat?: string;
  logOut?: string;
  logRate?: string;
  logMode?: string;
}

export async function runRender(
  inputFile: string,
  args: RenderArgs,
): Promise<void> {
  // 1. Validate schema first
  const validation = validateFile(inputFile);
  if (!validation.valid) {
    console.error(`Schema validation failed for ${inputFile}:`);
    validation.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }

  // 2. Resolve input payload string
  let payload = '';
  try {
    const content = fs.readFileSync(inputFile, 'utf8').trim();
    if (content.startsWith('{')) {
      const json = JSON.parse(content);
      payload = json.payload || (json.base && json.base.payload);
    } else {
      payload = content;
    }
  } catch (err: any) {
    console.error(`Failed to read file ${inputFile}: ${err.message}`);
    process.exit(1);
  }

  // 3. Decode metadata for filename options/defaults
  const decoded = decodeState(SCHEMA_VERSION, payload);
  if (decoded.kind !== 'patch') {
    console.error(
      `Expected a patch file for 'render' command. Use 'piece' or 'listening' for pieces.`,
    );
    process.exit(1);
  }

  // 4. Resolve options
  const durationSec = args.duration
    ? parseInt(args.duration.replace('s', ''), 10)
    : (decoded.durationSec ?? 30);
  const seed = args.seed ? parseInt(args.seed, 10) : 42;
  const sampleRate = args.rate ? parseInt(args.rate, 10) : 48000;
  const bitDepth = args.depth === '32' ? 32 : 24;
  const engineChoice = args.engine === 'browser' ? 'browser' : 'node';

  console.log(`Rendering patch from ${inputFile}...`);
  console.log(`- Engine:      ${engineChoice.toUpperCase()}`);
  console.log(`- Duration:    ${durationSec}s`);
  console.log(`- Seed:        ${seed}`);
  console.log(`- Output Path: ${args.output}`);

  if (engineChoice === 'node') {
    const engine = new NodeRenderEngine();
    try {
      const result = await engine.renderPatch(payload, {
        durationSec,
        sampleRate,
        bitDepth,
        seed,
        perPartial: args.perPartial,
        withFx: args.withFx,
        logFormat: args.logFormat,
        logOut: args.logOut,
        logRate: args.logRate ? parseInt(args.logRate, 10) : undefined,
        logMode: args.logMode,
      });

      // Save output(s)
      if (!args.perPartial && result.outputs['master']) {
        const outPath = args.output;
        const dir = path.dirname(outPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(outPath, Buffer.from(result.outputs['master']));
      } else {
        for (const [stemId, wavBuffer] of Object.entries(result.outputs)) {
          const outPath = args.output;
          const destPath = path.join(
            path.dirname(outPath),
            `${path.basename(outPath, path.extname(outPath))}_${stemId}${path.extname(outPath)}`,
          );
          const dir = path.dirname(destPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(destPath, Buffer.from(wavBuffer));
        }
      }
      console.log(`Render completed successfully!`);
    } catch (err: any) {
      console.error(`Render failed: ${err.message}`);
      process.exit(1);
    }
  } else {
    // Option B: Browser engine (will be implemented in CP2)
    console.error(
      `Browser engine (--engine browser) is selected. Running Option B...`,
    );
    const { BrowserRenderEngine } = await import('../engines/browser.js');
    const engine = new BrowserRenderEngine();
    try {
      const result = await engine.renderPatch(payload, {
        durationSec,
        sampleRate,
        bitDepth,
        seed,
        perPartial: args.perPartial,
        withFx: args.withFx,
        logFormat: args.logFormat,
        logOut: args.logOut,
        logRate: args.logRate ? parseInt(args.logRate, 10) : undefined,
        logMode: args.logMode,
      });
      for (const [stemId, wavBuffer] of Object.entries(result.outputs)) {
        fs.writeFileSync(args.output, Buffer.from(wavBuffer));
      }
      console.log(`Render completed successfully via Browser!`);
    } catch (err: any) {
      console.error(`Browser render failed: ${err.message}`);
      process.exit(1);
    }
  }
}
