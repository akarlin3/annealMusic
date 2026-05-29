import { describe, expect, it } from 'vitest';
import { CONTROL_DEFS } from '@/state/params';
import {
  KEY_BOUNDS,
  SHARED_KEYS,
  SCHEMA_VERSION,
  SUPPORTED_SCHEMA_VERSIONS,
  decimalsForStep,
} from '@/share/schema';

describe('schema', () => {
  it('ships schema version 8', () => {
    expect(SCHEMA_VERSION).toBe(8);
  });

  it('still decodes legacy schema versions 1 through 7', () => {
    expect(SUPPORTED_SCHEMA_VERSIONS).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('excludes volume from shared keys', () => {
    expect(SHARED_KEYS).not.toContain('volume');
  });

  it('shares exactly the CONTROL_DEFS keys, in order', () => {
    expect([...SHARED_KEYS]).toEqual(CONTROL_DEFS.map((d) => d.key));
  });

  it('derives decimals from step', () => {
    expect(decimalsForStep(1)).toBe(0);
    expect(decimalsForStep(2)).toBe(0);
    expect(decimalsForStep(0.01)).toBe(2);
    expect(decimalsForStep(0.5)).toBe(2);
  });

  // Drift guard: KEY_BOUNDS must agree with CONTROL_DEFS for every shared key.
  it('KEY_BOUNDS agrees with CONTROL_DEFS', () => {
    for (const def of CONTROL_DEFS) {
      const bound = KEY_BOUNDS[def.key as keyof typeof KEY_BOUNDS];
      expect(bound, `${def.key} present in KEY_BOUNDS`).toBeDefined();
      expect(bound.min, `${def.key} min`).toBe(def.min);
      expect(bound.max, `${def.key} max`).toBe(def.max);
      expect(bound.decimals, `${def.key} decimals`).toBe(
        decimalsForStep(def.step),
      );
    }
  });
});
