import { getAnonId } from '@/api/anon';
import { ApiError, NetworkError } from '@/api/types';
import type { GalleryList, GalleryQuery, ReportReason } from '@/gallery/types';

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

export function isBackendConfigured(): boolean {
  return API_BASE !== '';
}

/** Absolute URL for a patch's preview audio (streamed/redirected by the API). */
export function previewUrl(idOrSlug: string): string {
  return `${API_BASE}/api/v1/patches/${encodeURIComponent(idOrSlug)}/preview`;
}

function buildQuery(query: GalleryQuery): string {
  const p = new URLSearchParams();
  p.set('sort', query.sort);
  if (query.engine) p.set('engine', query.engine);
  if (query.mode) p.set('mode', query.mode);
  if (query.hasCaptures) p.set('has_captures', 'true');
  if (query.followedOnly) p.set('followed_only', 'true');
  if (query.q) p.set('q', query.q);
  if (query.cursor) p.set('cursor', query.cursor);
  return p.toString();
}

async function getJson<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  } catch {
    throw new NetworkError();
  }
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

export const galleryApi = {
  isBackendConfigured,
  previewUrl,

  async list(query: GalleryQuery): Promise<GalleryList> {
    return getJson<GalleryList>(`/api/v1/gallery?${buildQuery(query)}`);
  },

  /** Increment load_count (rate-limited per IP+patch server-side). */
  async load(idOrSlug: string): Promise<void> {
    const headers: Record<string, string> = {};
    const anon = getAnonId();
    if (anon) headers['x-anon-id'] = anon;
    try {
      await fetch(
        `${API_BASE}/api/v1/patches/${encodeURIComponent(idOrSlug)}/load`,
        { method: 'POST', headers, credentials: 'include' },
      );
    } catch {
      // Loading must never be blocked by a failed count; swallow.
    }
  },

  async report(
    patchId: string,
    reason: ReportReason,
    detail?: string,
  ): Promise<void> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    const anon = getAnonId();
    if (anon) headers['x-anon-id'] = anon;
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/api/v1/reports`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ patch_id: patchId, reason, detail }),
      });
    } catch {
      throw new NetworkError();
    }
    if (!res.ok) {
      throw new ApiError(res.status, `http_${res.status}`);
    }
  },
};
