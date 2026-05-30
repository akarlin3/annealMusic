import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * v4.5 Calm-by-design CI gate (hard review item).
 *
 * The history + library surfaces must never grow engagement-loop language.
 * This test scans the user-facing source of those modules for banned tokens.
 * Comments are stripped first so the gate flags *copy*, not our own
 * documentation (which legitimately says things like "no streaks").
 */

const BANNED = [
  'streak',
  'level up',
  'achievement',
  'daily goal',
  'daily quest',
  'badge',
  'leaderboard',
  "don't break",
  'keep it up',
  'you missed',
  'days in a row',
];

const ROOTS = ['src/history', 'src/library', 'src/admin/LibraryCuration.tsx'];

function walk(path: string): string[] {
  const st = statSync(path);
  if (st.isFile())
    return path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : [];
  return readdirSync(path)
    .filter((f) => !f.includes('__tests__'))
    .flatMap((f) => walk(join(path, f)));
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments
    .replace(/(^|[^:])\/\/.*$/gm, '$1') // line comments (avoid http://)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' '); // JSX comments
}

describe('calm-by-design lexical gate (v4.5)', () => {
  const files = ROOTS.flatMap(walk);

  it('scans a non-empty set of v4.5 UI files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of ROOTS.flatMap(walk)) {
    it(`contains no engagement-loop language: ${file}`, () => {
      const text = stripComments(readFileSync(file, 'utf8')).toLowerCase();
      for (const token of BANNED) {
        expect(
          text.includes(token),
          `Banned engagement-loop term "${token}" found in ${file}`,
        ).toBe(false);
      }
    });
  }
});
