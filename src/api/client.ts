/* eslint-disable @typescript-eslint/no-explicit-any */
import { getAnonId, setAnonId } from '@/api/anon';
import {
  ApiError,
  NetworkError,
  type Capture,
  type CreatePatchBody,
  type Patch,
  type PatchList,
  type Recording,
  type RecordingList,
  type RecordingMeta,
  type UploadRecordingBody,
  type UserMe,
  type UserSource,
  type UserSourceList,
  type Account,
  type ClaimedAnonId,
  type PublicProfile,
  type RelationshipListOut,
  type FeedListOut,
  type FeaturedPickOut,
  type AIQuota,
  type AIGeneratedPatchOut,
  type AIModifyPatchOut,
  type AIDescribePatchOut,
  type JamSessionDetail,
  type JamSessionJoin,
  type SaveSharedPatchBody,
  type APIPiece,
  type APIPieceList,
  type ListeningSession,
  type ListeningSessionList,
} from '@/api/types';
import type { GalleryList } from '@/gallery/types';

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

  // --- recordings (v1.0) ---------------------------------------------------

  /** Upload a finished recording blob (multipart). */
  async uploadRecording(body: UploadRecordingBody): Promise<Recording> {
    const form = new FormData();
    const ext = body.format === 'wav' ? 'wav' : 'webm';
    form.append('file', body.blob, `recording.${ext}`);
    form.append('format', body.format);
    form.append('duration_ms', String(Math.round(body.durationMs)));
    if (body.title) form.append('title', body.title);
    form.append('visibility', body.visibility ?? 'unlisted');
    if (body.patchId) form.append('patch_id', body.patchId);
    return request<Recording>('/api/v1/recordings', { method: 'POST', form });
  },

  async myRecordings(): Promise<RecordingList> {
    return request<RecordingList>('/api/v1/recordings/me');
  },

  async deleteRecording(id: string): Promise<void> {
    await request<void>(`/api/v1/recordings/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  /** Public metadata for the `/r/<slug>` player. */
  async recordingMeta(idOrSlug: string): Promise<RecordingMeta> {
    return request<RecordingMeta>(
      `/api/v1/recordings/${encodeURIComponent(idOrSlug)}/meta`,
    );
  },

  /** Direct (302-followed) audio URL for an `<audio>` element. */
  recordingAudioUrl(idOrSlug: string): string {
    return `${API_BASE}/api/v1/recordings/${encodeURIComponent(idOrSlug)}`;
  },

  // --- user sources (v1.2) -------------------------------------------------

  async uploadUserSource(wav: Blob, displayName?: string): Promise<UserSource> {
    const form = new FormData();
    const filename = displayName ? `${displayName}.wav` : 'source.wav';
    form.append('file', wav, filename);
    return request<UserSource>('/api/v1/user-sources', {
      method: 'POST',
      form,
    });
  },

  async myUserSources(): Promise<UserSourceList> {
    return request<UserSourceList>('/api/v1/user-sources/me');
  },

  async deleteUserSource(id: string): Promise<void> {
    await request<void>(`/api/v1/user-sources/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async updateUserSource(id: string, displayName: string): Promise<UserSource> {
    return request<UserSource>(
      `/api/v1/user-sources/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: { display_name: displayName },
      },
    );
  },

  /** Direct (302-followed) audio URL for fetching raw bytes */
  userSourceAudioUrl(id: string): string {
    return `${API_BASE}/api/v1/user-sources/${encodeURIComponent(id)}`;
  },

  // --- auth & claim (v1.3) -------------------------------------------------

  async requestMagicLink(
    email: string,
    intent: 'login' | 'signup' | 'add-email-to-account',
  ): Promise<{ message: string }> {
    return request<{ message: string }>('/api/v1/auth/email/request', {
      method: 'POST',
      body: { email, intent },
    });
  },

  async logout(): Promise<void> {
    await request<void>('/api/v1/auth/logout', { method: 'POST' });
  },

  async session(): Promise<{ account: Account | null }> {
    return request<{ account: Account | null }>('/api/v1/auth/session');
  },

  async getProfile(): Promise<Account> {
    return request<Account>('/api/v1/account/me');
  },

  async updateProfile(body: {
    display_name?: string;
    avatar_seed?: string;
    bio?: string;
    likes_public?: boolean;
    follows_public?: boolean;
  }): Promise<Account> {
    return request<Account>('/api/v1/account/me', {
      method: 'PATCH',
      body,
    });
  },

  async deleteAccount(confirmEmail: string): Promise<void> {
    await request<void>('/api/v1/account/me', {
      method: 'DELETE',
      body: { confirm_email: confirmEmail },
    });
  },

  async getProviders(): Promise<string[]> {
    return request<string[]>('/api/v1/account/me/providers');
  },

  async unlinkProvider(provider: 'email' | 'google' | 'github'): Promise<void> {
    await request<void>(
      `/api/v1/account/me/providers/${encodeURIComponent(provider)}`,
      {
        method: 'DELETE',
      },
    );
  },

  async claimAnonId(anonId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/api/v1/account/me/claim', {
      method: 'POST',
      body: { anon_id: anonId },
    });
  },

  async unclaimAnonId(anonId: string): Promise<void> {
    await request<void>(
      `/api/v1/account/me/claim/${encodeURIComponent(anonId)}`,
      {
        method: 'DELETE',
      },
    );
  },

  async listClaimedAnonIds(): Promise<ClaimedAnonId[]> {
    return request<ClaimedAnonId[]>('/api/v1/account/me/anon-ids');
  },

  async getPublicProfile(accountId: string): Promise<PublicProfile> {
    return request<PublicProfile>(
      `/api/v1/profiles/${encodeURIComponent(accountId)}`,
    );
  },

  async generatePatch(prompt: string): Promise<AIGeneratedPatchOut> {
    return request<AIGeneratedPatchOut>('/api/v1/ai/generate-patch', {
      method: 'POST',
      body: { prompt },
    });
  },

  async modifyPatch(
    currentState: string,
    direction: string,
  ): Promise<AIModifyPatchOut> {
    return request<AIModifyPatchOut>('/api/v1/ai/modify-patch', {
      method: 'POST',
      body: { current_state: currentState, direction },
    });
  },

  async describePatch(state: string): Promise<AIDescribePatchOut> {
    return request<AIDescribePatchOut>('/api/v1/ai/describe-patch', {
      method: 'POST',
      body: { state },
    });
  },

  async similarPatches(id: string): Promise<GalleryList> {
    return request<GalleryList>(
      `/api/v1/patches/${encodeURIComponent(id)}/similar`,
    );
  },

  async aiQuota(): Promise<AIQuota> {
    return request<AIQuota>('/api/v1/ai/quota');
  },

  async createJamSession(): Promise<JamSessionDetail> {
    return request<JamSessionDetail>('/api/v1/jam-sessions', {
      method: 'POST',
    });
  },

  async joinJamSession(id: string): Promise<JamSessionJoin> {
    return request<JamSessionJoin>(
      `/api/v1/jam-sessions/${encodeURIComponent(id)}/join`,
      { method: 'POST' },
    );
  },

  async leaveJamSession(id: string): Promise<void> {
    await request<void>(
      `/api/v1/jam-sessions/${encodeURIComponent(id)}/leave`,
      { method: 'POST' },
    );
  },

  async getJamSession(id: string): Promise<JamSessionDetail> {
    return request<JamSessionDetail>(
      `/api/v1/jam-sessions/${encodeURIComponent(id)}`,
    );
  },

  async saveSharedPatch(id: string, body: SaveSharedPatchBody): Promise<Patch> {
    return request<Patch>(
      `/api/v1/jam-sessions/${encodeURIComponent(id)}/save-patch`,
      { method: 'POST', body },
    );
  },

  // --- social (v2.0) --------------------------------------------------------

  async like(
    targetKind: 'patch' | 'recording',
    targetId: string,
  ): Promise<{ liked: boolean }> {
    return request<{ liked: boolean }>('/api/v1/likes', {
      method: 'POST',
      body: { target_kind: targetKind, target_id: targetId },
    });
  },

  async unlike(
    targetKind: 'patch' | 'recording',
    targetId: string,
  ): Promise<{ liked: boolean }> {
    return request<{ liked: boolean }>(
      `/api/v1/likes/${targetKind}/${encodeURIComponent(targetId)}`,
      {
        method: 'DELETE',
      },
    );
  },

  async checkLikeStatus(
    targetKind: 'patch' | 'recording',
    targetId: string,
  ): Promise<{ liked: boolean }> {
    return request<{ liked: boolean }>(
      `/api/v1/likes/status?target_kind=${targetKind}&target_id=${encodeURIComponent(targetId)}`,
    );
  },

  async follow(accountId: string): Promise<{ following: boolean }> {
    return request<{ following: boolean }>(
      `/api/v1/follows/${encodeURIComponent(accountId)}`,
      {
        method: 'POST',
      },
    );
  },

  async unfollow(accountId: string): Promise<{ following: boolean }> {
    return request<{ following: boolean }>(
      `/api/v1/follows/${encodeURIComponent(accountId)}`,
      {
        method: 'DELETE',
      },
    );
  },

  async block(accountId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(
      `/api/v1/blocks/${encodeURIComponent(accountId)}`,
      {
        method: 'POST',
      },
    );
  },

  async unblock(accountId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(
      `/api/v1/blocks/${encodeURIComponent(accountId)}`,
      {
        method: 'DELETE',
      },
    );
  },

  async getBlockedAccounts(): Promise<RelationshipListOut> {
    return request<RelationshipListOut>('/api/v1/blocks/me');
  },

  async mute(accountId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(
      `/api/v1/mutes/${encodeURIComponent(accountId)}`,
      {
        method: 'POST',
      },
    );
  },

  async unmute(accountId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(
      `/api/v1/mutes/${encodeURIComponent(accountId)}`,
      {
        method: 'DELETE',
      },
    );
  },

  async getMutedAccounts(): Promise<RelationshipListOut> {
    return request<RelationshipListOut>('/api/v1/mutes/me');
  },

  async getFeed(cursor?: string, limit = 24): Promise<FeedListOut> {
    const q = new URLSearchParams();
    if (cursor) q.set('cursor', cursor);
    q.set('limit', String(limit));
    return request<FeedListOut>(`/api/v1/feed?${q.toString()}`);
  },

  async getFeaturedPicks(): Promise<FeaturedPickOut[]> {
    return request<FeaturedPickOut[]>('/api/v1/featured');
  },

  async getFeaturedHistory(limit = 48, offset = 0): Promise<FeaturedPickOut[]> {
    return request<FeaturedPickOut[]>(
      `/api/v1/featured/history?limit=${limit}&offset=${offset}`,
    );
  },

  async getProfilePatches(
    accountId: string,
    cursor?: string,
    limit = 24,
  ): Promise<PatchList> {
    const q = new URLSearchParams();
    if (cursor) q.set('cursor', cursor);
    q.set('limit', String(limit));
    return request<PatchList>(
      `/api/v1/profiles/${encodeURIComponent(accountId)}/patches?${q.toString()}`,
    );
  },

  async getProfileRecordings(accountId: string): Promise<RecordingList> {
    return request<RecordingList>(
      `/api/v1/profiles/${encodeURIComponent(accountId)}/recordings`,
    );
  },

  async getProfileLiked(
    accountId: string,
    cursor?: string,
    limit = 24,
  ): Promise<PatchList> {
    const q = new URLSearchParams();
    if (cursor) q.set('cursor', cursor);
    q.set('limit', String(limit));
    return request<PatchList>(
      `/api/v1/profiles/${encodeURIComponent(accountId)}/liked?${q.toString()}`,
    );
  },

  async updateAccountSettings(body: {
    display_name?: string;
    avatar_seed?: string;
    bio?: string;
    likes_public?: boolean;
    follows_public?: boolean;
  }): Promise<Account> {
    return request<Account>('/api/v1/account/me', {
      method: 'PATCH',
      body,
    });
  },

  async adminSetFeatured(
    picks: { patch_id: string; position: number; curator_note?: string }[],
  ): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/api/v1/admin/featured', {
      method: 'POST',
      body: picks,
    });
  },

  async adminDeleteFeaturedPick(id: string): Promise<void> {
    await request<void>(`/api/v1/admin/featured/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async adminSuspendAccount(accountId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(
      `/api/v1/admin/accounts/${encodeURIComponent(accountId)}/suspend`,
      {
        method: 'POST',
      },
    );
  },

  async adminUnsuspendAccount(
    accountId: string,
  ): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(
      `/api/v1/admin/accounts/${encodeURIComponent(accountId)}/suspend`,
      {
        method: 'DELETE',
      },
    );
  },

  // --- pieces (v3.0) -------------------------------------------------------
  async createPiece(body: {
    defaults_state: Record<string, any>;
    schema_ver: number;
    title?: string | null;
    description?: string | null;
    visibility: 'unlisted' | 'public';
    tempo_bpm?: number | null;
    notation?: any[];
    variation_seed?: number | null;
    variations?: any[];
    segments: {
      type: string;
      duration_ms: number | null;
      config: Record<string, any>;
      variations?: any[];
    }[];
  }): Promise<APIPiece> {
    return request<APIPiece>('/api/v1/pieces', { method: 'POST', body });
  },

  async getPiece(idOrSlug: string): Promise<APIPiece> {
    return request<APIPiece>(`/api/v1/pieces/${encodeURIComponent(idOrSlug)}`);
  },

  async myPieces(cursor?: string): Promise<APIPieceList> {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return request<APIPieceList>(`/api/v1/pieces/me${q}`);
  },

  async updatePiece(
    id: string,
    body: {
      title?: string | null;
      description?: string | null;
      visibility?: 'unlisted' | 'public';
      defaults_state?: Record<string, any>;
      tempo_bpm?: number | null;
      notation?: any[];
      variation_seed?: number | null;
      variations?: any[];
      segments?: {
        type: string;
        duration_ms: number | null;
        config: Record<string, any>;
        variations?: any[];
      }[];
    },
  ): Promise<APIPiece> {
    return request<APIPiece>(`/api/v1/pieces/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body,
    });
  },

  async deletePiece(id: string): Promise<void> {
    await request<void>(`/api/v1/pieces/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // --- listening sessions (v4.0) -------------------------------------------
  async createListeningSession(body: {
    piece_id: string;
    schema_ver: number;
    title: string;
    description?: string | null;
    intention?: string | null;
    length_category?: string;
    recommended_environment?: string | null;
    settle_in_ms?: number;
    integration_ms?: number;
    opening_tone?: boolean;
    closing_tone?: boolean;
    visibility?: 'unlisted' | 'public';
  }): Promise<ListeningSession> {
    return request<ListeningSession>('/api/v1/listening-sessions', {
      method: 'POST',
      body,
    });
  },

  async getListeningSession(idOrSlug: string): Promise<ListeningSession> {
    return request<ListeningSession>(
      `/api/v1/listening-sessions/${encodeURIComponent(idOrSlug)}`,
    );
  },

  async myListeningSessions(cursor?: string): Promise<ListeningSessionList> {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return request<ListeningSessionList>(`/api/v1/listening-sessions/me${q}`);
  },

  async updateListeningSession(
    id: string,
    body: {
      piece_id?: string;
      title?: string;
      description?: string | null;
      intention?: string | null;
      length_category?: string;
      recommended_environment?: string | null;
      settle_in_ms?: number;
      integration_ms?: number;
      opening_tone?: boolean;
      closing_tone?: boolean;
      visibility?: 'unlisted' | 'public';
    },
  ): Promise<ListeningSession> {
    return request<ListeningSession>(
      `/api/v1/listening-sessions/${encodeURIComponent(id)}`,
      { method: 'PATCH', body },
    );
  },

  async deleteListeningSession(id: string): Promise<void> {
    await request<void>(
      `/api/v1/listening-sessions/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    );
  },
};

export function getErrorMessage(
  err: unknown,
  defaultMessage = 'An unexpected error occurred.',
): string {
  if (err instanceof ApiError) {
    const body = err.body;
    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>;
      if ('detail' in b) {
        const detail = b.detail;
        if (typeof detail === 'string') {
          return detail;
        }
        if (detail && typeof detail === 'object') {
          const detObj = detail as Record<string, unknown>;
          if ('message' in detObj && typeof detObj.message === 'string') {
            return detObj.message;
          }
        }
      }
    }
    return err.code;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return defaultMessage;
}
