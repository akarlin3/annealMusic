import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ConvertOptions {
  inputJsonl: string;
  outputFile: string;
  format: 'csv' | 'hdf5' | 'parquet';
}

export function runPythonConverter(opts: ConvertOptions): void {
  let scriptPath = path.join(__dirname, 'converter.py');
  if (!fs.existsSync(scriptPath)) {
    // Development fallback 1: tools/cli/src/output/converter.py (relative to tools/cli/dist/index.js)
    scriptPath = path.join(__dirname, '..', 'src', 'output', 'converter.py');
  }
  if (!fs.existsSync(scriptPath)) {
    // Development fallback 2: tools/cli/src/output/converter.py (relative to tsx execution in tools/cli/src/)
    scriptPath = path.join(__dirname, 'output', 'converter.py');
  }
  if (!fs.existsSync(scriptPath)) {
    // Fallback 3: look at tools/cli/src/output/converter.py from root
    scriptPath = path.resolve(
      process.cwd(),
      'tools',
      'cli',
      'src',
      'output',
      'converter.py',
    );
  }

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Python converter script not found: ${scriptPath}`);
  }

  if (!fs.existsSync(opts.inputJsonl)) {
    throw new Error(`Input JSONL file does not exist: ${opts.inputJsonl}`);
  }

  // Attempt to run with python3 first, fall back to python
  let pythonCommand = 'python3';
  let result = spawnSync(
    pythonCommand,
    [scriptPath, opts.inputJsonl, opts.outputFile, opts.format],
    {
      encoding: 'utf-8',
    },
  );

  if (result.error || result.status !== 0) {
    pythonCommand = 'python';
    result = spawnSync(
      pythonCommand,
      [scriptPath, opts.inputJsonl, opts.outputFile, opts.format],
      {
        encoding: 'utf-8',
      },
    );
  }

  if (result.status !== 0) {
    const errorMsg =
      result.stderr ||
      result.stdout ||
      'Unknown error occurred during execution.';
    console.error(`\n❌ Scientific format conversion failed!`);
    console.error(
      `Command: ${pythonCommand} ${scriptPath} ${opts.inputJsonl} ${opts.outputFile} ${opts.format}`,
    );
    console.error(`Output/Details:\n${errorMsg}`);

    if (
      errorMsg.includes('ImportError') ||
      errorMsg.includes('pandas') ||
      errorMsg.includes('tables') ||
      errorMsg.includes('pyarrow')
    ) {
      console.warn(`\n💡 Troubleshooting Guide:`);
      console.warn(
        `Please ensure you have Python 3 and the required packages installed:`,
      );
      console.warn(`  pip install pandas pyarrow tables`);
    }

    throw new Error(`Format conversion failed: ${errorMsg.trim()}`);
  }

  console.log(result.stdout.trim());
}
