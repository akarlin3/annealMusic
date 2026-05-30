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

export function clearAdminKey(): void {
  sessionStorage.removeItem(KEY_STORAGE);
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
