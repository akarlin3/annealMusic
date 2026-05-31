#!/usr/bin/env node
/* eslint-disable */

import { Command } from 'commander';
import { runRender } from './commands/render.js';
import { validateFile } from './commands/validate.js';
import { printFileInfo } from './commands/info.js';
import { runVerifyParity } from './commands/verifyParity.js';
import { runCiteCommand } from './commands/cite.js';
import { runExportCommand } from './commands/export.js';
import { runReproduceCommand } from './commands/reproduce.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateSweepCombinations } from './output/sweep.js';
import { runPythonConverter } from './output/converter.js';

const program = new Command();

program
  .name('annealmusic')
  .description('Standalone CLI + Batch Renderer for AnnealMusic')
  .version('5.7.0');

// 1. Single Render Command
program
  .command('render <file>')
  .description('Render a patch file to a WAV audio file')
  .option('-o, --output <output>', 'Output WAV file path', 'output.wav')
  .option('-d, --duration <duration>', 'Render duration (e.g. 30s)', '30s')
  .option('-s, --seed <seed>', 'Deterministic random seed', '42')
  .option('-f, --format <format>', 'Audio format (wav|opus|flac)', 'wav')
  .option('-r, --rate <rate>', 'Sample rate in Hz', '48000')
  .option('--depth <depth>', 'Bit depth (24|32)', '24')
  .option('--engine <engine>', 'Render engine (node|browser)', 'node')
  .option('--per-partial', 'Export stems per-partial', false)
  .option('--with-fx', 'Include master post-fx tail in output', true)
  .option(
    '--log-format <logFormat>',
    'Session log output format (jsonl|csv|hdf5|parquet)',
    'jsonl',
  )
  .option('--log-out <logOut>', 'Session log output file path')
  .option('--log-rate <logRate>', 'Session log sample rate in Hz', '50')
  .option(
    '--log-mode <logMode>',
    'Session log details mode (lightweight|standard|full|research-extreme)',
    'standard',
  )
  .action(async (file, options) => {
    await runRender(file, options);
  });

// 2. Batch / Sweep Command
program
  .command('batch <file>')
  .description('Execute batch renders with parameter sweeps')
  .option('-o, --output <dir>', 'Output directory', './out/')
  .option(
    '-j, --jobs <jobs>',
    'Number of parallel jobs',
    String(
      Math.max(
        1,
        (navigator as any)?.hardwareConcurrency
          ? (navigator as any).hardwareConcurrency - 1
          : 4,
      ),
    ),
  )
  .option('--resume', 'Resume from a previous run', false)
  .option('--engine <engine>', 'Render engine (node|browser)', 'node')
  .action(async (file, options) => {
    const { runBatch } = await import('./commands/batch.js');
    await runBatch(file, options);
  });

// 3. Stems Export Command
program
  .command('stems <file>')
  .description('Export stems for a piece file')
  .option('-o, --output <dir>', 'Output stems directory', './stems/')
  .option('--per-partial', 'Export stems per-partial', false)
  .option('--with-fx', 'Include master post-fx tail in output', true)
  .option('--engine <engine>', 'Render engine (node|browser)', 'node')
  .action(async (file, options) => {
    const { runStems } = await import('./commands/stems.js');
    await runStems(file, options);
  });

// 4. Render Listening Session Command
program
  .command('listening <file>')
  .description(
    'Render a listening session with settle-in, integration, and bells',
  )
  .option('-o, --output <output>', 'Output WAV file path', 'session.wav')
  .option('--engine <engine>', 'Render engine (node|browser)', 'node')
  .action(async (file, options) => {
    const { runListening } = await import('./commands/listening.js');
    await runListening(file, options);
  });

// 5. Render Piece Command
program
  .command('piece <file>')
  .description('Render a piece to a WAV audio file')
  .option('-o, --output <output>', 'Output WAV file path', 'piece.wav')
  .option('-s, --seed <seed>', 'Deterministic random seed', '42')
  .option('--engine <engine>', 'Render engine (node|browser)', 'node')
  .action(async (file, options) => {
    const { runPiece } = await import('./commands/piece.js');
    await runPiece(file, options);
  });

