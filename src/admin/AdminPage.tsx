import { useCallback, useEffect, useState } from 'react';
import { adminApi, type AdminReport } from '@/admin/api';
import { api, getErrorMessage } from '@/api/client';
import { ApiError } from '@/api/types';
import { ShieldAlert, Trash2, Star } from 'lucide-react';

const KEY_STORAGE = 'am_admin_key';

export default function AdminPage() {
  const [key, setKey] = useState<string | null>(() =>
    sessionStorage.getItem(KEY_STORAGE),
  );
  const [keyInput, setKeyInput] = useState('');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [curatorPicks, setCuratorPicks] = useState<
    { patch_id: string; position: number; curator_note: string }[]
  >([]);
  const [newPickId, setNewPickId] = useState('');
  const [newPickNote, setNewPickNote] = useState('');
  const [newPickPos, setNewPickPos] = useState(1);
  const [suspendAccountId, setSuspendAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (k: string) => {
    setLoading(true);
    setError(null);
    try {
      setReports(await adminApi.listReports(k));
      const currentFeatured = await api.getFeaturedPicks();
      setCuratorPicks(
        currentFeatured.map((p) => ({
          patch_id: p.patch_id,
          position: p.position,
          curator_note: p.curator_note ?? '',
        })),
      );
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.status === 401 || err.status === 404)
      ) {
        sessionStorage.removeItem(KEY_STORAGE);
        setKey(null);
        setError('Invalid admin key');
      } else {
        setError('Failed to load reports');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (key) void load(key);
  }, [key, load]);

  const submitKey = () => {
    const k = keyInput.trim();
    if (!k) return;
    sessionStorage.setItem(KEY_STORAGE, k);
    setKey(k);
  };

  const resolve = async (id: string, status: 'dismissed' | 'upheld') => {
    if (!key) return;
    await adminApi.resolve(key, id, status);
    void load(key);
  };

  const handleSaveCuration = async () => {
    if (!key) return;
    try {
      setLoading(true);
      await adminApi.curateFeaturedPicks(key, curatorPicks);
      setError(null);
      alert('Curated featured picks saved for this week!');
      void load(key);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, 'Failed to save curated picks.'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddPick = () => {
    const id = newPickId.trim();
    if (!id) return;
    setCuratorPicks((prev) => {
      const filtered = prev.filter((p) => p.position !== newPickPos);
      const next = [
        ...filtered,
        {
          patch_id: id,
          position: newPickPos,
          curator_note: newPickNote.trim(),
        },
      ];
      return next.sort((a, b) => a.position - b.position);
    });
    setNewPickId('');
    setNewPickNote('');
  };

  const handleRemovePick = (position: number) => {
    setCuratorPicks((prev) => prev.filter((p) => p.position !== position));
  };

  const handleSuspend = async (suspend: boolean) => {
    if (!key) return;
    const accountId = suspendAccountId.trim();
    if (!accountId) return;
    try {
      setLoading(true);
      if (suspend) {
        await adminApi.suspendAccount(key, accountId);
        alert('Account suspended successfully. Active sessions revoked.');
      } else {
        await adminApi.unsuspendAccount(key, accountId);
        alert('Account unsuspended.');
      }
      setSuspendAccountId('');
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, 'Moderation operation failed.'));
    } finally {
      setLoading(false);
    }
  };

  if (!key) {
    return (
      <Shell>
        <div className="mx-auto max-w-sm pt-24">
          <h1
            className="mb-4 font-display text-3xl"
            style={{ color: '#fef3c7' }}
          >
            Admin
          </h1>
          <input
            type="password"
            aria-label="Admin key"
            placeholder="Admin key"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitKey()}
            className="mb-3 w-full rounded-md p-2 text-sm outline-none"
            style={{
              background: '#1c1917',
              border: '1px solid #44403c',
              color: '#e7e5e4',
            }}
          />
          {error && (
            <p className="mb-3 text-sm" style={{ color: '#fca5a5' }}>
              {error}
            </p>
          )}
          <button
            onClick={submitKey}
            className="rounded-full px-5 py-2 font-mono text-[11px] uppercase tracking-[0.2em]"
            style={{ border: '1px solid #44403c', color: '#fef3c7' }}
          >
            Enter
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-3xl pt-12">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-3xl" style={{ color: '#fef3c7' }}>
            Open reports
          </h1>
          <button
            onClick={() => {
              sessionStorage.removeItem(KEY_STORAGE);
              setKey(null);
            }}
            className="font-mono text-[10px] uppercase tracking-[0.2em]"
            style={{ color: '#78716c' }}
          >
            Sign out
          </button>
        </div>

        {error && (
          <p className="mb-4 text-sm" style={{ color: '#fca5a5' }}>
            {error}
          </p>
        )}
        {loading && <p style={{ color: '#78716c' }}>Loading…</p>}
        {!loading && reports.length === 0 && (
          <p style={{ color: '#78716c' }}>No open reports.</p>
        )}

        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <div
              key={r.id}
              className="rounded-md p-4"
              style={{ background: '#0f0d0c', border: '1px solid #292524' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div
                    className="font-display text-lg"
                    style={{ color: '#fef3c7' }}
                  >
                    {r.patch_title || 'Untitled'}
                  </div>
                  <div
                    className="mt-1 font-mono text-[11px]"
                    style={{ color: '#a8a29e' }}
                  >
                    {r.reason} · {r.reporter} ·{' '}
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                  {r.detail && (
                    <p className="mt-2 text-sm" style={{ color: '#d6d3d1' }}>
                      {r.detail}
                    </p>
                  )}
                  <a
                    href={adminApi.previewUrl(r.patch_slug)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block font-mono text-[11px]"
                    style={{ color: '#f59e0b' }}
                  >
                    preview ↗
                  </a>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => void resolve(r.id, 'dismissed')}
                    className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em]"
                    style={{ border: '1px solid #44403c', color: '#a8a29e' }}
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => void resolve(r.id, 'upheld')}
                    className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em]"
                    style={{ border: '1px solid #b91c1c', color: '#fca5a5' }}
                  >
                    Uphold
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Weekly Curation Picks Panel */}
        <section
          className="mt-12 rounded-xl p-6 border border-stone-850"
          style={{ background: '#141210', borderColor: '#292524' }}
        >
          <div className="flex items-center gap-2 mb-6">
            <Star size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-200">
              Weekly Featured Picks Curation
            </h2>
          </div>

          <p className="text-xs text-stone-400 mb-6 leading-relaxed">
            Curate up to 8 public patches to showcase in the Gallery header and
            on empty activity feeds. These selections rotate automatically every
            Monday UTC.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            {/* List Current Picks */}
            <div className="space-y-3">
              <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                Picks to Save ({curatorPicks.length}/8)
              </h3>
              {curatorPicks.length === 0 ? (
                <p className="text-[10px] text-stone-600 uppercase font-mono italic">
                  No featured picks added yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {curatorPicks.map((pick) => (
                    <div
                      key={pick.position}
                      className="flex items-center justify-between rounded bg-stone-950/40 p-2 border border-stone-900"
                    >
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-stone-300 font-mono">
                          <span className="text-amber-500 font-semibold font-mono">
                            Pos #{pick.position}:
                          </span>{' '}
                          {pick.patch_id.substring(0, 8)}...
                        </div>
                        {pick.curator_note && (
                          <div className="text-[9px] text-stone-500 italic">
                            "{pick.curator_note}"
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemovePick(pick.position)}
                        className="text-[9px] uppercase tracking-wider font-semibold text-stone-500 hover:text-red-400 p-1"
                        aria-label="Remove pick"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {curatorPicks.length > 0 && (
                <button
                  onClick={handleSaveCuration}
                  disabled={loading}
                  className="rounded-full px-5 py-2 font-mono text-[10px] uppercase tracking-[0.2em] font-semibold transition-all hover:opacity-90 disabled:opacity-50 mt-4"
                  style={{ background: '#f59e0b', color: '#0c0a09' }}
                >
                  Save Curation
                </button>
              )}
            </div>

            {/* Add New Pick Form */}
            <div className="space-y-4 rounded-lg border border-stone-900 bg-stone-950/30 p-4">
              <h3 className="text-[10px] uppercase tracking-wider text-stone-300 font-semibold">
                Add Curated Patch
              </h3>

              <div>
                <label className="mb-1 block text-[9px] uppercase tracking-wider text-stone-500">
                  Patch ID (UUID)
                </label>
                <input
                  type="text"
                  placeholder="3fa85f64-5717-4562-b3fc-2c963f66afa6"
                  value={newPickId}
                  onChange={(e) => setNewPickId(e.target.value)}
                  className="w-full rounded bg-stone-900 p-2 font-mono text-[11px] outline-none border border-stone-800 text-stone-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-[9px] uppercase tracking-wider text-stone-500">
                  Curator Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="A tranquil, evolving resonance..."
                  value={newPickNote}
                  onChange={(e) => setNewPickNote(e.target.value)}
                  className="w-full rounded bg-stone-900 p-2 font-mono text-[11px] outline-none border border-stone-800 text-stone-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-[9px] uppercase tracking-wider text-stone-500">
                  Position (1-8)
                </label>
                <select
                  value={newPickPos}
                  onChange={(e) => setNewPickPos(Number(e.target.value))}
                  className="w-full rounded bg-stone-900 p-2 font-mono text-[11px] outline-none border border-stone-800 text-stone-200"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      Position #{n}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleAddPick}
                disabled={!newPickId.trim()}
                className="w-full rounded px-4 py-2 font-mono text-[9px] uppercase tracking-widest font-semibold border border-stone-700 text-stone-300 hover:text-white bg-stone-900 hover:bg-stone-850 transition-all disabled:opacity-50"
              >
                Add / Overwrite Pick
              </button>
            </div>
          </div>
        </section>

        {/* Account Moderation Panel */}
        <section className="mt-8 mb-16 rounded-xl p-6 border border-red-950/40 bg-red-950/5">
          <div className="flex items-center gap-2 mb-6">
            <ShieldAlert size={16} className="text-red-500" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-red-400">
              Account Moderation
            </h2>
          </div>

          <p className="text-xs text-stone-400 mb-6 leading-relaxed">
            Suspend accounts violating community rules. Suspending an account
            revokes all active credentials immediately, disables subsequent
            logins, and hides all public patches, recordings, and profile
            routes.
          </p>

          <div className="space-y-4 max-w-md">
            <div>
              <label className="mb-1.5 block text-[9px] uppercase tracking-wider text-stone-500">
                Account ID (UUID)
              </label>
              <input
                type="text"
                placeholder="3fa85f64-5717-4562-b3fc-2c963f66afa6"
                value={suspendAccountId}
                onChange={(e) => setSuspendAccountId(e.target.value)}
                className="w-full rounded bg-stone-900/60 p-2 font-mono text-[11px] outline-none border border-red-900/30 text-stone-200"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleSuspend(true)}
                disabled={!suspendAccountId.trim() || loading}
                className="flex-1 rounded px-4 py-2 font-mono text-[9px] uppercase tracking-widest font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: '#7f1d1d', color: '#fef2f2' }}
              >
                Suspend Account
              </button>
              <button
                type="button"
                onClick={() => handleSuspend(false)}
                disabled={!suspendAccountId.trim() || loading}
                className="flex-1 rounded px-4 py-2 font-mono text-[9px] uppercase tracking-widest font-semibold border border-stone-850 text-stone-300 hover:text-white bg-stone-950/40 transition-all disabled:opacity-50"
              >
                Remove Suspension
              </button>
            </div>
          </div>
        </section>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen w-full px-6"
      style={{ background: '#0c0a09', color: '#f5f5f4' }}
    >
      {children}
    </div>
  );
}
