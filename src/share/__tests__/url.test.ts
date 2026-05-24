import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PARAMS } from '@/state/params';
import { encodeParams } from '@/share/encode';
import {
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

  it('decodes a valid v1 fragment', () => {
    setHash('/#s=1:coupling=0.42&drift=0.10');
    const result = readStateFromHash();
    expect(result).not.toBeNull();
    expect(result?.params.coupling).toBe(0.42);
    expect(result?.params.drift).toBe(0.1);
  });

  it('returns null for unknown schema versions (0 and 999)', () => {
    setHash('/#s=0:coupling=0.42');
    expect(readStateFromHash()).toBeNull();
    setHash('/#s=999:coupling=0.42');
    expect(readStateFromHash()).toBeNull();
  });

  it('returns null when version segment is malformed', () => {
    setHash('/#s=1coupling=0.42'); // no colon
    expect(readStateFromHash()).toBeNull();
    setHash('/#s=x:coupling=0.42'); // non-numeric version
    expect(readStateFromHash()).toBeNull();
  });
});

describe('writeStateToHash', () => {
  it('writes a prefixed payload via replaceState without adding history', () => {
    const before = window.history.length;
    writeStateToHash(DEFAULT_PARAMS);
    expect(window.location.hash).toBe(`#s=1:${encodeParams(DEFAULT_PARAMS)}`);
    expect(window.history.length).toBe(before);
  });

  it('round-trips through read', () => {
    writeStateToHash(DEFAULT_PARAMS);
    const result = readStateFromHash();
    expect(result?.params.coupling).toBe(DEFAULT_PARAMS.coupling);
    expect(result?.params.rootFreq).toBe(DEFAULT_PARAMS.rootFreq);
  });
});

describe('subscribeStoreToHash', () => {
  it('debounces writes and unsubscribes cleanly', () => {
    vi.useFakeTimers();
    const holder: { fn: (() => void) | null } = { fn: null };
    const store = {
      getState: () => ({ params: DEFAULT_PARAMS }),
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
    expect(window.location.hash).toBe(`#s=1:${encodeParams(DEFAULT_PARAMS)}`);

    // After unsubscribe, a pending/late change does not write.
    setHash('/');
    holder.fn?.();
    unsubscribe();
    vi.advanceTimersByTime(500);
    expect(window.location.hash).toBe('');
  });
});
