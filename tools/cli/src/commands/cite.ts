/* eslint-disable */
import { getCitationBlock } from '../../../cite/bibtex-generator.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function runCiteCommand(): void {
  // Dynamically load the version from the workspace package.json
  let version = '5.7.0';
  try {
    const pkgPath = path.resolve(__dirname, '../../../../package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      version = pkg.version || '5.7.0';
    }
  } catch (e) {
    // Fallback to standard
  }

  console.log(getCitationBlock(version));
}
