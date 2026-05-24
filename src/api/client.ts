import { getAnonId, setAnonId } from '@/api/anon';
import {
  ApiError,
  NetworkError,
  type Capture,
  type CreatePatchBody,
  type Patch,
  type PatchList,
  type UserMe,
} from '@/api/types';

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const TIMEOUT_MS = 10_000;

/** Whether a backend is configured at all (no base URL ⇒ pure-client build). */
export function isBackendConfigured(): boolean {
  return API_BASE !== '';
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Multipart form (captures upload); takes precedence over `body`. */
  form?: FormData;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const anon = getAnonId();
  if (anon) headers['x-anon-id'] = anon;

  let payload: BodyInit | undefined;
  if (opts.form) {
    payload = opts.form; // browser sets multipart content-type + boundary
  } else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(opts.body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: payload,
      credentials: 'include',
      signal: controller.signal,
    });
  } catch {
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }

  // Adopt a server-minted anonId so subsequent requests are attributed to it.
  const minted = res.headers.get('x-anon-id');
  if (minted && minted !== anon) setAnonId(minted);

  if (res.status === 204) return undefined as T;

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    const code =
      (json as { error?: string } | null)?.error ?? `http_${res.status}`;
    throw new ApiError(res.status, code, json);
  }
  return json as T;
}

export const api = {
  isBackendConfigured,

  async ensureUser(): Promise<UserMe> {
    return request<UserMe>('/api/v1/users', { method: 'POST' });
  },

  async me(): Promise<UserMe> {
    return request<UserMe>('/api/v1/users/me');
  },

  async createPatch(body: CreatePatchBody): Promise<Patch> {
    return request<Patch>('/api/v1/patches', { method: 'POST', body });
  },

  async getPatch(idOrSlug: string): Promise<Patch> {
    return request<Patch>(`/api/v1/patches/${encodeURIComponent(idOrSlug)}`);
  },

  async myPatches(cursor?: string): Promise<PatchList> {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return request<PatchList>(`/api/v1/patches/me${q}`);
  },

  async deletePatch(id: string): Promise<void> {
    await request<void>(`/api/v1/patches/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async uploadCapture(wav: Blob): Promise<Capture> {
    const form = new FormData();
    form.append('file', wav, 'loop.wav');
    return request<Capture>('/api/v1/captures', { method: 'POST', form });
  },

  /** Fetch a capture's bytes (follows the server's 302 to storage). */
  async fetchCaptureBytes(id: string): Promise<ArrayBuffer> {
    const res = await fetch(
      `${API_BASE}/api/v1/captures/${encodeURIComponent(id)}`,
      { credentials: 'include' },
    ).catch(() => {
      throw new NetworkError();
    });
    if (!res.ok) throw new ApiError(res.status, `http_${res.status}`);
    return res.arrayBuffer();
  },
};
