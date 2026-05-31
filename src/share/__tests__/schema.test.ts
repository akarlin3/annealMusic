import { describe, expect, it } from 'vitest';
import { CONTROL_DEFS } from '@/state/params';
import {
  KEY_BOUNDS,
  SHARED_KEYS,
  SCHEMA_VERSION,
  SUPPORTED_SCHEMA_VERSIONS,
  decimalsForStep,
} from '@/share/schema';
import {
  encodeSonification,
  decodeSonificationPayload,
  decodeState,
} from '@/share/encode';

describe('schema', () => {
  it('ships schema version 21', () => {
    expect(SCHEMA_VERSION).toBe(21);
  });

  it('still decodes legacy schema versions 1 through 20', () => {
    expect(SUPPORTED_SCHEMA_VERSIONS).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    ]);
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

  it('encodes and decodes a sonification state perfectly', () => {
    const state = {
      title: 'Ocean Temperature Sonification',
      description: 'Mapping sea surface temperatures from 1990-2020',
      mappingSpec: {
        sources: [
          {
            id: 'sst',
            type: 'file' as const,
            columns: ['time', 'temp'],
            data: [],
          },
        ],
        rules: [
          {
            sourceId: 'sst',
            column: 'temp',
            targetType: 'param' as const,
            targetKey: 'brightness',
            transform: {
              type: 'linear' as const,
              rawMin: 15,
              rawMax: 25,
              outMin: 0.2,
              outMax: 0.8,
            },
          },
        ],
      },
      durationMs: 30000,
      playbackSpeed: 1.2,
      loop: false,
    };

    const encoded = encodeSonification(state);
    expect(encoded).toContain('kind=sonification');
    expect(encoded).toContain('data=');

    const decoded = decodeSonificationPayload(encoded);
    expect(decoded.title).toBe(state.title);
    expect(decoded.durationMs).toBe(state.durationMs);
    expect(decoded.mappingSpec.rules[0]?.column).toBe('temp');

    const decodedState = decodeState(21, encoded);
    expect(decodedState.kind).toBe('sonification');
    if (decodedState.kind === 'sonification') {
      expect(decodedState.sonification.title).toBe(state.title);
    }
  });
});
