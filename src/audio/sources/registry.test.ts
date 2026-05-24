import { describe, expect, it } from 'vitest';
import {
  SOURCES,
  clampSourceIndex,
  sourceById,
  sourceByIndex,
} from '@/audio/sources/registry';

describe('source registry', () => {
  it('ships 6–10 sources', () => {
    expect(SOURCES.length).toBeGreaterThanOrEqual(6);
    expect(SOURCES.length).toBeLessThanOrEqual(10);
  });

  // Licensing is non-negotiable: every shipped source MUST carry a license.
  it('every source has a non-empty license', () => {
    for (const s of SOURCES) {
      expect(s.license, `source ${s.id} is missing a license`).toBeTruthy();
      expect(s.license.trim().length).toBeGreaterThan(0);
    }
  });

  it('index equals array position (append-only wire contract)', () => {
    SOURCES.forEach((s, i) => expect(s.index).toBe(i));
  });

  it('ids are unique and asset URLs follow /sources/<id>.opus', () => {
    const ids = new Set(SOURCES.map((s) => s.id));
    expect(ids.size).toBe(SOURCES.length);
    for (const s of SOURCES) {
      expect(s.url).toBe(`/sources/${s.id}.opus`);
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
      expect(s.durationMs).toBeGreaterThan(0);
    }
  });

  it('fundamentalHz is null or a positive frequency', () => {
    for (const s of SOURCES) {
      if (s.fundamentalHz !== null) expect(s.fundamentalHz).toBeGreaterThan(0);
    }
  });

  it('lookups by index and id agree', () => {
    for (const s of SOURCES) {
      expect(sourceByIndex(s.index)).toBe(s);
      expect(sourceById(s.id)).toBe(s);
    }
    expect(sourceByIndex(999)).toBeUndefined();
    expect(sourceById('nope')).toBeUndefined();
  });

  it('clampSourceIndex keeps values in range', () => {
    expect(clampSourceIndex(-5)).toBe(0);
    expect(clampSourceIndex(999)).toBe(SOURCES.length - 1);
    expect(clampSourceIndex(2.4)).toBe(2);
    expect(clampSourceIndex(NaN)).toBe(0);
  });
});
