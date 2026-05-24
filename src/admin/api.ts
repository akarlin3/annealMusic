import { ApiError, NetworkError } from '@/api/types';

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
    await adminFetch(`/api/v1/admin/reports/${encodeURIComponent(reportId)}`, key, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};
