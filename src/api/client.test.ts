import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import { ApiError, NetworkError } from '@/api/types';
import { clearAnonId, getAnonId, setAnonId } from '@/api/anon';

const ANON = '11111111-2222-4333-8444-555555555555';
const MINTED = '99999999-2222-4333-8444-555555555555';

interface MockResInit {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

function mockRes({ status = 200, body = null, headers = {} }: MockResInit) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(headers),
    json: async () => {
      if (body === null) throw new Error('no body');
      return body;
    },
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  clearAnonId();
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearAnonId();
});

describe('api client', () => {
  it('sends x-anon-id when an id is set', async () => {
    setAnonId(ANON);
    fetchMock.mockResolvedValue(mockRes({ body: { user: {}, quota: {} } }));
    await api.me();
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init.headers as Record<string, string>)['x-anon-id']).toBe(ANON);
  });

  it('adopts a server-minted anon id from the response header', async () => {
    fetchMock.mockResolvedValue(
      mockRes({
        body: { user: {}, quota: {} },
        headers: { 'x-anon-id': MINTED },
      }),
    );
    await api.ensureUser();
    expect(getAnonId()).toBe(MINTED);
  });

  it('throws a typed ApiError on a quota response', async () => {
    fetchMock.mockResolvedValue(
      mockRes({
        status: 409,
        body: { error: 'quota_exceeded', resource: 'patches' },
      }),
    );
    await expect(
      api.createPatch({ state: 'm=open&e=sine', schema_ver: 4 }),
    ).rejects.toMatchObject({ status: 409, code: 'quota_exceeded' });
  });

  it('throws NetworkError when the backend is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('failed to fetch'));
    await expect(api.me()).rejects.toBeInstanceOf(NetworkError);
  });

  it('returns undefined for a 204 delete', async () => {
    fetchMock.mockResolvedValue(mockRes({ status: 204 }));
    await expect(api.deletePatch('id')).resolves.toBeUndefined();
  });

  it('reports the ApiError code for unknown errors', async () => {
    fetchMock.mockResolvedValue(mockRes({ status: 500, body: {} }));
    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
  });
});
