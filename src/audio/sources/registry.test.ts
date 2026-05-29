import { describe, expect, it } from 'vitest';
import {
  SOURCES,
  clampSourceIndex,
  sourceById,
  sourceByIndex,
  resolveSource,
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

  describe('resolveSource', () => {
    it('resolves bare numbers', () => {
      const res = resolveSource(2);
      expect(res.type).toBe('bundled');
      expect(res.id).toBe('tapeorgan');
      expect(res.url).toBe('/sources/tapeorgan.opus');
    });

    it('resolves bare numeric strings', () => {
      const res = resolveSource('2');
      expect(res.type).toBe('bundled');
      expect(res.id).toBe('tapeorgan');
    });

    it('resolves bare string IDs', () => {
      const res = resolveSource('tapeorgan');
      expect(res.type).toBe('bundled');
      expect(res.id).toBe('tapeorgan');
    });

    it('resolves b: prefixed bundled sources', () => {
      const res = resolveSource('b:tapeorgan');
      expect(res.type).toBe('bundled');
      expect(res.id).toBe('tapeorgan');
    });

    it('resolves u: prefixed user sources', () => {
      const res = resolveSource('u:a5e4b10b-e419-4f1a-b808-a8d47de24c10');
      expect(res.type).toBe('user');
      expect(res.id).toBe('a5e4b10b-e419-4f1a-b808-a8d47de24c10');
      expect(res.url).toBe(
        '/api/v1/user-sources/a5e4b10b-e419-4f1a-b808-a8d47de24c10',
      );
      expect(res.label).toBe('User Source');
    });

    it('falls back to glasspad for invalid indices or IDs', () => {
      const res1 = resolveSource(999);
      expect(res1.id).toBe('glasspad');

      const res2 = resolveSource('b:doesnotexist');
      expect(res2.id).toBe('glasspad');

      const res3 = resolveSource('doesnotexist');
      expect(res3.id).toBe('glasspad');
    });
  });
});
