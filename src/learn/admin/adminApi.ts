// Admin API client for the v6.1 lesson-generation surface. The admin key is held
// only in this tab's sessionStorage (never persisted), mirroring the moderation
// panel convention. Every call sends it as the `x-admin-key` header.

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const KEY_STORAGE = 'am_admin_key';

export interface GenStep {
  id: string;
  position: number;
  type: string;
  config: Record<string, unknown>;
  manual_override_content: Record<string, unknown> | null;
  generation_id: string | null;
  prompt_version: string | null;
  model_id: string | null;
  generated_at: string | null;
}

export interface GenStatus {
  id: string;
  track_id: string;
  slug: string;
  title: string;
  difficulty: string;
  generation_status: 'pending' | 'generating' | 'ready' | 'generation_failed';
  generation_error: string | null;
  spec: Record<string, unknown> | null;
  steps: GenStep[];
}

export function getAdminKey(): string | null {
  return sessionStorage.getItem(KEY_STORAGE);
}

export function setAdminKey(key: string): void {
  sessionStorage.setItem(KEY_STORAGE, key);
}

async function adminFetch(path: string, init?: RequestInit): Promise<unknown> {
  const key = getAdminKey() ?? '';
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-admin-key': key,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as Record<string, unknown>;
      detail = JSON.stringify(body);
    } catch {
      // non-JSON error body — keep statusText
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json();
}

export function listLessons(): Promise<GenStatus[]> {
  return adminFetch('/api/v1/admin/lessons') as Promise<GenStatus[]>;
}

export function getLessonStatus(id: string): Promise<GenStatus> {
  return adminFetch(`/api/v1/admin/lessons/${id}/status`) as Promise<GenStatus>;
}

export function generateLesson(spec: unknown): Promise<GenStatus> {
  return adminFetch('/api/v1/admin/lessons/generate', {
    method: 'POST',
    body: JSON.stringify(spec),
  }) as Promise<GenStatus>;
}

export function regenerateLesson(id: string): Promise<GenStatus> {
  return adminFetch(`/api/v1/admin/lessons/${id}/regenerate`, {
    method: 'POST',
  }) as Promise<GenStatus>;
}

export function setStepOverride(
  stepId: string,
  content: Record<string, unknown>,
): Promise<GenStep> {
  return adminFetch(`/api/v1/admin/lesson-steps/${stepId}/override`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  }) as Promise<GenStep>;
}

export function clearStepOverride(stepId: string): Promise<GenStep> {
  return adminFetch(`/api/v1/admin/lesson-steps/${stepId}/override`, {
    method: 'DELETE',
  }) as Promise<GenStep>;
}

// --- v6.2 audio clip library -------------------------------------------------

export interface ClipOut {
  id: string;
  slug: string;
  title: string;
  description: string;
  duration_ms: number;
  track_affinity: string[];
  concept_tags: string[];
  license: string;
  attribution: string | null;
  audio_url: string | null;
  created_at: string;
}

export interface ClipSearchResult {
  slug: string;
  title: string;
  description: string;
  duration_ms: number;
  track_affinity: string[];
  concept_tags: string[];
  score: number;
}

export interface ClipMeta {
  slug: string;
  title: string;
  description: string;
  duration_ms?: number;
  track_affinity: string[];
  concept_tags: string[];
  license: 'CC0' | 'CC-BY' | 'original-by-you' | 'licensed-third-party';
  attribution?: string | null;
}

export function listClips(): Promise<ClipOut[]> {
  return adminFetch('/api/v1/admin/clips') as Promise<ClipOut[]>;
}

export function searchClips(params: {
  q?: string;
  tags?: string[];
  track?: string;
  limit?: number;
}): Promise<ClipSearchResult[]> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.track) qs.set('track', params.track);
  if (params.limit) qs.set('limit', String(params.limit));
  for (const t of params.tags ?? []) qs.append('tags', t);
  return adminFetch(`/api/v1/admin/clips/search?${qs.toString()}`) as Promise<
    ClipSearchResult[]
  >;
}

export async function uploadClip(meta: ClipMeta, file: File): Promise<ClipOut> {
  // Multipart upload — note we must NOT set content-type (the browser sets the
  // multipart boundary), so this bypasses the JSON adminFetch helper.
  const form = new FormData();
  form.append('meta', JSON.stringify(meta));
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/v1/admin/clips`, {
    method: 'POST',
    headers: { 'x-admin-key': getAdminKey() ?? '' },
    body: form,
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return (await res.json()) as ClipOut;
}

export function patchClip(
  id: string,
  body: Partial<ClipMeta>,
): Promise<ClipOut> {
  return adminFetch(`/api/v1/admin/clips/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }) as Promise<ClipOut>;
}

export function archiveClip(id: string): Promise<ClipOut> {
  return adminFetch(`/api/v1/admin/clips/${id}`, {
    method: 'DELETE',
  }) as Promise<ClipOut>;
}

// --- v6.4 curriculum authoring tooling --------------------------------------

export interface LessonSpecOut {
  id: string;
  track: string;
  title: string;
  objectives: string[];
  difficulty: 'intro' | 'intermediate' | 'advanced';
  prerequisites: string[];
  step_outline: Array<Record<string, unknown>>;
  constraints_during_prompts: string[];
  description?: string | null;
}

export interface BatchItem {
  id: string;
  slug: string;
  title: string;
  generation_status: string;
  generation_error: string | null;
}

export interface BatchResult {
  requested: number;
  results: BatchItem[];
}

export interface QAFinding {
  rule: string;
  level: 'error' | 'warn';
  message: string;
}

