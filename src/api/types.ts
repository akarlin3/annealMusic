/** Types mirroring the v0.7 backend API surface (see docs/API.md). */

export type Visibility = 'unlisted' | 'public';

export interface Quota {
  patches: number;
  captures: number;
  recordings: number;
  user_sources: number;
  bytes: number;
}

export interface UserInfo {
  id: string;
  created_at: string;
  bytes_used: number;
  patch_count: number;
  capture_count: number;
  recording_count: number;
  source_count: number;
}

export interface UserMe {
  user: UserInfo;
  quota: Quota;
}

export interface Patch {
  id: string;
  schema_ver: number;
  /** The encoded URL payload (no `#s=N:` prefix). */
  state: string;
  title: string | null;
  description: string | null;
  visibility: Visibility;
  capture_refs: string[];
  short_slug: string;
  created_at: string;
  updated_at: string;
}

export interface PatchList {
  items: Patch[];
  next_cursor: string | null;
}

export interface CreatePatchBody {
  state: string;
  schema_ver: number;
  title?: string;
  description?: string;
  visibility?: Visibility;
  capture_refs?: string[];
}

export interface Capture {
  id: string;
  duration_ms: number;
  sample_rate: number;
  channels: number;
  bytes: number;
  format: string;
  created_at: string;
}

export interface Recording {
  id: string;
  short_slug: string;
  duration_ms: number;
  bytes: number;
  format: 'opus' | 'wav';
  patch_id: string | null;
  title: string | null;
  visibility: Visibility;
  created_at: string;
}

export interface RecordingList {
  items: Recording[];
}

/** Public-facing recording metadata for the `/r/<slug>` player. */
export interface RecordingMeta {
  id: string;
  short_slug: string;
  duration_ms: number;
  format: string;
  title: string | null;
  patch_id: string | null;
  created_at: string;
}

export interface UploadRecordingBody {
  blob: Blob;
  format: 'opus' | 'wav';
  durationMs: number;
  title?: string;
  visibility?: Visibility;
  patchId?: string;
}

/** A typed API error. `code` is the server's `error` string (e.g. `quota_exceeded`). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly body: unknown = null,
  ) {
    super(`${code} (${status})`);
    this.name = 'ApiError';
  }
}

/** Thrown when the backend can't be reached at all (offline / network error). */
export class NetworkError extends Error {
  constructor() {
    super('network_error');
    this.name = 'NetworkError';
  }
}

export interface UserSource {
  id: string;
  duration_ms: number;
  sample_rate: number;
  channels: number;
  bytes: number;
  display_name: string | null;
  visibility: 'unlisted' | 'shared' | 'flagged';
  ref_count: number;
  created_at: string;
}

export interface UserSourceList {
  items: UserSource[];
}

export interface Account {
  id: string;
  email: string;
  display_name: string | null;
  avatar_seed: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface ClaimedAnonId {
  anon_id: string;
  patch_count: number;
  capture_count: number;
  recording_count: number;
  source_count: number;
  bytes_used: number;
  created_at: string;
}

export interface PublicProfile {
  id: string;
  display_name: string | null;
  avatar_seed: string | null;
  created_at: string;
  counts: {
    patches: number;
    recordings: number;
  };
}
