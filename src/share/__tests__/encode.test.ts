import { describe, expect, it } from 'vitest';
import { encodePiece, decodePiecePayload } from '../encode';
import { DEFAULT_PARAMS } from '@/state/params';
import type { VariationPoint } from '@/piece/types';

describe('Piece Variation Encoding/Decoding (Schema v12)', () => {
  it('round-trips an untitled piece with variations and top-level seed', () => {
    const variations: VariationPoint[] = [
      {
        id: 'vp-brightness',
        paramKey: 'brightness',
        constraint: { type: 'relative', percent: 15 },
        rule: 'per-play',
      },
      {
        id: 'vp-space',
        paramKey: 'space',
        constraint: { type: 'range', min: 0.2, max: 0.8 },
        rule: 'per-render',
      },
    ];

    const segmentVariations: VariationPoint[] = [
      {
        id: 'vp-seg-root',
        paramKey: 'rootFreq',
        constraint: { type: 'enum', choices: [110, 220, 330] },
        rule: 'per-segment',
      },
    ];

    const piece = {
      title: 'Procedural Ambient Space',
      description: 'A study in variations.',
      tempoBpm: 120,
      variationSeed: 9876,
      variations,
      defaultsState: {
        params: DEFAULT_PARAMS,
        engineId: 'sine' as const,
        engineParams: {},
      },
      segments: [
        {
          type: 'fixed' as const,
          durationMs: 5000,
          config: { params: { rootFreq: 110 } },
          variations: segmentVariations,
        },
      ],
    };

    const encoded = encodePiece(piece);
    expect(encoded).toContain('varSeed=9876');
    expect(encoded).toContain('v.p=');

    const decoded = decodePiecePayload(encoded);
    expect(decoded.title).toBe(piece.title);
    expect(decoded.description).toBe(piece.description);
    expect(decoded.tempoBpm).toBe(piece.tempoBpm);
    expect(decoded.variationSeed).toBe(piece.variationSeed);

    expect(decoded.variations).toBeDefined();
    expect(decoded.variations?.length).toBe(2);
    expect(decoded.variations?.[0]?.paramKey).toBe('brightness');
    expect(decoded.variations?.[0]?.constraint.type).toBe('relative');
    expect(decoded.variations?.[0]?.constraint.percent).toBe(15);
    expect(decoded.variations?.[0]?.rule).toBe('per-play');

    expect(decoded.segments.length).toBe(1);
    expect(decoded.segments[0]?.variations).toBeDefined();
    expect(decoded.segments[0]?.variations?.length).toBe(1);
    expect(decoded.segments[0]?.variations?.[0]?.paramKey).toBe('rootFreq');
    expect(decoded.segments[0]?.variations?.[0]?.constraint.type).toBe('enum');
    expect(decoded.segments[0]?.variations?.[0]?.constraint.choices).toEqual([
      110, 220, 330,
    ]);
    expect(decoded.segments[0]?.variations?.[0]?.rule).toBe('per-segment');
  });
});