export interface LessonQA {
  id: string;
  spec_id: string | null;
  slug: string;
  title: string;
  status: 'pass' | 'warn' | 'fail';
  errors: number;
  warnings: number;
  findings: QAFinding[];
}

export interface CurriculumQA {
  status: 'pass' | 'warn' | 'fail';
  graph_findings: QAFinding[];
  lessons: LessonQA[];
}

export interface PrereqNode {
  id: string;
  lesson_id: string;
  track: string;
  title: string;
  difficulty: string;
}

export interface PrereqEdge {
  prerequisite: string;
  lesson: string;
}

export interface PrereqGraph {
  nodes: PrereqNode[];
  edges: PrereqEdge[];
}

export function generateSpec(body: {
  topic: string;
  track: string;
  outline?: string;
  difficulty?: 'intro' | 'intermediate' | 'advanced';
}): Promise<{ spec: LessonSpecOut }> {
  return adminFetch('/api/v1/admin/curriculum/spec-generate', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Promise<{ spec: LessonSpecOut }>;
}

export function batchGenerate(lessonIds: string[] = []): Promise<BatchResult> {
  return adminFetch('/api/v1/admin/curriculum/batch-generate', {
    method: 'POST',
    body: JSON.stringify({ lesson_ids: lessonIds }),
  }) as Promise<BatchResult>;
}

export function runCurriculumQA(): Promise<CurriculumQA> {
  return adminFetch('/api/v1/admin/curriculum/qa') as Promise<CurriculumQA>;
}

export function runLessonQA(lessonId: string): Promise<LessonQA> {
  return adminFetch(
    `/api/v1/admin/curriculum/qa/${lessonId}`,
  ) as Promise<LessonQA>;
}

export function getPrereqs(): Promise<PrereqGraph> {
  return adminFetch('/api/v1/admin/curriculum/prereqs') as Promise<PrereqGraph>;
}

export function putPrereqs(edges: PrereqEdge[]): Promise<PrereqGraph> {
  return adminFetch('/api/v1/admin/curriculum/prereqs', {
    method: 'PUT',
    body: JSON.stringify({ edges }),
  }) as Promise<PrereqGraph>;
}

// --- v6.5 lesson analytics (admin-only, aggregate) --------------------------

export interface LessonAnalyticsRow {
  lesson_id: string;
  slug: string | null;
  title: string | null;
  track_id: string | null;
  views: number;
  completions: number;
  completion_rate: number;
  avg_completion_ms: number;
  abandonments: number;
  reflections: number;
  reflection_rate: number;
}

export interface StepTimeRow {
  step_position: number;
  count: number;
  mean_ms: number;
  median_ms: number;
  p90_ms: number;
}

export interface PromptStats {
  prompt_steps: number[];
  tried: number;
  skipped: number;
  tried_ratio: number;
  per_step: Array<{ step_position: number; tried: number; skipped: number }>;
}

export interface ClipStatsRow {
  clip_slug: string;
  exposures: number;
  plays: number;
  replays: number;
  skips: number;
  skip_rate: number;
}

export interface LessonAnalyticsDetail {
  rollup: LessonAnalyticsRow;
  total_steps: number;
  dropoff: number[];
  step_times: StepTimeRow[];
  prompt_stats: PromptStats;
  clip_stats: ClipStatsRow[];
}

export interface TrackPath {
  from: string | null;
  to: string | null;
  count: number;
  on_graph: boolean;
}

export interface TrackAnalyticsRow {
  track_id: string;
  slug: string;
  title: string;
  lessons: number;
  starts: number;
  completions: number;
  completion_rate: number;
  top_paths: TrackPath[];
  off_graph_paths: TrackPath[];
}

export function getLessonAnalytics(): Promise<{ items: LessonAnalyticsRow[] }> {
  return adminFetch('/api/v1/admin/analytics/lessons') as Promise<{
    items: LessonAnalyticsRow[];
  }>;
}

export function getLessonAnalyticsDetail(
  lessonId: string,
): Promise<LessonAnalyticsDetail> {
  return adminFetch(
    `/api/v1/admin/analytics/lessons/${lessonId}`,
  ) as Promise<LessonAnalyticsDetail>;
}

export function getTrackAnalytics(): Promise<{ items: TrackAnalyticsRow[] }> {
  return adminFetch('/api/v1/admin/analytics/tracks') as Promise<{
    items: TrackAnalyticsRow[];
  }>;
}

export function getClipAnalytics(): Promise<{ items: ClipStatsRow[] }> {
  return adminFetch('/api/v1/admin/analytics/clips') as Promise<{
    items: ClipStatsRow[];
  }>;
}

export function refreshAnalytics(): Promise<{
  refreshed: boolean;
  refreshed_at: string;
}> {
  return adminFetch('/api/v1/admin/analytics/refresh', {
    method: 'POST',
  }) as Promise<{ refreshed: boolean; refreshed_at: string }>;
}

export const EXAMPLE_SPEC = `{
  "id": "synthesis-fundamentals/karplus-strong",
  "track": "synthesis-fundamentals",
  "title": "How the String Engine Works",
  "objectives": [
    "Understand the basic principle of Karplus-Strong synthesis",
    "Hear the effect of damping on the string sound"
  ],
  "difficulty": "intro",
  "prerequisites": [],
  "step_outline": [
    { "type": "text", "topic": "What physical modeling is", "diagram": "svg" },
    { "type": "demo", "patch_brief": "A bright Karplus pluck, brightness high" },
    { "type": "prompt", "task": "Try adjusting damping while listening" },
    { "type": "reflection", "topic": "the effect of damping" }
  ],
  "constraints_during_prompts": ["damping", "brightness"]
}`;
