import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const manifestV21Path = join(rootDir, 'schema', 'manifest.v21.json');
const manifestPath = join(rootDir, 'schema', 'manifest.json');
const oscNamespacePath = join(rootDir, 'src', 'research', 'osc', 'OSCNamespace.ts');
const sonificationTypesPath = join(rootDir, 'src', 'sonification', 'types.ts');
const backendSchemasPath = join(rootDir, 'api', 'app', 'schemas.py');

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
const polymorphic = manifest.polymorphicSchemas;

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
const expectedOscContent = `${before}\n${oscBlock}\n${after}`;

// 4. Validate polymorphic schema constraints
const isCheckMode = process.argv.includes('--check');

// Check Sonification Source Types
const sonificationTypesContent = readFileSync(sonificationTypesPath, 'utf8');
const expectedSourceTypeLine = `export type SourceType = ${polymorphic.sonificationMapping.sourceTypes.map(t => `'${t}'`).join(' | ')};`;
if (!sonificationTypesContent.includes(expectedSourceTypeLine)) {
  console.error(`❌ Schema mismatch: sonification source types in types.ts do not match manifest!`);
  console.error(`Expected: ${expectedSourceTypeLine}`);
  process.exit(1);
}

// Check Backend Schemas
const backendSchemasContent = readFileSync(backendSchemasPath, 'utf8');

// Check StepType Literal
const expectedStepTypeLine = `StepType = Literal[${polymorphic.lessonStep.stepTypes.map(t => `"${t}"`).join(', ')}]`;
if (!backendSchemasContent.includes(expectedStepTypeLine)) {
  console.error(`❌ Schema mismatch: lesson step types in schemas.py do not match manifest!`);
  console.error(`Expected: ${expectedStepTypeLine}`);
  process.exit(1);
}

// Check Reproducibility Level Literal
const expectedReproduceLevelLine = `reproducibility_level: Literal[${polymorphic.studyExport.reproducibilityLevels.map(t => `"${t}"`).join(', ')}]`;
if (!backendSchemasContent.includes(expectedReproduceLevelLine)) {
  console.error(`❌ Schema mismatch: study export reproducibility levels in schemas.py do not match manifest!`);
  console.error(`Expected: ${expectedReproduceLevelLine}`);
  process.exit(1);
}

// Check Randomization Scheme Literal
const expectedRandomSchemeLine = `randomization_scheme: Literal[${polymorphic.experimentResponse.randomizationSchemes.map(t => `"${t}"`).join(', ')}]`;
if (!backendSchemasContent.includes(expectedRandomSchemeLine)) {
  console.error(`❌ Schema mismatch: randomization schemes in schemas.py do not match manifest!`);
  console.error(`Expected: ${expectedRandomSchemeLine}`);
  process.exit(1);
}

if (isCheckMode) {
  if (oscContent !== expectedOscContent) {
    console.error('❌ Schema mismatch: OSCNamespace.ts is out of sync with manifest.json!');
    process.exit(1);
  }
  console.log('✅ CI Schema Verification Passed: All client and backend polymorphic schemas match manifest.json.');
  process.exit(0);
} else {
  writeFileSync(oscNamespacePath, expectedOscContent, 'utf8');
  console.log('✅ Successfully compiled, synced, and validated all schemas from manifest.json.');
}
