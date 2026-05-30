/* eslint-disable */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { validateFile } from './validate.js';
import { NodeRenderEngine } from '../engines/node.js';
import { BrowserRenderEngine } from '../engines/browser.js';
import { decodeState } from '@/share/encode.js';
import { SCHEMA_VERSION } from '@/share/schema.js';

export async function runListening(file: string, options: any): Promise<void> {
  // 1. Validate schema
  const validation = validateFile(file);
  if (!validation.valid) {
    console.error(
      `❌ Schema validation failed for listening session file ${file}:`,
    );
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
  if (decoded.kind !== 'listening-session') {
    console.error(
      `❌ Expected a listening session file for 'listening' command. Decoded kind is '${decoded.kind}'.`,
    );
    process.exit(1);
  }

  const ls = decoded.listeningSession;

  // 3. Compute duration based on category or default
  let durationSec = 600; // default 10 minutes
  if (ls?.lengthCategory) {
    const cat = ls.lengthCategory.toLowerCase();
    if (cat === 'short') {
      durationSec = 300; // 5 mins
    } else if (cat === 'medium') {
      durationSec = 600; // 10 mins
    } else if (cat === 'long') {
      durationSec = 1200; // 20 mins
    } else {
      const parsed = parseInt(cat, 10);
      if (!isNaN(parsed) && parsed > 0) {
        durationSec = parsed;
      }
    }
  }

  console.log(
    `🧘 Rendering Listening Session: "${ls?.title || 'Untitled Session'}"...`,
  );
  console.log(`- Engine:       ${options.engine.toUpperCase()}`);
  console.log(
    `- Duration:     ${durationSec}s (${(durationSec / 60).toFixed(1)} mins)`,
  );
  console.log(`- Settle-in:    ${(ls?.settleInMs || 0) / 1000}s`);
  console.log(`- Integration:  ${(ls?.integrationMs || 0) / 1000}s`);
  console.log(`- Scheduled Bells: ${ls?.bellSchedule?.length || 0} events`);
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
    const result = await engine.renderListeningSession(payload, {
      durationSec,
      sampleRate: 48000,
      bitDepth: 24,
      seed: 42,
      perPartial: false,
      withFx: true,
    });

    const wavBuffer = result.outputs['master'];
    if (!wavBuffer) {
      throw new Error(`Engine did not return a master audio render.`);
    }

    fs.writeFileSync(options.output, Buffer.from(wavBuffer));
    console.log(
      `✅ Listening session render completed successfully! Output saved to: ${options.output}`,
    );
  } catch (err: any) {
    console.error(`❌ Listening session render failed: ${err.message}`);
    process.exit(1);
  }
}
