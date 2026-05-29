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

describe('Piece Movements Encoding/Decoding (Schema v13)', () => {
  it('round-trips a piece with movements metadata', () => {
    const piece = {
      title: 'Movements Symphony',
      description: 'A structural piece.',
      defaultsState: {
        params: DEFAULT_PARAMS,
        engineId: 'sine' as const,
        engineParams: {},
      },
      segments: [
        { type: 'fixed' as const, durationMs: 5000, config: {} },
        { type: 'transition' as const, durationMs: 3000, config: {} },
        { type: 'open' as const, durationMs: null, config: {} },
      ],
      movements: [
        {
          name: 'Movement I - Prelude',
          description: 'Calm introduction',
          transition_in_ms: 1000,
          transition_out_ms: 2000,
          startSegmentIndex: 0,
          endSegmentIndex: 1,
        },
        {
          name: 'Movement II - Postlude',
          startSegmentIndex: 2,
          endSegmentIndex: 2,
        },
      ],
    };

    const encoded = encodePiece(piece);
    expect(encoded).toContain('mov0.name=Movement%20I%20-%20Prelude');
    expect(encoded).toContain('mov0.desc=Calm%20introduction');
    expect(encoded).toContain('mov0.in=1000');
    expect(encoded).toContain('mov0.out=2000');
    expect(encoded).toContain('mov0.start=0');
    expect(encoded).toContain('mov0.end=1');
    expect(encoded).toContain('mov1.name=Movement%20II%20-%20Postlude');
    expect(encoded).toContain('mov1.start=2');
    expect(encoded).toContain('mov1.end=2');

    const decoded = decodePiecePayload(encoded);
    expect(decoded.movements).toBeDefined();
    expect(decoded.movements?.length).toBe(2);
    expect(decoded.movements?.[0]?.name).toBe('Movement I - Prelude');
    expect(decoded.movements?.[0]?.description).toBe('Calm introduction');
    expect(decoded.movements?.[0]?.transition_in_ms).toBe(1000);
    expect(decoded.movements?.[0]?.transition_out_ms).toBe(2000);
    expect(decoded.movements?.[0]?.startSegmentIndex).toBe(0);
    expect(decoded.movements?.[0]?.endSegmentIndex).toBe(1);
    expect(decoded.movements?.[1]?.name).toBe('Movement II - Postlude');
    expect(decoded.movements?.[1]?.description).toBeUndefined();
    expect(decoded.movements?.[1]?.transition_in_ms).toBeUndefined();
    expect(decoded.movements?.[1]?.transition_out_ms).toBeUndefined();
    expect(decoded.movements?.[1]?.startSegmentIndex).toBe(2);
    expect(decoded.movements?.[1]?.endSegmentIndex).toBe(2);
  });
});
