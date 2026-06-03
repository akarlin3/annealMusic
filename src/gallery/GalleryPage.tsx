import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { galleryApi } from '@/gallery/api';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import type { GalleryItem, GallerySort } from '@/gallery/types';
import type { FeaturedPickOut } from '@/api/types';
import GalleryCard from '@/gallery/GalleryCard';
import GalleryFilters, { type FilterState } from '@/gallery/GalleryFilters';
import GallerySearch from '@/gallery/GallerySearch';
import ReportDialog from '@/gallery/ReportDialog';
import EmbedDialog from '@/embed/EmbedDialog';
import { Sparkles, ChevronRight } from 'lucide-react';
import { Header } from '@/components/Header';
import LoginDialog from '@/components/LoginDialog';

const SORTS: GallerySort[] = ['newest', 'oldest', 'most_loaded', 'most_liked'];

function readFilters(params: URLSearchParams): FilterState {
  const sort = params.get('sort');
  return {
    sort: SORTS.includes(sort as GallerySort)
      ? (sort as GallerySort)
      : 'newest',
    engine: params.get('engine') ?? '',
    mode: params.get('mode') ?? '',
    hasCaptures: params.get('has_captures') === 'true',
    followedOnly: params.get('followed_only') === 'true',
  };
}

export default function GalleryPage() {
  const [params, setParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const filters = useMemo(() => readFilters(params), [params]);
  const q = params.get('q') ?? '';

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [featuredPicks, setFeaturedPicks] = useState<FeaturedPickOut[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [playingSlug, setPlayingSlug] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [embedTarget, setEmbedTarget] = useState<GalleryItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

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
          followedOnly: filters.followedOnly || undefined,
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

  // Fetch curated picks once on mount
  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const picks = await api.getFeaturedPicks();
        setFeaturedPicks(picks);
      } catch (err) {
        console.error('Failed to load featured picks in gallery:', err);
      }
    };
    fetchFeatured();
  }, []);

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
      setOrDelete(p, 'followed_only', next.followedOnly ? 'true' : '');
    });

  const onSearch = (value: string) =>
    updateParams((p) => setOrDelete(p, 'q', value));

  const togglePreview = (slug: string) =>
    setPlayingSlug((cur) => (cur === slug ? null : slug));

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: '#0c0a09', color: '#f5f5f4' }}
    >
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Header
          subtitle="Public patches shared by the community. Preview, then load any into the sandbox."
          onSignInClick={() => setLoginOpen(true)}
        >
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="font-mono text-[11px] uppercase tracking-[0.2em] cursor-pointer"
              style={{ color: '#f59e0b' }}
            >
              ← Sandbox
            </Link>
          </div>
        </Header>

        {featuredPicks.length > 0 && (
          <div
            className="mb-8 rounded-xl border p-5 animate-fade-in relative overflow-hidden"
            style={{
              background: 'rgba(245, 158, 11, 0.03)',
              borderColor: 'rgba(245, 158, 11, 0.2)',
              boxShadow: '0 0 20px rgba(245, 158, 11, 0.01)',
            }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={13} className="text-amber-500 animate-pulse" />
              <h2 className="font-mono text-[9px] uppercase tracking-[0.25em] font-semibold text-amber-400">
                Curator Picks of the Week
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {featuredPicks.map((pick) => {
                if (!pick.patch) return null;
                return (
                  <div
                    key={pick.id}
                    className="p-3.5 rounded-lg border border-stone-850 bg-stone-900/30 hover:border-stone-700/60 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="font-semibold text-stone-200 text-xs truncate">
                        {pick.patch.title || 'Untitled Patch'}
                      </div>
                      {pick.curator_note && (
                        <p className="text-[9px] text-amber-500/80 italic mt-1.5 leading-normal font-mono">
                          "{pick.curator_note}"
                        </p>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-stone-900/40 pt-2.5">
                      <span className="text-[8px] text-stone-500 uppercase tracking-widest font-mono">
                        Pos #{pick.position}
                      </span>
                      <Link
                        to={`/p/${pick.patch.short_slug}`}
                        className="text-[9px] uppercase font-semibold text-amber-500 hover:text-amber-400 font-mono flex items-center gap-0.5"
                      >
                        <span>Load</span>
                        <ChevronRight size={10} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <GalleryFilters
            value={filters}
            onChange={onFilters}
            showFollowedOnly={isAuthenticated}
          />
          <GallerySearch value={q} onSearch={onSearch} />
        </div>

        {error && (
          <div
            className="mb-6 rounded-md p-4 text-sm"
            style={{
              background: '#1c1917',
              border: '1px solid #44403c',
              color: '#fca5a5',
            }}
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
              onEmbed={() => setEmbedTarget(item)}
            />
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          {loading ? (
            <span
              className="font-mono text-[11px] uppercase tracking-[0.2em]"
              style={{ color: '#57534e' }}
            >
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

      {embedTarget && (
        <EmbedDialog
          slug={embedTarget.short_slug}
          title={embedTarget.title ?? 'Untitled'}
          onClose={() => setEmbedTarget(null)}
          showToast={setToast}
        />
      )}

      {loginOpen && (
        <LoginDialog isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
      )}

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-sm"
          style={{
            background: '#1c1917',
            border: '1px solid #44403c',
            color: '#e7e5e4',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
