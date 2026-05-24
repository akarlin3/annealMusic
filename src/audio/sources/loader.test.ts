import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearSourceCache,
  isSourceCached,
  loadSource,
} from '@/audio/sources/loader';
import { SOURCES } from '@/audio/sources/registry';

const ID = SOURCES[0]!.id;

function fakeCtx() {
  return {
    decodeAudioData: vi.fn(async () => ({ duration: 1 }) as AudioBuffer),
  } as unknown as AudioContext;
}

afterEach(() => {
  clearSourceCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('source loader', () => {
  it('fetches + decodes a known source', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(8),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);
    const ctx = fakeCtx();

    const buf = await loadSource(ctx, ID);
    expect(buf).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(isSourceCached(ID)).toBe(true);
  });

  it('returns the cached buffer on a second request (one fetch)', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(8),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);
    const ctx = fakeCtx();

    const a = await loadSource(ctx, ID);
    const b = await loadSource(ctx, ID);
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent requests to a single fetch', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(8),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);
    const ctx = fakeCtx();

    const [a, b] = await Promise.all([
      loadSource(ctx, ID),
      loadSource(ctx, ID),
    ]);
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects on fetch failure and does not cache (retryable)', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);
    const ctx = fakeCtx();

    await expect(loadSource(ctx, ID)).rejects.toThrow();
    expect(isSourceCached(ID)).toBe(false);
  });

  it('rejects an unknown source id', async () => {
    await expect(loadSource(fakeCtx(), 'does-not-exist')).rejects.toThrow();
  });
});
