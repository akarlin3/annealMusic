// v7.0 Studies — typed fetch wrappers over /api/v1/studies/*. Same-origin, so
// the session cookie rides along automatically (studies require auth).
import type {
  AuditEntry,
  InvestigatorRole,
  PublishResult,
  ResourceKind,
  ResourceRole,
  Study,
  StudyResourceLink,
  StudyVersion,
} from './types';

const BASE = '/api/v1/studies';

export class ApiError extends Error {
  status: number;
  code: string;
  detail: Record<string, unknown>;
  constructor(status: number, detail: Record<string, unknown>) {
    super((detail?.error as string) || `HTTP ${status}`);
    this.status = status;
    this.code = (detail?.error as string) || `http_${status}`;
    this.detail = detail || {};
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const studiesApi = {
  list: () => request<{ items: Study[] }>(`${BASE}/me`).then((r) => r.items),

  get: (idOrSlug: string) => request<Study>(`${BASE}/${idOrSlug}`),

  create: (body: {
    title: string;
    description?: string;
    abstract?: string;
    preregistration_url?: string;
    ethics_statement?: string;
  }) => request<Study>(BASE, { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: Partial<Study>) =>
    request<Study>(`${BASE}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  archive: (id: string) => request<void>(`${BASE}/${id}`, { method: 'DELETE' }),

  addInvestigator: (
    id: string,
    body: {
      account_email?: string;
      account_id?: string;
      role: InvestigatorRole;
    },
  ) =>
    request<unknown>(`${BASE}/${id}/investigators`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  changeRole: (id: string, accountId: string, role: InvestigatorRole) =>
    request<unknown>(`${BASE}/${id}/investigators/${accountId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  removeInvestigator: (id: string, accountId: string) =>
    request<void>(`${BASE}/${id}/investigators/${accountId}`, {
      method: 'DELETE',
    }),

  listResources: (id: string) =>
    request<{ items: StudyResourceLink[] }>(`${BASE}/${id}/resources`).then(
      (r) => r.items,
    ),

  linkResource: (
    id: string,
    body: {
      resource_kind: ResourceKind;
      resource_id: string;
      role?: ResourceRole;
    },
  ) =>
    request<StudyResourceLink>(`${BASE}/${id}/resources`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  unlinkResource: (id: string, linkId: string) =>
    request<void>(`${BASE}/${id}/resources/${linkId}`, { method: 'DELETE' }),

  snapshot: (id: string, versionLabel: string) =>
    request<StudyVersion & { snapshot_json: unknown }>(
      `${BASE}/${id}/snapshot`,
      {
        method: 'POST',
        body: JSON.stringify({ version_label: versionLabel }),
      },
    ),

  listVersions: (id: string) =>
    request<{ items: StudyVersion[] }>(`${BASE}/${id}/versions`).then(
      (r) => r.items,
    ),

  publish: (
    id: string,
    body: { version_id?: string; version_label?: string },
  ) =>
    request<PublishResult>(`${BASE}/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  audit: (id: string) =>
    request<{ items: AuditEntry[] }>(`${BASE}/${id}/audit`).then(
      (r) => r.items,
    ),

  citation: (idOrSlug: string, format: 'bibtex' | 'apa' | 'chicago') =>
    request<{ format: string; citation: string }>(
      `${BASE}/${idOrSlug}/citation?format=${format}`,
    ),

  export: (
    studyId: string,
    body: {
      version_id: string;
      reproducibility_level: string;
      includes_subject_data: boolean;
      differential_privacy: boolean;
      pi_attestation: boolean;
    },
  ) =>
    request<{ id: string }>(`${BASE}/${studyId}/export`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
