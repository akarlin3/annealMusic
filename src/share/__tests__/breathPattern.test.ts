import { describe, expect, it } from 'vitest';
import {
  decodeListeningSessionPayload,
  encodeListeningSession,
  type DecodedListeningSession,
} from '@/share/encode';

function baseSession(): DecodedListeningSession {
  return {
    pieceId: 'p1',
    settleInMs: 30000,
    integrationMs: 60000,
    bellSchedule: [],
  };
}

/** encodeListeningSession prefixes `kind=listening-session`; strip it for decode. */
function roundTrip(s: DecodedListeningSession): DecodedListeningSession {
  const encoded = encodeListeningSession(s);
  const payload = encoded.replace(/^kind=listening-session&?/, '');
  return decodeListeningSessionPayload(payload);
}

describe('breath pattern persistence (schema v20)', () => {
  it('round-trips a built-in pattern', () => {
    const s = baseSession();
    s.breathPattern = { pattern: 'box' };
    expect(roundTrip(s).breathPattern).toEqual({ pattern: 'box' });
  });

  it('round-trips a custom pattern with its tuple', () => {
    const s = baseSession();
    s.breathPattern = { pattern: 'custom', custom_pattern: [5.5, 0, 6.5, 2] };
    expect(roundTrip(s).breathPattern).toEqual({
      pattern: 'custom',
      custom_pattern: [5.5, 0, 6.5, 2],
    });
  });

  it('omits the field entirely when no pattern is attached (back-compat)', () => {
    const encoded = encodeListeningSession(baseSession());
    expect(encoded).not.toContain('br=');
    expect(decodeListeningSessionPayload(encoded).breathPattern).toBeNull();
  });

  it('decodes a legacy (v19) payload with no breath field as null', () => {
    const legacy = 'pieceId=p1&settle=30000&integrate=60000';
    expect(decodeListeningSessionPayload(legacy).breathPattern).toBeNull();
  });

  it('drops an unknown pattern id to null without throwing', () => {
    expect(
      decodeListeningSessionPayload('pieceId=p1&br=bogus').breathPattern,
    ).toBeNull();
  });

  it('drops custom without a tuple to null', () => {
    expect(
      decodeListeningSessionPayload('pieceId=p1&br=custom').breathPattern,
    ).toBeNull();
  });

  it('ignores a malformed custom tuple', () => {
    const decoded = decodeListeningSessionPayload(
      'pieceId=p1&br=custom&br_c=1,2,x',
    );
    expect(decoded.breathPattern).toBeNull();
  });
});
