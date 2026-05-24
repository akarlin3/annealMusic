import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, type AnnealMusicParams } from '@/state/params';
import {
  decodeParams,
  decodeState,
  encodeParams,
  encodeState,
} from '@/share/encode';
import { KEY_BOUNDS, SHARED_KEYS } from '@/share/schema';

/** Deterministic PRNG (mulberry32) so any failure reproduces. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundTo(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

/** Generate an in-bounds param set snapped to each key's precision grid. */
function randomParams(rng: () => number): AnnealMusicParams {
  const params: AnnealMusicParams = { ...DEFAULT_PARAMS };
  for (const key of SHARED_KEYS) {
    const { min, max, decimals } = KEY_BOUNDS[key];
    const value = min + rng() * (max - min);
    params[key] = roundTo(value, decimals);
  }
  return params;
}

describe('encodeParams / decodeParams', () => {
  it('round-trips in-bounds params exactly (property-based)', () => {
    const rng = makeRng(0xc0ffee);
    for (let i = 0; i < 500; i++) {
      const params = randomParams(rng);
      const { params: decoded, warnings } = decodeParams(encodeParams(params));
      expect(warnings, `iteration ${i} warnings`).toEqual([]);
      for (const key of SHARED_KEYS) {
        expect(decoded[key], `iteration ${i} key ${key}`).toBe(params[key]);
      }
    }
  });

  it('never includes volume in the payload', () => {
    expect(encodeParams(DEFAULT_PARAMS)).not.toContain('volume');
  });

  it('produces a readable default payload', () => {
    expect(encodeParams(DEFAULT_PARAMS)).toBe(
      'rootFreq=110&spread=1.00&density=6&coupling=0.30&drift=0.50&brightness=0.50&space=0.40',
    );
  });

  it('never throws on 1000 random fuzz strings', () => {
    const rng = makeRng(0xbadbeef);
    const charset = 'abcdefghij0123456789=&:.-_%# \t';
    for (let i = 0; i < 1000; i++) {
      const len = Math.floor(rng() * 64);
      let s = '';
      for (let j = 0; j < len; j++) {
        s += charset[Math.floor(rng() * charset.length)];
      }
      expect(() => decodeParams(s)).not.toThrow();
      const result = decodeParams(s);
      expect(result).toHaveProperty('params');
      expect(Array.isArray(result.warnings)).toBe(true);
    }
  });

  it('clamps out-of-range values and warns', () => {
    const { params, warnings } = decodeParams('coupling=9&rootFreq=10');
    expect(params.coupling).toBe(1); // max
    expect(params.rootFreq).toBe(55); // min
    expect(warnings.length).toBe(2);
    expect(warnings.some((w) => w.includes('coupling'))).toBe(true);
    expect(warnings.some((w) => w.includes('rootFreq'))).toBe(true);
  });

  it('ignores unknown keys with a warning but keeps valid ones', () => {
    const { params, warnings } = decodeParams('tempo=5&coupling=0.42');
    expect(params.coupling).toBe(0.42);
    expect('tempo' in params).toBe(false);
    expect(warnings.some((w) => w.includes('tempo'))).toBe(true);
  });

  it('never includes volume even if present in payload', () => {
    const { params, warnings } = decodeParams('volume=0.9');
    expect('volume' in params).toBe(false);
    expect(warnings.some((w) => w.includes('volume'))).toBe(true);
  });

  it('drops non-numeric values with a warning', () => {
    const { params, warnings } = decodeParams('drift=abc&space=');
    expect('drift' in params).toBe(false);
    expect('space' in params).toBe(false);
    expect(warnings.length).toBe(2);
  });

  it('warns on malformed pairs missing "="', () => {
    const { params, warnings } = decodeParams('garbage&coupling=0.5');
    expect(params.coupling).toBe(0.5);
    expect(warnings.some((w) => w.includes('garbage'))).toBe(true);
  });

  it('returns empty result for empty payload', () => {
    expect(decodeParams('')).toEqual({ params: {}, warnings: [] });
  });
});

describe('encodeState / decodeState (schema v2)', () => {
  it('round-trips engine selection + namespaced engine params', () => {
    const fm = { modRatio: 2.5, modIndex: 4, feedback: 0.3 };
    const payload = encodeState(DEFAULT_PARAMS, 'fm', fm);
    const decoded = decodeState(2, payload);

    expect(decoded.warnings).toEqual([]);
    expect(decoded.engineId).toBe('fm');
    expect(decoded.engineParams.fm).toEqual(fm);
    for (const key of SHARED_KEYS) {
      expect(decoded.params[key]).toBe(DEFAULT_PARAMS[key]);
    }
  });

  it('writes the engine selector first and omits params for engines with none', () => {
    expect(encodeState(DEFAULT_PARAMS, 'sine', {})).toBe(
      `e=sine&${encodeParams(DEFAULT_PARAMS)}`,
    );
  });

  it('clamps out-of-range engine params and warns', () => {
    const decoded = decodeState(2, 'e=fm&fm.modRatio=99&fm.modIndex=-5');
    expect(decoded.engineParams.fm?.modRatio).toBe(4); // max
    expect(decoded.engineParams.fm?.modIndex).toBe(0); // min
    expect(decoded.warnings.length).toBe(2);
  });

  it('defaults to sine for an unknown engine id, with a warning', () => {
    const decoded = decodeState(2, 'e=granular&coupling=0.5');
    expect(decoded.engineId).toBe('sine');
    expect(decoded.params.coupling).toBe(0.5);
    expect(decoded.warnings.some((w) => w.includes('granular'))).toBe(true);
  });

  it('treats a v1 payload as the sine engine and ignores engine keys', () => {
    const decoded = decodeState(1, 'e=fm&coupling=0.5&fm.modRatio=2');
    expect(decoded.engineId).toBe('sine');
    expect(decoded.params.coupling).toBe(0.5);
    expect(decoded.engineParams).toEqual({});
    expect(decoded.warnings.length).toBe(2); // e= and fm.modRatio both ignored
  });
});
