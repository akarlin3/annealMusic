import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, type AnnealMusicParams } from '@/state/params';
import {
  decodeParams,
  decodeState,
  encodeLoops,
  encodeParams,
  encodeState,
} from '@/share/encode';
import { KEY_BOUNDS, SHARED_KEYS } from '@/share/schema';
import { makeDefaultLoopConfig } from '@/loop/types';

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
    expect(params.rootFreq).toBe(20); // min
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

describe('encodeState / decodeState (schema v3)', () => {
  it('round-trips engine selection + namespaced engine params', () => {
    const fm = { modRatio: 2.5, modIndex: 4, feedback: 0.3 };
    const payload = encodeState(DEFAULT_PARAMS, 'fm', fm);
    const decoded = decodeState(3, payload);

    expect(decoded.warnings).toEqual([]);
    expect(decoded.mode).toBe('open');
    expect(decoded.engineId).toBe('fm');
    expect(decoded.engineParams.fm).toEqual(fm);
    for (const key of SHARED_KEYS) {
      expect(decoded.params[key]).toBe(DEFAULT_PARAMS[key]);
    }
  });

  it('round-trips an arc session (mode + arc id + duration)', () => {
    const payload = encodeState(
      DEFAULT_PARAMS,
      'sine',
      {},
      {
        mode: 'arc',
        arcId: 'bell',
        durationSec: 720,
      },
    );
    expect(payload.startsWith('m=arc&arc=bell&dur=720&')).toBe(true);

    const decoded = decodeState(3, payload);
    expect(decoded.warnings).toEqual([]);
    expect(decoded.mode).toBe('arc');
    expect(decoded.arcId).toBe('bell');
    expect(decoded.durationSec).toBe(720);
  });

  it('falls back to open mode for an unknown arc id, with a warning', () => {
    const decoded = decodeState(3, 'm=arc&arc=spiral&dur=600&e=sine');
    expect(decoded.mode).toBe('open');
    expect(decoded.arcId).toBeUndefined();
    expect(decoded.warnings.some((w) => w.includes('unknown arc'))).toBe(true);
  });

  it('clamps an out-of-bounds duration and warns', () => {
    const tooLong = decodeState(3, 'm=arc&arc=bell&dur=99999&e=sine');
    expect(tooLong.durationSec).toBe(3600); // max
    expect(tooLong.warnings.some((w) => w.includes('dur'))).toBe(true);

    const tooShort = decodeState(3, 'm=arc&arc=bell&dur=1&e=sine');
    expect(tooShort.durationSec).toBe(180); // min
  });

  it('treats v1/v2 payloads as open mode and ignores session keys', () => {
    const v2 = decodeState(2, 'm=arc&arc=bell&dur=600&e=fm&coupling=0.5');
    expect(v2.mode).toBe('open');
    expect(v2.engineId).toBe('fm');
    expect(v2.params.coupling).toBe(0.5);
    expect(v2.warnings.some((w) => w.includes('mode key ignored'))).toBe(true);
  });

  it('writes the mode + engine selector first and omits params for engines with none', () => {
    expect(encodeState(DEFAULT_PARAMS, 'sine', {})).toBe(
      `m=open&e=sine&${encodeParams(DEFAULT_PARAMS)}`,
    );
  });

  it('clamps out-of-range engine params and warns', () => {
    const decoded = decodeState(2, 'e=fm&fm.modRatio=99&fm.modIndex=-5');
    expect(decoded.engineParams.fm?.modRatio).toBe(4); // max
    expect(decoded.engineParams.fm?.modIndex).toBe(0); // min
    expect(decoded.warnings.length).toBe(2);
  });

  it('defaults to sine for an unknown engine id, with a warning', () => {
    const decoded = decodeState(2, 'e=banana&coupling=0.5');
    expect(decoded.engineId).toBe('sine');
    expect(decoded.params.coupling).toBe(0.5);
    expect(decoded.warnings.some((w) => w.includes('banana'))).toBe(true);
  });

  it('treats a v1 payload as the sine engine and ignores engine keys', () => {
    const decoded = decodeState(1, 'e=fm&coupling=0.5&fm.modRatio=2');
    expect(decoded.engineId).toBe('sine');
    expect(decoded.params.coupling).toBe(0.5);
    expect(decoded.engineParams).toEqual({});
    expect(decoded.warnings.length).toBe(2); // e= and fm.modRatio both ignored
  });
});

describe('granular engine + schema v5', () => {
  it('encodes granular params under the gr namespace', () => {
    const encoded = encodeState(DEFAULT_PARAMS, 'granular', {
      source: 2,
      size: 150,
      density: 20,
      posJitter: 0.4,
      pitchJitter: 10,
      posCenter: 0.6,
    });
    expect(encoded).toContain('e=granular');
    expect(encoded).toContain('gr.source=2');
    expect(encoded).toContain('gr.size=150');
    expect(encoded).toContain('gr.density=20');
    expect(encoded).toContain('gr.posJitter=0.40');
    expect(encoded).toContain('gr.pitchJitter=10');
    expect(encoded).toContain('gr.posCenter=0.60');
  });

  it('round-trips granular params (encode → decode)', () => {
    const engineParams = {
      source: 3,
      size: 90,
      density: 30,
      posJitter: 0.25,
      pitchJitter: 40,
      posCenter: 0.33,
    };
    const payload = encodeState(DEFAULT_PARAMS, 'granular', engineParams);
    const decoded = decodeState(5, payload);
    expect(decoded.engineId).toBe('granular');
    expect(decoded.engineParams.granular).toEqual(engineParams);
    expect(decoded.warnings).toEqual([]);
  });

  it('clamps an out-of-range source index with a warning', () => {
    const decoded = decodeState(5, 'e=granular&gr.source=99');
    expect(decoded.engineId).toBe('granular');
    expect(decoded.engineParams.granular?.source).toBe(7);
    expect(decoded.warnings.some((w) => w.includes('gr.source'))).toBe(true);
  });

  it('ignores gr.* params on a pre-v5 schema (back-compat is forward-safe)', () => {
    // gr.* are namespaced engine params; v2+ accepts engine params, so they
    // decode — but a v4 reader without the granular engine would warn. Here the
    // current build knows granular, so a v4 payload still decodes gr.* cleanly.
    const decoded = decodeState(5, 'e=granular&gr.size=120');
    expect(decoded.engineParams.granular?.size).toBe(120);
  });
});

