/**
 * CI gate: the embed bundle (JS + CSS, gzipped) must stay under 50 KB. The
 * embed is a guest in someone else's page; bundle size is a hard limit, not an
 * aspiration. Run after `npm run build`.
 */
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LIMIT_BYTES = 50 * 1024;
const root = fileURLToPath(new URL('..', import.meta.url));
const files = ['dist/assets/embed.js', 'dist/assets/embed.css'];

let total = 0;
const report = [];
for (const rel of files) {
  const path = `${root}${rel}`;
  if (!existsSync(path)) continue; // embed.css is optional (styles may be inline)
  const gz = gzipSync(readFileSync(path)).length;
  total += gz;
  report.push(`  ${rel}: ${(gz / 1024).toFixed(2)} KB gz`);
}

if (total === 0) {
  console.error('embed bundle not found — did `npm run build` run?');
  process.exit(1);
}

console.log('Embed bundle (gzipped):');
console.log(report.join('\n'));
console.log(
  `  total: ${(total / 1024).toFixed(2)} KB / ${LIMIT_BYTES / 1024} KB`,
);

if (total > LIMIT_BYTES) {
  console.error(
    `\nEmbed bundle too large: ${(total / 1024).toFixed(2)} KB > 50 KB. ` +
      'Keep the embed free of the audio core (engines, orchestrator, React).',
  );
  process.exit(1);
}
console.log('\nEmbed bundle within budget.');
