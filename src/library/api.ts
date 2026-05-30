// v4.5 — thin client for the curated /listen library. Public reads only here;
// admin curation lives in src/admin/api.ts behind the x-admin-key gate.
import { api } from '@/api/client';
export type { LibraryListing, LibraryList } from '@/api/types';

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

export interface LibraryFilters {
  intention?: string;
  length?: string;
  character?: string;
}

export const libraryApi = {
  list: (f?: LibraryFilters) => api.getLibrary(f),
  picks: () => api.getLibraryPicks(),
  /** Absolute URL for an `<audio>` element from a listing's relative preview path. */
  previewUrl: (path: string | null): string | null =>
    path ? `${API_BASE}${path}` : null,
};
