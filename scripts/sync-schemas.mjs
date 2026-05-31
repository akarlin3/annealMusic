import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const manifestV21Path = join(rootDir, 'schema', 'manifest.v21.json');
const manifestPath = join(rootDir, 'schema', 'manifest.json');
const oscNamespacePath = join(rootDir, 'src', 'research', 'osc', 'OSCNamespace.ts');

// 1. Establish single canonical schema location
if (existsSync(manifestV21Path)) {
  copyFileSync(manifestV21Path, manifestPath);
}

if (!existsSync(manifestPath)) {
  console.error(`❌ Schema manifest not found at: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const sharedKeys = manifest.sharedKeys;

// 2. Generate the OSC param types block
let oscBlock = `export const OSC_PARAM_TYPES: Record<ParamKey, 'f' | 'i'> = {\n`;
for (const key of Object.keys(sharedKeys)) {
  const type = key === 'density' ? 'i' : 'f';
  oscBlock += `  ${key}: '${type}',\n`;
}
// Add volume as it is a core param not in sharedKeys
oscBlock += `  volume: 'f',\n`;
oscBlock += `};`;

// 3. Read and update OSCNamespace.ts
if (!existsSync(oscNamespacePath)) {
  console.error(`❌ OSCNamespace.ts not found at: ${oscNamespacePath}`);
  process.exit(1);
}

const oscContent = readFileSync(oscNamespacePath, 'utf8');
const startAnchor = '// OSC_PARAM_TYPES_START';
const endAnchor = '// OSC_PARAM_TYPES_END';

const startIndex = oscContent.indexOf(startAnchor);
const endIndex = oscContent.indexOf(endAnchor);

if (startIndex === -1 || endIndex === -1) {
  console.error('❌ Could not find OSC_PARAM_TYPES anchors in OSCNamespace.ts');
  process.exit(1);
}

const before = oscContent.substring(0, startIndex + startAnchor.length);
const after = oscContent.substring(endIndex);
const expectedContent = `${before}\n${oscBlock}\n${after}`;

const isCheckMode = process.argv.includes('--check');

if (isCheckMode) {
  if (oscContent !== expectedContent) {
    console.error('❌ Schema mismatch: OSCNamespace.ts is out of sync with manifest.json!');
    console.error('👉 Run "npm run sync-schemas" to re-generate client mappings.');
    process.exit(1);
  }
  console.log('✅ CI Schema Verification Passed: OSCNamespace.ts is in sync.');
  process.exit(0);
} else {
  writeFileSync(oscNamespacePath, expectedContent, 'utf8');
  console.log('✅ Successfully compiled and synced parameters from manifest.json to OSCNamespace.ts');
}
