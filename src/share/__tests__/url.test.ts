import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PARAMS } from '@/state/params';
import { encodeState } from '@/share/encode';
import {
  buildShareUrl,
  readStateFromHash,
  subscribeStoreToHash,
  writeStateToHash,
} from '@/share/url';

function setHash(value: string): void {
  window.history.replaceState(null, '', value);
}

afterEach(() => {
  setHash('/');
  vi.useRealTimers();
});

describe('readStateFromHash', () => {
  it('returns null when there is no state fragment', () => {
    setHash('/');
    expect(readStateFromHash()).toBeNull();
    setHash('/#something-else');
    expect(readStateFromHash()).toBeNull();
  });

  it('decodes a v2 fragment with engine + engine params', () => {
    setHash('/#s=2:e=fm&coupling=0.42&fm.modRatio=2.50&fm.modIndex=4.00');
    const result = readStateFromHash();
    expect(result).not.toBeNull();
    expect(result?.engineId).toBe('fm');
    expect(result?.params.coupling).toBe(0.42);
    expect(result?.engineParams.fm?.modRatio).toBe(2.5);
    expect(result?.engineParams.fm?.modIndex).toBe(4);
  });

  it('loads a v1 fragment as the sine engine', () => {
    setHash('/#s=1:coupling=0.42&drift=0.10');
    const result = readStateFromHash();
    expect(result).not.toBeNull();
    expect(result?.engineId).toBe('sine');
    expect(result?.params.coupling).toBe(0.42);
    expect(result?.params.drift).toBe(0.1);
    expect(result?.engineParams).toEqual({});
  });

  it('defaults to sine when the engine selector is missing', () => {
    setHash('/#s=2:coupling=0.42');
    expect(readStateFromHash()?.engineId).toBe('sine');
  });

  it('returns null for unsupported schema versions (0 and 999)', () => {
    setHash('/#s=0:coupling=0.42');
    expect(readStateFromHash()).toBeNull();
    setHash('/#s=999:coupling=0.42');
    expect(readStateFromHash()).toBeNull();
  });

  it('returns null when version segment is malformed', () => {
    setHash('/#s=2coupling=0.42'); // no colon
    expect(readStateFromHash()).toBeNull();
    setHash('/#s=x:coupling=0.42'); // non-numeric version
    expect(readStateFromHash()).toBeNull();
  });
});

describe('writeStateToHash', () => {
  it('writes a v3 payload via replaceState without adding history', () => {
    const before = window.history.length;
    writeStateToHash(DEFAULT_PARAMS, 'sine', {});
    expect(window.location.hash).toBe(
      `#s=3:${encodeState(DEFAULT_PARAMS, 'sine', {})}`,
    );
    expect(window.history.length).toBe(before);
  });

  it('round-trips shared + engine state through read (FM)', () => {
    const fmParams = { modRatio: 2.5, modIndex: 4, feedback: 0.3 };
    writeStateToHash(DEFAULT_PARAMS, 'fm', fmParams);
    const result = readStateFromHash();
    expect(result?.engineId).toBe('fm');
    expect(result?.params.coupling).toBe(DEFAULT_PARAMS.coupling);
    expect(result?.engineParams.fm?.modRatio).toBe(2.5);
    expect(result?.engineParams.fm?.modIndex).toBe(4);
    expect(result?.engineParams.fm?.feedback).toBe(0.3);
  });
});

describe('buildShareUrl', () => {
  it('embeds the mode + engine selector in the fragment', () => {
    const url = buildShareUrl(DEFAULT_PARAMS, 'fm', { modRatio: 1 });
    expect(url).toContain('#s=3:m=open&e=fm&');
  });

  it('embeds an arc session selection', () => {
    const url = buildShareUrl(
      DEFAULT_PARAMS,
      'sine',
      {},
      {
        mode: 'arc',
        arcId: 'dusk',
        durationSec: 900,
      },
    );
    expect(url).toContain('#s=3:m=arc&arc=dusk&dur=900&');
  });
});

describe('subscribeStoreToHash', () => {
  it('debounces writes and unsubscribes cleanly', () => {
    vi.useFakeTimers();
    const state = {
      params: DEFAULT_PARAMS,
      engineId: 'sine' as const,
      engineParams: { sine: {} },
      sessionMode: 'open' as const,
      arcId: 'bell',
      arcDurationSec: 600,
    };
    const holder: { fn: (() => void) | null } = { fn: null };
    const store = {
      getState: () => state,
      subscribe: (fn: () => void) => {
        holder.fn = fn;
        return () => {
          holder.fn = null;
        };
      },
    };

    // Cast through unknown: the test double only implements what's used.
    const unsubscribe = subscribeStoreToHash(
      store as unknown as Parameters<typeof subscribeStoreToHash>[0],
      500,
    );

    setHash('/');
    holder.fn?.();
    holder.fn?.(); // rapid changes collapse into one write
    expect(window.location.hash).toBe(''); // not yet written
    vi.advanceTimersByTime(500);
    expect(window.location.hash).toBe(
      `#s=3:${encodeState(DEFAULT_PARAMS, 'sine', {})}`,
    );

    // After unsubscribe, a pending/late change does not write.
    setHash('/');
    holder.fn?.();
    unsubscribe();
    vi.advanceTimersByTime(500);
    expect(window.location.hash).toBe('');
  });
});
