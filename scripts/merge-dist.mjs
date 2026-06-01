import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function copyFolderSync(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach((element) => {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    if (fs.lstatSync(fromPath).isDirectory()) {
      copyFolderSync(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  });
}

function mergeBuilds() {
  const distPath = path.join(rootDir, 'dist');
  const distResearchPath = path.join(rootDir, 'dist-research');
  const distLearnPath = path.join(rootDir, 'dist-learn');

  if (!fs.existsSync(distPath)) {
    console.error('Error: Main build output "dist/" does not exist. Run main build first.');
    process.exit(1);
  }

  // 1. Merge Research Console
  if (fs.existsSync(distResearchPath)) {
    console.log('[Merge] Merging research console into dist...');
    fs.copyFileSync(
      path.join(distResearchPath, 'research.html'),
      path.join(distPath, 'research.html')
    );
    copyFolderSync(
      path.join(distResearchPath, 'assets'),
      path.join(distPath, 'assets')
    );
  } else {
    console.warn('[Merge] Warning: dist-research/ not found. Skipping research merge.');
  }

  // 2. Merge Learn Curriculum
  if (fs.existsSync(distLearnPath)) {
    console.log('[Merge] Merging learn curriculum into dist...');
    fs.copyFileSync(
      path.join(distLearnPath, 'learn.html'),
      path.join(distPath, 'learn.html')
    );
    copyFolderSync(
      path.join(distLearnPath, 'assets'),
      path.join(distPath, 'assets')
    );
  } else {
    console.warn('[Merge] Warning: dist-learn/ not found. Skipping learn merge.');
  }

  console.log('[Merge] Successfully merged all consoles into dist!');
}

mergeBuilds();
