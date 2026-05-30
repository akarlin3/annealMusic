/* eslint-disable */
import * as fs from 'node:fs';
import { decodeState } from '@/share/encode.js';
import { SCHEMA_VERSION } from '@/share/schema.js';

export function printFileInfo(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  let payload = '';
  try {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (content.startsWith('{')) {
      const json = JSON.parse(content);
      payload = json.payload || (json.base && json.base.payload) || '';
    } else {
      payload = content;
    }
  } catch (err: any) {
    console.error(`Failed to parse file: ${err.message}`);
    process.exit(1);
  }

  if (!payload) {
    console.error('No payload found in the input file.');
    process.exit(1);
  }

  const decoded = decodeState(SCHEMA_VERSION, payload);
  console.log(`=========================================`);
  console.log(` ANNEALMUSIC FILE METADATA`);
  console.log(`=========================================`);
  console.log(`Kind:            ${decoded.kind.toUpperCase()}`);

  if (decoded.kind === 'patch') {
    console.log(`Engine:          ${decoded.engineId}`);
    console.log(`Session Mode:    ${decoded.mode}`);
    if (decoded.arcId) {
      console.log(`Arc ID:          ${decoded.arcId}`);
      console.log(`Arc Duration:    ${decoded.durationSec}s`);
    }
    console.log(`Tuning System:   ${decoded.tuning?.system ?? 'equal'}`);
    console.log(`-----------------------------------------`);
    console.log(`Grouped Params:`);
    for (const [k, v] of Object.entries(decoded.params)) {
      console.log(`  - ${k}: ${v}`);
    }
    const engParams = decoded.engineParams[decoded.engineId];
    if (engParams && Object.keys(engParams).length > 0) {
      console.log(`Engine Params (${decoded.engineId}):`);
      for (const [k, v] of Object.entries(engParams)) {
        console.log(`  - ${k}: ${v}`);
      }
    }
  } else if (decoded.kind === 'piece') {
    const p = decoded.piece;
    console.log(`Title:           ${p.title ?? 'Untitled'}`);
    console.log(`Description:     ${p.description ?? 'None'}`);
    console.log(
      `Tempo:           ${p.tempoBpm ? `${p.tempoBpm} BPM` : 'Default'}`,
    );
    console.log(
      `Variation Seed:  ${p.variationSeed ?? 'Deterministic default'}`,
    );
    console.log(`Segments Count:  ${p.segments.length}`);
    console.log(`-----------------------------------------`);
    console.log(`Segments:`);
    p.segments.forEach((seg, i) => {
      console.log(
        `  [${i + 1}] Type: ${seg.type} | Duration: ${seg.durationMs ? `${seg.durationMs / 1000}s` : 'Open'}`,
      );
    });
    if (p.bellSchedule && p.bellSchedule.length > 0) {
      console.log(`Bell Schedule:`);
      p.bellSchedule.forEach((bell) => {
        console.log(
          `  - ${bell.bellId}: trigger=${bell.trigger}, vol=${bell.volume}`,
        );
      });
    }
  } else if (decoded.kind === 'listening-session') {
    const ls = decoded.listeningSession;
    console.log(`Title:           ${ls.title ?? 'Untitled Listening Session'}`);
    console.log(`Description:     ${ls.description ?? 'None'}`);
    console.log(`Settle-In:       ${ls.settleInMs / 1000}s`);
    console.log(`Integration:     ${ls.integrationMs / 1000}s`);
    console.log(`-----------------------------------------`);
    if (ls.bellSchedule && ls.bellSchedule.length > 0) {
      console.log(`Bell Schedule:`);
      ls.bellSchedule.forEach((bell) => {
        console.log(
          `  - ${bell.bellId}: trigger=${bell.trigger}, vol=${bell.volume}`,
        );
      });
    }
  }
  console.log(`=========================================`);
}