// 6. Schema Validation Utility
program
  .command('validate <file>')
  .description('Validate a patch or sweep file against the schema manifest')
  .action((file) => {
    const result = validateFile(file);
    if (result.valid) {
      console.log(
        `✅ File ${file} is fully valid against the schema manifest.`,
      );
    } else {
      console.error(`❌ Schema validation failed for ${file}:`);
      result.errors.forEach((err) => console.error(`  - ${err}`));
      process.exit(1);
    }
  });

program
  .command('export <studyId>')
  .description('Export a study fully reproducible bundle archive')
  .option('-o, --output <output>', 'Output bundle ZIP path')
  .option('--include-data', 'Include anonymized subject clinical data', false)
  .action(async (studyId, options) => {
    await runExportCommand(studyId, options);
  });

program
  .command('reproduce <bundle>')
  .description(
    'Run schema validation, asset parity, and analysis script execution on a study bundle',
  )
  .action(async (bundle) => {
    await runReproduceCommand(bundle);
  });

// 7. Info Command
program
  .command('info <file>')
  .description(
    'Print detailed metadata of a patch, piece, or listening session',
  )
  .action((file) => {
    printFileInfo(file);
  });

// 8. Verify Parity Command
program
  .command('verify-parity <fileA> <fileB>')
  .description('Compare two WAV files to check for sample parity')
  .action(async (fileA, fileB) => {
    await runVerifyParity(fileA, fileB);
  });

// 8.5 Cite Command
program
  .command('cite')
  .description('Print academic citation for AnnealMusic (BibTeX, APA, Chicago)')
  .option(
    '-f, --format <format>',
    'one of: all | bibtex | apa | chicago',
    'all',
  )
  .action((opts: { format?: string }) => {
    const fmt = (opts.format ?? 'all').toLowerCase();
    const allowed = ['all', 'bibtex', 'apa', 'chicago'];
    runCiteCommand((allowed.includes(fmt) ? fmt : 'all') as any);
  });

// 9. Sweep helper commands for Slurm job arrays
program
  .command('sweep-get-payload <file> <index>')
  .description('Print the payload for a specific sweep combination index')
  .action((file, indexStr) => {
    try {
      const sweep = JSON.parse(fs.readFileSync(file, 'utf8'));
      const combinations = generateSweepCombinations(sweep);
      const index = parseInt(indexStr, 10);
      if (index < 0 || index >= combinations.length) {
        console.error(
          `Index ${index} is out of bounds [0, ${combinations.length - 1}]`,
        );
        process.exit(1);
      }
      process.stdout.write(combinations[index]!.payload);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('sweep-get-filename <file> <index>')
  .description('Print the filename for a specific sweep combination index')
  .action((file, indexStr) => {
    try {
      const sweep = JSON.parse(fs.readFileSync(file, 'utf8'));
      const combinations = generateSweepCombinations(sweep);
      const index = parseInt(indexStr, 10);
      if (index < 0 || index >= combinations.length) {
        console.error(
          `Index ${index} is out of bounds [0, ${combinations.length - 1}]`,
        );
        process.exit(1);
      }
      process.stdout.write(combinations[index]!.filename);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// 10. Datalog Conversion Command
program
  .command('convert <file>')
  .description('Convert a JSONL session log to CSV, HDF5, or Parquet')
  .requiredOption(
    '-f, --format <format>',
    'Output scientific format (csv|hdf5|parquet)',
  )
  .option('-o, --output <output>', 'Output file path')
  .action((file, options) => {
    try {
      const format = options.format.toLowerCase() as 'csv' | 'hdf5' | 'parquet';
      const output =
        options.output ||
        `${path.basename(file, path.extname(file))}.${format}`;
      console.log(`Converting datalog ${file}...`);
      console.log(`- Format: ${format.toUpperCase()}`);
      console.log(`- Output: ${output}`);
      runPythonConverter({
        inputJsonl: file,
        outputFile: output,
        format,
      });
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// Run parser
program.parse(process.argv);
