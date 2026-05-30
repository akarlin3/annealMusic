import { useCallback, useEffect, useState } from 'react';
import { Library, Star, Archive } from 'lucide-react';
import { adminApi } from '@/admin/api';
import { getErrorMessage } from '@/api/client';
import type { LibraryListing } from '@/api/types';
import {
  INTENTIONS,
  LENGTH_CATEGORIES,
  CHARACTER_TAGS,
  labelForIntention,
  labelForLength,
} from '@/library/taxonomy';

/**
 * v4.5 — admin curation for the `/listen` library. Add a listening session,
 * tag it, manage editor's picks, and archive. Gated by the v0.8 x-admin-key
 * (the key is supplied by the parent AdminPage).
 */
export default function LibraryCuration({ adminKey }: { adminKey: string }) {
  const [listings, setListings] = useState<LibraryListing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // New-listing form state.
  const [sessionId, setSessionId] = useState('');
  const [intention, setIntention] = useState('');
  const [length, setLength] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      setListings(await adminApi.listLibrary(adminKey, true));
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [adminKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleTag = (id: string) =>
    setTags((cur) =>
      cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id],
    );

  const add = async () => {
    if (!sessionId.trim()) return;
    setBusy(true);
    try {
      await adminApi.addLibrary(adminKey, {
        listening_session_id: sessionId.trim(),
        intention: intention || null,
        length_category: length || null,
        character_tags: tags,
        curator_note: note || null,
      });
      setSessionId('');
      setIntention('');
      setLength('');
      setTags([]);
      setNote('');
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const togglePick = async (l: LibraryListing) => {
    try {
      await adminApi.updateLibrary(adminKey, l.id, {
        editor_pick: !l.editor_pick,
      });
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const archive = async (l: LibraryListing) => {
    try {
      await adminApi.archiveLibrary(adminKey, l.id);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <section className="mt-8 mb-16 rounded-xl p-6 border border-stone-850 bg-stone-950/30">
      <div className="flex items-center gap-2 mb-6">
        <Library size={16} className="text-amber-500" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-200">
          Curated Library
        </h2>
      </div>

      {error && <p className="mb-4 text-xs text-rose-400/80">{error}</p>}

      {/* Add form */}
      <div className="mb-8 space-y-4 max-w-xl">
        <div>
          <label className="mb-1.5 block text-[9px] uppercase tracking-wider text-stone-500">
            Listening Session ID or slug
          </label>
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="evenslug"
            className="w-full rounded bg-stone-900/60 p-2 font-mono text-[11px] outline-none border border-stone-800 text-stone-200"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-[9px] uppercase tracking-wider text-stone-500">
              Intention
            </label>
            <select
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              className="w-full rounded bg-stone-900/60 p-2 text-[11px] outline-none border border-stone-800 text-stone-200"
            >
              <option value="">—</option>
              {INTENTIONS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-[9px] uppercase tracking-wider text-stone-500">
              Length
            </label>
            <select
              value={length}
              onChange={(e) => setLength(e.target.value)}
              className="w-full rounded bg-stone-900/60 p-2 text-[11px] outline-none border border-stone-800 text-stone-200"
            >
              <option value="">—</option>
              {LENGTH_CATEGORIES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[9px] uppercase tracking-wider text-stone-500">
            Character tags
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CHARACTER_TAGS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTag(t.id)}
                className={`rounded-full px-3 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors ${
                  tags.includes(t.id)
                    ? 'bg-amber-500/90 text-stone-950'
                    : 'border border-stone-800 text-stone-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[9px] uppercase tracking-wider text-stone-500">
            Curator note (optional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded bg-stone-900/60 p-2 text-[11px] outline-none border border-stone-800 text-stone-200"
          />
        </div>

        <button
          type="button"
          onClick={add}
          disabled={busy || !sessionId.trim()}
          className="rounded px-4 py-2 font-mono text-[9px] uppercase tracking-widest font-semibold bg-amber-500 text-stone-950 transition-all hover:bg-amber-400 disabled:opacity-50"
        >
          Add to library
        </button>
      </div>

      {/* Current listings */}
      <div className="space-y-2">
        {listings.length === 0 ? (
          <p className="text-xs text-stone-600">No listings yet.</p>
        ) : (
          listings.map((l) => {
            const archived = Boolean(l.archived_at);
            return (
              <div
                key={l.id}
                className={`flex items-center justify-between gap-3 rounded-lg border border-stone-850 bg-stone-900/20 px-3 py-2 ${
                  archived ? 'opacity-40' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-stone-200">
                    {l.session_title ||
                      l.session_slug ||
                      l.listening_session_id}
                  </p>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-stone-600">
                    {labelForIntention(l.intention)}
                    {l.length_category
                      ? ` · ${labelForLength(l.length_category)}`
                      : ''}
                    {' · '}
                    {l.preview_status}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => togglePick(l)}
                    title={
                      l.editor_pick ? 'Remove from picks' : 'Make editor pick'
                    }
                    className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${
                      l.editor_pick
                        ? 'border-amber-500/60 text-amber-400'
                        : 'border-stone-800 text-stone-500 hover:text-amber-400'
                    }`}
                  >
                    <Star
                      size={13}
                      fill={l.editor_pick ? 'currentColor' : 'none'}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => archive(l)}
                    title="Archive listing"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-800 text-stone-500 transition-all hover:text-rose-400 hover:border-rose-500/40"
                  >
                    <Archive size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
