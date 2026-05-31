#!/usr/bin/env node
/**
 * CI gate (v6.2): every audio clip in the library manifest MUST declare a valid
 * license, and every non-`original-by-you` clip MUST carry an attribution.
 * License attribution is non-negotiable — this fails the build otherwise.
 *
 * Usage: node tools/check-clip-licenses.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(__dirname, "..", "api", "data", "clip_library.json");
const VALID = new Set(["CC0", "CC-BY", "original-by-you", "licensed-third-party"]);

function main() {
  let raw;
  try {
    raw = readFileSync(MANIFEST, "utf8");
  } catch (e) {
    console.error(`✗ cannot read clip manifest at ${MANIFEST}: ${e.message}`);
    process.exit(1);
  }

  const data = JSON.parse(raw);
  const clips = data.clips ?? [];
  if (!Array.isArray(clips) || clips.length === 0) {
    console.error("✗ clip manifest has no clips");
    process.exit(1);
  }

  const errors = [];
  const seen = new Set();
  for (const c of clips) {
    const id = c.slug ?? "(no slug)";
    if (!c.slug) errors.push(`${id}: missing slug`);
    if (seen.has(c.slug)) errors.push(`${id}: duplicate slug`);
    seen.add(c.slug);
    if (!c.license) {
      errors.push(`${id}: missing license`);
    } else if (!VALID.has(c.license)) {
      errors.push(`${id}: invalid license '${c.license}'`);
    } else if (c.license !== "original-by-you") {
      const attr = (c.attribution ?? "").trim();
      if (!attr) errors.push(`${id}: license '${c.license}' requires an attribution`);
    }
  }

  if (errors.length) {
    console.error(`✗ clip license check failed (${errors.length}):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`✓ clip license check passed: ${clips.length} clips, all licensed.`);
}

main();
