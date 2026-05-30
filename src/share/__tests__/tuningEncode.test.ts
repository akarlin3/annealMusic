/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import {
  encodeState,
  decodeState,
  encodePiece,
  decodePiecePayload,
} from '../encode';
import { DEFAULT_PARAMS } from '@/state/params';
import type { TuningRef } from '@/audio/tuning/types';

describe('Tuning Schema v17 Encoding/Decoding', () => {
  it('correctly round-trips a patch state with custom tuning system', () => {
    const tuning: TuningRef = {
      system: 'just-7',
      referenceA4Hz: 432,
    };
    const encoded = encodeState(
      DEFAULT_PARAMS,
      'sine',
      {},
      undefined,
      undefined,
      tuning,
    );
    expect(encoded).toContain('t.system=just-7');
    expect(encoded).toContain('t.ref_a4=432');

    const decoded = decodeState(17, encoded);
    expect(decoded.kind).toBe('patch');
    if (decoded.kind === 'patch') {
      expect(decoded.tuning).toBeDefined();
      expect(decoded.tuning?.system).toBe('just-7');
      expect(decoded.tuning?.referenceA4Hz).toBe(432);
    }
  });

  it('correctly round-trips a piece defaults and segment-level tuning overrides', () => {
    const piece = {
      title: 'Tuning Exploration Piece',
      defaultsState: {
        params: DEFAULT_PARAMS,
        engineId: 'sine' as const,
        engineParams: {},
        tuning: {
          system: 'pythagorean' as const,
          referenceA4Hz: 440,
        },
      },
      segments: [
        {
          type: 'fixed' as const,
          durationMs: 5000,
          config: {
            tuning: {
              system: 'just-5' as const,
              referenceA4Hz: 432,
            },
          },
        },
        {
          type: 'fixed' as const,
          durationMs: 4000,
          config: {}, // no tuning, should inherit
        },
      ],
    };

    const encoded = encodePiece(piece);
    expect(encoded).toContain('def.t.system=pythagorean');
    expect(encoded).toContain('seg0.t.system=just-5');
    expect(encoded).toContain('seg0.t.ref_a4=432');

    const decoded = decodePiecePayload(encoded, 17);
    expect(decoded.defaultsState.tuning).toBeDefined();
    expect(decoded.defaultsState.tuning?.system).toBe('pythagorean');
    expect(decoded.defaultsState.tuning?.referenceA4Hz).toBe(440);

    expect(decoded.segments[0]?.config?.tuning).toBeDefined();
    const seg0Tuning = decoded.segments[0]?.config?.tuning as any;
    expect(seg0Tuning.system).toBe('just-5');
    expect(seg0Tuning.referenceA4Hz).toBe(432);

    expect(decoded.segments[1]?.config?.tuning).toBeUndefined();
  });

  it('provides backward compatibility for version <= 16 by defaulting to equal temperament', () => {
    const legacyPayload = 'e=sine&rootFreq=110&spread=1.0';
    const decoded = decodeState(16, legacyPayload);
    expect(decoded.kind).toBe('patch');
    if (decoded.kind === 'patch') {
      expect(decoded.tuning).toBeDefined();
      expect(decoded.tuning?.system).toBe('equal');
      expect(decoded.tuning?.referenceA4Hz).toBe(440);
    }
  });
});
