/* eslint-disable */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { validateFile } from './validate.js';
import { NodeRenderEngine } from '../engines/node.js';
import { BrowserRenderEngine } from '../engines/browser.js';
import {
  generateSweepCombinations,
  parseDuration,
  SweepFile,
  SweepCombination,
} from '../output/sweep.js';

interface RenderRecord {
  filename: string;
  payload: string;
  seed: number;
  duration_sec: number;
  sha256: string;
}

function computeSha256(buffer: ArrayBuffer | Buffer): string {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export async function runBatch(file: string, options: any): Promise<void> {
  const startedAt = new Date().toISOString();

  // 1. Validate file exists and is schema valid
  const validation = validateFile(file);
  if (!validation.valid) {
    console.error(`❌ Schema validation failed for sweep file ${file}:`);
    validation.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }

  // 2. Parse and generate combinations
  let sweep: SweepFile;
  try {
    sweep = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err: any) {
    console.error(`❌ Failed to parse sweep file: ${err.message}`);
    process.exit(1);
  }

  const durationSec = parseDuration(sweep.duration);
  const combinations = generateSweepCombinations(sweep);
  const totalJobs = combinations.length;

  console.log(`🚀 Starting Batch Parameter Sweep...`);
  console.log(`- Base Payload:   ${sweep.base.payload.slice(0, 40)}...`);
  console.log(`- Sweep Size:     ${totalJobs} combinations`);
  console.log(`- Engine:         ${options.engine.toUpperCase()}`);
  console.log(`- Jobs / Threads: ${options.jobs}`);
  console.log(`- Resume Mode:    ${options.resume ? 'ON' : 'OFF'}`);

  const outputDir = path.resolve(options.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const manifestPath = path.join(outputDir, 'manifest.json');
  let completedRenders: RenderRecord[] = [];
  const completedFilenames = new Set<string>();

  // 3. Handle Resume
  if (options.resume && fs.existsSync(manifestPath)) {
    try {
      const oldManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (Array.isArray(oldManifest.renders)) {
        for (const record of oldManifest.renders) {
          const filePath = path.join(outputDir, record.filename);
          if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
            completedRenders.push(record);
            completedFilenames.add(record.filename);
          }
        }
      }
      console.log(
        `✨ Resuming batch sweep: ${completedRenders.length}/${totalJobs} renders already exist. Skipping...`,
      );
    } catch (err: any) {
      console.warn(
        `⚠️ Warning: Could not parse existing manifest.json (${err.message}). Starting fresh.`,
      );
    }
  }

  const tasksToRun = combinations.filter(
    (combo) => !completedFilenames.has(combo.filename),
  );
  const newRenders: RenderRecord[] = [];
  const limit = Math.max(1, parseInt(options.jobs, 10));

  if (tasksToRun.length === 0) {
    console.log(`✅ All renders already completed. Nothing to do.`);
    writeManifest(
      startedAt,
      new Date().toISOString(),
      sweep,
      options.engine,
      completedRenders,
      manifestPath,
    );
    return;
  }

  console.log(`🏃 Processing ${tasksToRun.length} remaining renders...`);

  // Concurrency Queue Runner
  let activeCount = 0;
  let currentIndex = 0;

  await new Promise<void>((resolve, reject) => {
    function runNext() {
      if (currentIndex >= tasksToRun.length && activeCount === 0) {
        resolve();
        return;
      }

      while (activeCount < limit && currentIndex < tasksToRun.length) {
        const index = currentIndex++;
        const combo = tasksToRun[index]!;
        activeCount++;

        const percent = (
          ((totalJobs - tasksToRun.length + index + 1) / totalJobs) *
          100
        ).toFixed(1);
        console.log(
          `[${percent}%] Rendering combination: ${combo.filename}...`,
        );

        executeSingleRender(combo, options.engine, durationSec, outputDir)
          .then((record) => {
            newRenders.push(record);
            activeCount--;
            runNext();
          })
          .catch((err) => {
            activeCount--;
            console.error(
              `❌ Job failed for ${combo.filename}: ${err.message}`,
            );
            reject(err);
          });
      }
    }
    runNext();
  });

  const allRenders = [...completedRenders, ...newRenders];
  writeManifest(
    startedAt,
    new Date().toISOString(),
    sweep,
    options.engine,
    allRenders,
    manifestPath,
  );
  console.log(
    `✅ Batch parameter sweep completed! Manifest written to ${manifestPath}`,
  );
}

async function executeSingleRender(
  combo: SweepCombination,
  engineChoice: string,
  durationSec: number,
  outputDir: string,
): Promise<RenderRecord> {
  const engine =
    engineChoice === 'browser'
      ? new BrowserRenderEngine()
      : new NodeRenderEngine();
  const filePath = path.join(outputDir, combo.filename);

  const result = await engine.renderPatch(combo.payload, {
    durationSec,
    sampleRate: 48000,
    bitDepth: 24,
    seed: combo.seed,
    perPartial: false,
    withFx: true,
  });

  const wavBuffer = result.outputs['master'];
  if (!wavBuffer) {
    throw new Error(
      `Engine did not return a master render for combination: ${combo.filename}`,
    );
  }

  fs.writeFileSync(filePath, Buffer.from(wavBuffer));
  const sha256 = computeSha256(wavBuffer);

  return {
    filename: combo.filename,
    payload: combo.payload,
    seed: combo.seed,
    duration_sec: durationSec,
    sha256,
  };
}

function writeManifest(
  startedAt: string,
  completedAt: string,
  sweep: SweepFile,
  engine: string,
  renders: RenderRecord[],
  manifestPath: string,
) {
  const manifestContent = {
    annealmusic_cli_version: '5.2.0',
    schema_version: sweep.base.schema_ver ?? 20,
    engine,
    base_patch: sweep.base,
    sweep_definition: sweep,
    started_at: startedAt,
    completed_at: completedAt,
    total_jobs:
      sweep.seeds.length *
      sweep.varies.reduce(
        (acc, v) => acc * (v.values?.length || v.range?.steps || 1),
        1,
      ),
    renders,
  };

  fs.writeFileSync(
    manifestPath,
    JSON.stringify(manifestContent, null, 2),
    'utf8',
  );
}
