/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { captureSlotsFromPayload } from '@/share/hydrate';
import { decodeState } from '@/share/encode';

describe('captureSlotsFromPayload', () => {
  it('extracts flagged slots in A,B,C order', () => {
    expect(captureSlotsFromPayload('m=open&e=sine&LC.cap=1&LA.cap=1')).toEqual([
      'A',
      'C',
    ]);
  });

  it('returns empty when no slots ship audio', () => {
    expect(captureSlotsFromPayload('m=open&e=sine&LA.f=1')).toEqual([]);
  });
});

describe('decodeState tolerates the cap flag', () => {
  it('does not warn on a recognized cap field', () => {
    const decoded = decodeState(4, 'm=open&e=sine&LA.cap=1&LA.f=1') as any;
    expect(decoded.warnings).toEqual([]);
    // cap is runtime-only — it is not part of the shareable SlotConfig.
    expect(decoded.loops.A.frozen).toBe(true);
  });
});
