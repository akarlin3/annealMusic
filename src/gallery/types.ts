/** Types mirroring the v0.8 gallery API surface (see docs/API.md). */

export type GallerySort = 'newest' | 'oldest' | 'most_loaded' | 'most_liked';
export type PreviewStatus = 'none' | 'rendering' | 'ready' | 'failed';
export type ReportReason = 'spam' | 'inappropriate' | 'other';

export interface GalleryItem {
  id: string;
  short_slug: string;
  title: string | null;
  description: string | null;
  /** The encoded URL payload (no `#s=N:` prefix) — drives the card visual. */
  state: string;
  engine: string;
  mode: string;
  has_captures: boolean;
  load_count: number;
  published_at: string | null;
  preview_status: PreviewStatus;
  preview_duration_ms: number | null;
}

export interface GalleryList {
  items: GalleryItem[];
  next_cursor: string | null;
}

export interface GalleryQuery {
  sort: GallerySort;
  engine?: string;
  mode?: string;
  hasCaptures?: boolean;
  followedOnly?: boolean;
  q?: string;
  cursor?: string;
}
