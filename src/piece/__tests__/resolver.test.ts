import { describe, expect, it } from 'vitest';
import { resolveVariations } from '../resolver';
import type { VariationPoint } from '../types';

describe('Variation Resolver', () => {
  const baseParams = {
    rootFreq: 110,
    spread: 1.0,
    density: 6,
    brightness: 0.5,
    space: 0.4,
    coupling: 0.3,
    drift: 0.5,
    volume: 0.35,
  };

  it('returns baseParams unchanged if variations list is empty or undefined', () => {
    expect(resolveVariations(baseParams, [], 123)).toEqual(baseParams);
    expect(resolveVariations(baseParams, undefined, 123)).toEqual(baseParams);
  });

  it('resolves range constraints within bounds', () => {
    const variations: VariationPoint[] = [
      {
        id: 'v1',
        paramKey: 'brightness',
        constraint: { type: 'range', min: 0.2, max: 0.8 },
        rule: 'per-play',
      },
    ];

    // Seed 10
    const res1 = resolveVariations(baseParams, variations, 10);
    expect(res1.brightness).toBeGreaterThanOrEqual(0.2);
    expect(res1.brightness).toBeLessThanOrEqual(0.8);

    // Seed 999
    const res2 = resolveVariations(baseParams, variations, 999);
    expect(res2.brightness).toBeGreaterThanOrEqual(0.2);
    expect(res2.brightness).toBeLessThanOrEqual(0.8);

    // Different seed results in different value
    expect(res1.brightness).not.toBe(res2.brightness);

    // Same seed is completely identical
    const res3 = resolveVariations(baseParams, variations, 10);
    expect(res3.brightness).toBe(res1.brightness);
  });

  it('resolves enum constraints by selecting from choices list', () => {
    const choices = [110, 220, 440];
    const variations: VariationPoint[] = [
      {
        id: 'v2',
        paramKey: 'rootFreq',
        constraint: { type: 'enum', choices },
        rule: 'per-play',
      },
    ];

    for (let seed = 0; seed < 20; seed++) {
      const res = resolveVariations(baseParams, variations, seed);
      expect(choices).toContain(res.rootFreq);
    }
  });

  it('resolves relative constraints within percentage deviations', () => {
    const variations: VariationPoint[] = [
      {
        id: 'v3',
        paramKey: 'space',
        constraint: { type: 'relative', percent: 20 }, // 0.4 +- 20% = [0.32, 0.48]
        rule: 'per-play',
      },
    ];

    for (let seed = 0; seed < 10; seed++) {
      const res = resolveVariations(baseParams, variations, seed);
      expect(res.space).toBeGreaterThanOrEqual(0.319);
      expect(res.space).toBeLessThanOrEqual(0.481);
    }
  });

  it('resolves correlated constraints based on another resolved target parameter', () => {
    const variations: VariationPoint[] = [
      {
        id: 'v_ind',
        paramKey: 'brightness',
        constraint: { type: 'range', min: 0.1, max: 0.9 },
        rule: 'per-play',
      },
      {
        id: 'v_corr',
        paramKey: 'space',
        constraint: {
          type: 'correlated',
          targetParam: 'brightness',
          coefficient: -0.5, // space decreases when brightness increases
        },
        rule: 'per-play',
      },
    ];

    for (let seed = 0; seed < 10; seed++) {
      const res = resolveVariations(baseParams, variations, seed);
      const brightDelta = res.brightness! - baseParams.brightness;
      const expectedSpace = baseParams.space - 0.5 * brightDelta;

      // Expect space value to be exactly the correlated value, within floating accuracy
      expect(Math.abs(res.space! - expectedSpace)).toBeLessThan(0.01);
    }
  });
});
