import {
  ApiError,
  NetworkError,
  type LibraryList,
  type LibraryListing,
} from '@/api/types';

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

export interface AdminReport {
  id: string;
  patch_id: string;
  patch_title: string | null;
  patch_slug: string;
  patch_visibility: string;
  preview_status: string;
  reason: string;
  detail: string | null;
  reporter: string | null;
  status: string;
  created_at: string;
}

async function adminFetch<T>(
  path: string,
  key: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        'x-admin-key': key,
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
      },
    });
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

export const adminApi = {
  previewUrl(slug: string): string {
    return `${API_BASE}/api/v1/patches/${encodeURIComponent(slug)}/preview`;
  },

  async listReports(key: string): Promise<AdminReport[]> {
    const res = await adminFetch<{ items: AdminReport[] }>(
      '/api/v1/admin/reports?status=open',
      key,
    );
    return res.items;
  },

  async resolve(
    key: string,
    reportId: string,
    status: 'dismissed' | 'upheld',
  ): Promise<void> {
    await adminFetch(
      `/api/v1/admin/reports/${encodeURIComponent(reportId)}`,
      key,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
    );
  },

  async curateFeaturedPicks(
    key: string,
    picks: { patch_id: string; position: number; curator_note?: string }[],
  ): Promise<{ success: boolean }> {
    return adminFetch<{ success: boolean }>('/api/v1/admin/featured', key, {
      method: 'POST',
      body: JSON.stringify(picks),
    });
  },

  async suspendAccount(
    key: string,
    accountId: string,
  ): Promise<{ success: boolean }> {
    return adminFetch<{ success: boolean }>(
      `/api/v1/admin/accounts/${encodeURIComponent(accountId)}/suspend`,
      key,
      { method: 'POST' },
    );
  },

  async unsuspendAccount(
    key: string,
    accountId: string,
  ): Promise<{ success: boolean }> {
    return adminFetch<{ success: boolean }>(
      `/api/v1/admin/accounts/${encodeURIComponent(accountId)}/suspend`,
      key,
      { method: 'DELETE' },
    );
  },

  // --- v4.5 curated library curation ---------------------------------------
  async listLibrary(
    key: string,
    includeArchived = false,
  ): Promise<LibraryListing[]> {
    const res = await adminFetch<LibraryList>(
      `/api/v1/admin/library${includeArchived ? '?include_archived=true' : ''}`,
      key,
    );
    return res.items;
  },

  async addLibrary(
    key: string,
    body: {
      listening_session_id: string;
      intention?: string | null;
      length_category?: string | null;
      character_tags?: string[];
      curator_note?: string | null;
    },
  ): Promise<LibraryListing> {
    return adminFetch<LibraryListing>('/api/v1/admin/library', key, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async updateLibrary(
    key: string,
    id: string,
    body: {
      intention?: string | null;
      length_category?: string | null;
      character_tags?: string[];
      editor_pick?: boolean;
      curator_note?: string | null;
    },
  ): Promise<LibraryListing> {
    return adminFetch<LibraryListing>(
      `/api/v1/admin/library/${encodeURIComponent(id)}`,
      key,
      { method: 'PATCH', body: JSON.stringify(body) },
    );
  },

  async archiveLibrary(key: string, id: string): Promise<void> {
    await adminFetch(`/api/v1/admin/library/${encodeURIComponent(id)}`, key, {
      method: 'DELETE',
    });
  },
};
