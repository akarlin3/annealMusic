import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LENGTH_IDS, INTENTION_IDS, CHARACTER_IDS } from '@/library/taxonomy';

/**
 * Drift guard: the client taxonomy must stay in sync with the server vocabulary
 * in api/app/library_taxonomy.py. If you add a value on one side, add it on the
 * other — this test keeps the two honest.
 */
function pyFrozenset(name: string): string[] {
  const src = readFileSync('api/app/library_taxonomy.py', 'utf8');
  const re = new RegExp(`${name}[^=]*=\\s*frozenset\\(\\s*{([^}]*)}`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`Could not parse ${name} from library_taxonomy.py`);
  const body = m[1] ?? '';
  return Array.from(body.matchAll(/["']([a-z_]+)["']/g))
    .map((x) => x[1] as string)
    .sort();
}

describe('editorial taxonomy parity (TS ↔ Python)', () => {
  it('length categories match', () => {
    expect([...LENGTH_IDS].sort()).toEqual(pyFrozenset('LENGTH_CATEGORIES'));
  });
  it('intentions match', () => {
    expect([...INTENTION_IDS].sort()).toEqual(pyFrozenset('INTENTIONS'));
  });
  it('character tags match', () => {
    expect([...CHARACTER_IDS].sort()).toEqual(pyFrozenset('CHARACTER_TAGS'));
  });
});
