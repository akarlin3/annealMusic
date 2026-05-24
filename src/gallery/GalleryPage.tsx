import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { galleryApi } from '@/gallery/api';
import type { GalleryItem, GallerySort } from '@/gallery/types';
import GalleryCard from '@/gallery/GalleryCard';
import GalleryFilters, { type FilterState } from '@/gallery/GalleryFilters';
import GallerySearch from '@/gallery/GallerySearch';
import ReportDialog from '@/gallery/ReportDialog';

const SORTS: GallerySort[] = ['newest', 'oldest', 'most_loaded'];

function readFilters(params: URLSearchParams): FilterState {
  const sort = params.get('sort');
  return {
    sort: SORTS.includes(sort as GallerySort) ? (sort as GallerySort) : 'newest',
    engine: params.get('engine') ?? '',
    mode: params.get('mode') ?? '',
    hasCaptures: params.get('has_captures') === 'true',
  };
}

export default function GalleryPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const q = params.get('q') ?? '';

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [playingSlug, setPlayingSlug] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (append: boolean, nextCursor?: string) => {
      setLoading(true);
      setError(false);
      try {
        const res = await galleryApi.list({
          sort: filters.sort,
          engine: filters.engine || undefined,
          mode: filters.mode || undefined,
          hasCaptures: filters.hasCaptures || undefined,
          q: q || undefined,
          cursor: nextCursor,
        });
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setCursor(res.next_cursor);
      } catch {
        setError(true);
        if (!append) setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [filters, q],
  );

  // Refetch from scratch whenever the query (filters/search) changes.
  useEffect(() => {
    setPlayingSlug(null);
    void fetchPage(false);
  }, [fetchPage]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const updateParams = (mut: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    mut(next);
    setParams(next, { replace: true });
  };

  const setOrDelete = (p: URLSearchParams, key: string, value: string) => {
    if (value) p.set(key, value);
    else p.delete(key);
  };

  const onFilters = (next: FilterState) =>
    updateParams((p) => {
      p.set('sort', next.sort);
      setOrDelete(p, 'engine', next.engine);
      setOrDelete(p, 'mode', next.mode);
      setOrDelete(p, 'has_captures', next.hasCaptures ? 'true' : '');
    });

  const onSearch = (value: string) =>
    updateParams((p) => setOrDelete(p, 'q', value));

  const togglePreview = (slug: string) =>
    setPlayingSlug((cur) => (cur === slug ? null : slug));

  return (
    <div className="min-h-screen w-full" style={{ background: '#0c0a09', color: '#f5f5f4' }}>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 flex items-baseline justify-between">
          <div>
            <h1 className="font-display text-4xl tracking-tight" style={{ color: '#fef3c7' }}>
              <em>Gallery</em>
            </h1>
            <p className="mt-1 font-body text-sm" style={{ color: '#a8a29e' }}>
              Public patches shared by the community. Preview, then load any into
              the sandbox.
            </p>
          </div>
          <Link
            to="/"
            className="font-mono text-[11px] uppercase tracking-[0.2em]"
            style={{ color: '#f59e0b' }}
          >
            ← Sandbox
          </Link>
        </header>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <GalleryFilters value={filters} onChange={onFilters} />
          <GallerySearch value={q} onSearch={onSearch} />
        </div>

        {error && (
          <div
            className="mb-6 rounded-md p-4 text-sm"
            style={{ background: '#1c1917', border: '1px solid #44403c', color: '#fca5a5' }}
          >
            Couldn't reach the gallery. The sandbox still works —{' '}
            <Link to="/" style={{ color: '#f59e0b' }}>
              go back
            </Link>
            .
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="py-20 text-center" style={{ color: '#78716c' }}>
            <p className="font-body text-lg">No patches match.</p>
            <p className="mt-1 text-sm">Try clearing filters or search.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <GalleryCard
              key={item.id}
              item={item}
              playing={playingSlug === item.short_slug}
              onTogglePreview={() => togglePreview(item.short_slug)}
              onReport={() => setReportTarget(item.id)}
            />
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          {loading ? (
            <span className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: '#57534e' }}>
              Loading…
            </span>
          ) : cursor ? (
            <button
              onClick={() => void fetchPage(true, cursor)}
              className="rounded-full px-5 py-2 font-mono text-[11px] uppercase tracking-[0.2em]"
              style={{ border: '1px solid #44403c', color: '#fef3c7' }}
            >
              Load more
            </button>
          ) : null}
        </div>
      </div>

      {reportTarget && (
        <ReportDialog
          patchId={reportTarget}
          onClose={() => setReportTarget(null)}
          onDone={setToast}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-sm"
          style={{ background: '#1c1917', border: '1px solid #44403c', color: '#e7e5e4' }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
