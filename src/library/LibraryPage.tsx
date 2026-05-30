import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { api, getErrorMessage } from '@/api/client';
import type { LibraryListing } from '@/api/types';
import type { LibraryFilters as Filters } from '@/library/api';
import LibraryFilters from '@/library/LibraryFilters';
import LibraryCard from '@/library/LibraryCard';

/**
 * v4.5 — `/listen`. The curated, editorial meditation entry point. Distinct
 * from `/gallery` (creator-side discovery). Browse by intention, length, and
 * audio character; an editor's-picks strip surfaces featured sessions.
 */
export default function LibraryPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [listings, setListings] = useState<LibraryListing[]>([]);
  const [picks, setPicks] = useState<LibraryListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Picks are filter-independent; load once.
  useEffect(() => {
    if (!api.isBackendConfigured()) return;
    void api
      .getLibraryPicks()
      .then((res) => setPicks(res.items))
      .catch(() => setPicks([]));
  }, []);

  useEffect(() => {
    if (!api.isBackendConfigured()) {
      setError('The library requires an active server connection.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getLibrary(filters)
      .then((res) => {
        if (!cancelled) {
          setListings(res.items);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const hasFilters = useMemo(
    () => Boolean(filters.intention || filters.length || filters.character),
    [filters],
  );

  const togglePreview = (id: string) =>
    setPlayingId((cur) => (cur === id ? null : id));

  return (
    <div className="min-h-screen w-full bg-stone-950 text-stone-200 font-body">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Compass size={20} className="text-amber-500/80" />
            <div>
              <h1 className="font-display text-2xl text-stone-100">Listen</h1>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600">
                A curated library for practice
              </p>
            </div>
          </div>
          <Link
            to="/"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone-500 hover:text-stone-300"
          >
            Sandbox →
          </Link>
        </header>

        {/* Editor's recent picks */}
        {!hasFilters && picks.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-500/70">
              Editor's recent picks
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {picks.map((p) => (
                <LibraryCard
                  key={`pick-${p.id}`}
                  listing={p}
                  playing={playingId === `pick-${p.id}`}
                  onTogglePreview={() => togglePreview(`pick-${p.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-8 md:grid-cols-[200px_1fr]">
          <aside className="md:sticky md:top-8 md:self-start">
            <LibraryFilters filters={filters} onChange={setFilters} />
          </aside>

          <main>
            {loading ? (
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
                Gathering the library…
              </p>
            ) : error ? (
              <p className="text-rose-400/80 text-sm">{error}</p>
            ) : listings.length === 0 ? (
              <p className="text-stone-600 text-sm">
                Nothing here yet — try a different filter.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {listings.map((l) => (
                  <LibraryCard
                    key={l.id}
                    listing={l}
                    playing={playingId === l.id}
                    onTogglePreview={() => togglePreview(l.id)}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
