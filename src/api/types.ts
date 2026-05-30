/* eslint-disable @typescript-eslint/no-explicit-any */
/** Types mirroring the v0.7 backend API surface (see docs/API.md). */

export type Visibility = 'unlisted' | 'public';

/**
 * Optional visual breath-pacing pattern on a listening session (v4.4). Mirrors
 * the `breath_pattern` JSONB column. `custom_pattern` is `[inhale, hold_full,
 * exhale, hold_empty]` in seconds, present only for `pattern: 'custom'`.
 */
export interface BreathPatternRef {
  pattern: 'box' | '4-7-8' | 'coherent' | 'resonance' | 'custom';
  custom_pattern?: [number, number, number, number];
}

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
  mode: 'sketch' | 'drone';
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
  bio: string | null;
  likes_public: boolean;
  follows_public: boolean;
  suspended: boolean;
  follower_count: number;
  following_count: number;
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
  bio: string | null;
  created_at: string;
  follower_count: number;
  following_count: number;
  likes_public: boolean;
  follows_public: boolean;
  following: boolean;
  counts: {
    patches: number;
    recordings: number;
  };
}

export interface RelationshipItem {
  id: string;
  display_name: string | null;
  avatar_seed: string | null;
}

export interface RelationshipListOut {
  items: RelationshipItem[];
}

export interface FeedItemOut {
  kind: 'patch' | 'recording';
  id: string;
  short_slug: string;
  title: string | null;
  description: string | null;
  created_at: string;
  like_count: number;
  liked_by_me: boolean;
  state?: string;
  engine?: string;
  mode?: string;
  has_captures?: boolean;
  duration_ms?: number;
  format?: string;
  creator_name: string | null;
  creator_avatar_seed: string | null;
  creator_id: string | null;
}

export interface FeedListOut {
  items: FeedItemOut[];
  next_cursor: string | null;
}

export interface FeaturedPickOut {
  id: string;
  week_starting: string;
  patch_id: string;
  position: number;
  curator_note: string | null;
  patch: Patch | null;
}

export interface AIQuota {
  hour_limit: number;
  hour_used: number;
  day_limit: number;
  day_used: number;
}

export interface AIChange {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  label: string;
  direction: 'increased' | 'decreased' | 'changed';
}

export interface AIGeneratedPatchOut {
  state: string;
  generation_id: string;
}

export interface AIModifyPatchOut {
  state: string;
  changes: AIChange[];
}

export interface AIDescribePatchOut {
  description: string;
}

// --- v1.8 Collaborative Jam types --------------------------------------------

export interface JamSession {
  id: string;
  created_by: string;
  created_at: string;
  last_active_at: string;
  ended_at: string | null;
}

export interface JamParticipant {
  user_id: string;
  joined_at: string;
  left_at: string | null;
  color: string;
  display_name: string | null;
  avatar_seed: string | null;
}

export interface JamSessionDetail {
  session: JamSession;
  participants: JamParticipant[];
  ws_url: string;
}

export interface JamSessionJoin {
  color: string;
  ws_url: string;
}

export interface SaveSharedPatchBody {
  state: string;
  schema_ver: number;
  title?: string;
  description?: string;
  visibility?: Visibility;
}

export interface APIPieceSegment {
  id?: string;
  position: number;
  type: 'fixed' | 'arc' | 'open' | 'transition' | 'meta-arc';
  duration_ms: number | null;
  config: Record<string, any>;
  variations?: any[];
}

export interface APIPiece {
  id: string;
  schema_ver: number;
  defaults_state: Record<string, any>;
  title: string | null;
  description: string | null;
  visibility: Visibility;
  ai_description: string | null;
  total_duration_ms: number | null;
  has_open_segment: boolean;
  created_at: string;
  updated_at: string;
  short_slug: string;
  segments: APIPieceSegment[];
  tempo_bpm?: number | null;
  variation_seed?: number | null;
  variations?: any[];
  notation?: any[];
  bell_schedule?: any[];
}

export interface APIPieceList {
  items: APIPiece[];
  next_cursor: string | null;
}

export interface ListeningSession {
  id: string;
  user_id: string;
  piece_id: string | null;
  schema_ver: number;
  title: string;
  description: string | null;
  intention: string | null;
  length_category: string;
  recommended_environment: string | null;
  settle_in_ms: number;
  integration_ms: number;
  bell_schedule: any[];
  /** Optional visual breath-pacing pattern (v4.4 / schema v20). Null = none. */
  breath_pattern?: BreathPatternRef | null;
  total_duration_ms: number | null;
  visibility: Visibility;
  short_slug: string;
  created_at: string;
  updated_at: string;
  piece?: APIPiece | null;
  patch?: Patch | null;
  patch_id: string | null;
  creator_name: string | null;
  creator_avatar_seed: string | null;
  piece_creator_name: string | null;
}

export interface ListeningSessionList {
  items: ListeningSession[];
  next_cursor: string | null;
}

export interface CreateListeningSessionBody {
  piece_id?: string;
  patch_id?: string;
  schema_ver: number;
  title: string;
  description?: string | null;
  intention?: string | null;
  length_category?: string;
  recommended_environment?: string | null;
  settle_in_ms?: number;
  integration_ms?: number;
  bell_schedule?: any[];
  breath_pattern?: BreathPatternRef | null;
  visibility?: Visibility;
}

export interface UpdateListeningSessionBody {
  piece_id?: string;
  patch_id?: string;
  title?: string;
  description?: string | null;
  intention?: string | null;
  length_category?: string;
  recommended_environment?: string | null;
  settle_in_ms?: number;
  integration_ms?: number;
  bell_schedule?: any[];
  breath_pattern?: BreathPatternRef | null;
  visibility?: Visibility;
}

// --- v4.5 Session History ----------------------------------------------------

export interface SessionPlay {
  id: string;
  listening_session_id: string;
  started_at: string;
  completed_at: string | null;
  duration_listened_ms: number;
  reflection: string | null;
  created_at: string;
  session_title: string | null;
  session_slug: string | null;
  session_length_category: string | null;
}

export interface SessionPlayList {
  items: SessionPlay[];
  next_cursor: string | null;
}

export interface SessionStats {
  total_sessions: number;
  total_listened_ms: number;
  average_length_ms: number;
  this_month_sessions: number;
  this_month_listened_ms: number;
}

// --- v4.5 Curated Library ----------------------------------------------------

export interface LibraryListing {
  id: string;
  listening_session_id: string;
  intention: string | null;
  length_category: string | null;
  character_tags: string[];
  editor_pick: boolean;
  editor_pick_at: string | null;
  curator_note: string | null;
  added_at: string;
  session_title: string | null;
  session_slug: string | null;
  total_duration_ms: number | null;
  preview_status: 'none' | 'rendering' | 'ready' | 'failed';
}

export interface LibraryList {
  items: LibraryListing[];
}
