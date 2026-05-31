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

const ROOTS = [
  'src/history',
  'src/library',
  'src/admin/LibraryCuration.tsx',
  // v6.3 — the Learn progress + recommendation surfaces carry the highest
  // engagement-loop risk, so they are now lexically gated too.
  'src/learn',
];

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

/**
 * The gate targets engagement-loop *copy* — not CSS styling identifiers. Class
 * names like `difficulty-badge` or `duration-badge` are layout, not achievement
 * badges, so we strip `className`/`class` attribute values (string and `{…}`
 * template forms) before scanning. User-facing text and string literals remain.
 */
function stripClassAttributes(src: string): string {
  return src.replace(
    /\b(?:className|class)\s*=\s*(?:"[^"]*"|'[^']*'|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/g,
    'class=""',
  );
}

describe('calm-by-design lexical gate (v4.5)', () => {
  const files = ROOTS.flatMap(walk);

  it('scans a non-empty set of v4.5 UI files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  // Match each banned term as a whole word (with an optional trailing plural),
  // so the gate flags engagement-loop *copy* ("badge", "badges", "streak") but
  // not code identifiers that merely contain the substring (e.g. a `StatusBadge`
  // component or a `LeaderboardView`). Class names are already stripped above.
  const bannedRe = (token: string): RegExp =>
    new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i');

  for (const file of ROOTS.flatMap(walk)) {
    it(`contains no engagement-loop language: ${file}`, () => {
      const text = stripClassAttributes(
        stripComments(readFileSync(file, 'utf8')),
      ).toLowerCase();
      for (const token of BANNED) {
        expect(
          bannedRe(token).test(text),
          `Banned engagement-loop term "${token}" found in ${file}`,
        ).toBe(false);
      }
    });
  }
});