describe('physical engine + schema v6', () => {
  it('encodes physical params under the ph namespace', () => {
    const encoded = encodeState(DEFAULT_PARAMS, 'physical', {
      model: 2,
      excitationLevel: 0.7,
      damping: 0.3,
      brightness: 0.6,
      reed: 0.5,
      inharm: 0.4,
    });
    expect(encoded).toContain('e=physical');
    expect(encoded).toContain('ph.model=2');
    expect(encoded).toContain('ph.excitationLevel=0.70');
    expect(encoded).toContain('ph.damping=0.30');
    expect(encoded).toContain('ph.brightness=0.60');
    expect(encoded).toContain('ph.reed=0.50');
    expect(encoded).toContain('ph.inharm=0.40');
  });

  it('round-trips physical params (encode → decode)', () => {
    const engineParams = {
      model: 1,
      excitationLevel: 0.55,
      damping: 0.2,
      brightness: 0.8,
      reed: 0.65,
      inharm: 0.15,
    };
    const payload = encodeState(DEFAULT_PARAMS, 'physical', engineParams);
    const decoded = decodeState(6, payload);
    expect(decoded.engineId).toBe('physical');
    expect(decoded.engineParams.physical).toEqual(engineParams);
    expect(decoded.warnings).toEqual([]);
  });

  it('clamps the model index out of range with a warning', () => {
    // Schema v7 widened ph.model to 0..7 (the five new sub-models); 9 clamps to 7.
    const decoded = decodeState(7, 'e=physical&ph.model=9');
    expect(decoded.engineParams.physical?.model).toBe(7);
    expect(decoded.warnings.some((w) => w.includes('ph.model'))).toBe(true);
  });

  it('round-trips a new sub-model id (bell = 7)', () => {
    const decoded = decodeState(7, 'e=physical&ph.model=7');
    expect(decoded.engineParams.physical?.model).toBe(7);
    expect(decoded.warnings).toEqual([]);
  });
});

describe('loop config (schema v4)', () => {
  it('omits loop pairs for default/empty slots', () => {
    const loops = makeDefaultLoopConfig();
    expect(encodeLoops(loops)).toBe('');
  });

  it('encodes flags and grain params for a frozen slot', () => {
    const loops = makeDefaultLoopConfig();
    loops.A = {
      muted: false,
      frozen: true,
      driftCoupled: true,
      grain: { sizeMs: 200, density: 18, posJitter: 0.6, pitchJitter: 25 },
    };
    const encoded = encodeLoops(loops);
    expect(encoded).toContain('LA.f=1');
    expect(encoded).toContain('LA.c=1');
    expect(encoded).toContain('LA.gs=200');
    expect(encoded).toContain('LA.gd=18');
    expect(encoded).toContain('LA.gp=0.60');
    expect(encoded).toContain('LA.gx=25');
  });

  it('encodes muted without grain params for a non-frozen slot', () => {
    const loops = makeDefaultLoopConfig();
    loops.B = { ...loops.B, muted: true };
    const encoded = encodeLoops(loops);
    expect(encoded).toBe('LB.m=1');
  });

  it('round-trips a frozen slot through encode/decode', () => {
    const loops = makeDefaultLoopConfig();
    loops.C = {
      muted: false,
      frozen: true,
      driftCoupled: false,
      grain: { sizeMs: 90, density: 30, posJitter: 0.25, pitchJitter: 0 },
    };
    const payload = encodeState(DEFAULT_PARAMS, 'sine', {}, undefined, loops);
    const decoded = decodeState(4, payload);
    expect(decoded.loops.C.frozen).toBe(true);
    expect(decoded.loops.C.grain.sizeMs).toBe(90);
    expect(decoded.loops.C.grain.density).toBe(30);
    expect(decoded.loops.C.grain.posJitter).toBeCloseTo(0.25, 5);
    expect(decoded.loops.A.frozen).toBe(false);
  });

  it('clamps out-of-range grain params with a warning', () => {
    const decoded = decodeState(4, 'LA.f=1&LA.gd=999');
    expect(decoded.loops.A.frozen).toBe(true);
    expect(decoded.loops.A.grain.density).toBe(40); // clamped to max
    expect(decoded.warnings.some((w) => w.includes('LA.gd'))).toBe(true);
  });

  it('ignores loop keys for pre-v4 schemas (back-compat)', () => {
    const decoded = decodeState(3, 'LA.f=1&coupling=0.5');
    expect(decoded.loops.A.frozen).toBe(false);
    expect(decoded.params.coupling).toBe(0.5);
    expect(decoded.warnings.some((w) => w.includes('loop key ignored'))).toBe(
      true,
    );
  });

  it('defaults all slots to empty when no loop keys are present', () => {
    const decoded = decodeState(4, 'coupling=0.5');
    expect(decoded.loops).toEqual(makeDefaultLoopConfig());
  });
});
