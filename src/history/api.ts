// v4.5 — thin history helpers over the central api client. The HTTP methods
// themselves live in src/api/client.ts; this module owns presentation helpers
// so the stats / duration framing stays consistent (and calm) in one place.
import { api } from '@/api/client';
export type { SessionPlay, SessionPlayList, SessionStats } from '@/api/types';

export const historyApi = {
  list: api.listSessionPlays,
  stats: api.sessionStats,
  update: api.updateSessionPlay,
  forget: api.forgetSessionPlay,
};

/** Human, calm duration: "21 min", "1.2 hours", "—" for nothing. */
export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '—';
  const minutes = ms / 60000;
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = ms / 3_600_000;
  return `${hours.toFixed(1)} hours`;
}

/** A quiet date label, e.g. "May 30, 2026". */
export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}
