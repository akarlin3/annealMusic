import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Trash2 } from 'lucide-react';
import { api, getErrorMessage } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import type { SessionPlay, SessionStats } from '@/api/types';
import { formatDate, formatDuration } from '@/history/api';
import ReflectionEditor from '@/history/ReflectionEditor';

/**
 * v4.5 — `/me/sessions`. A private, calm record of past Listening Sessions.
 * No streaks, no goals, no nudges — just the user's own log. Stats are
 * deliberately understated and come verbatim from the server.
 */
export default function SessionHistoryPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [plays, setPlays] = useState<SessionPlay[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, s] = await Promise.all([
        api.listSessionPlays(),
        api.sessionStats(),
      ]);
      setPlays(list.items);
      setStats(s);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const saveReflection = async (id: string, text: string) => {
    const updated = await api.updateSessionPlay(id, {
      reflection: text || null,
    });
    setPlays((prev) => prev.map((p) => (p.id === id ? updated : p)));
  };

  const forget = async (id: string) => {
    await api.forgetSessionPlay(id);
    setPlays((prev) => prev.filter((p) => p.id !== id));
    // Refresh stats so the totals stay honest after a removal.
    try {
      setStats(await api.sessionStats());
    } catch {
      /* non-fatal */
    }
  };

  return (
    <div className="min-h-screen w-full bg-stone-950 text-stone-200 font-body">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <header className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="text-stone-500 hover:text-stone-300 transition-colors"
            title="Back"
          >
            <ArrowLeft size={18} strokeWidth={1.5} />
          </button>
          <h1 className="font-mono text-xs uppercase tracking-[0.2em] text-stone-400">
            Your sessions
          </h1>
        </header>

        {!isAuthenticated ? (
          <div className="rounded-xl border border-stone-850 bg-stone-900/30 p-8 text-center">
            <p className="text-stone-300 mb-4">
              Sign in to keep a private history of your sessions.
            </p>
            <Link
              to="/account"
              className="font-mono text-[10px] uppercase tracking-wider text-amber-400 hover:text-amber-300"
            >
              Sign in
            </Link>
          </div>
        ) : loading ? (
          <p className="text-stone-500 font-mono text-[10px] uppercase tracking-[0.2em]">
            Gathering your sessions…
          </p>
        ) : error ? (
          <p className="text-rose-400/80 text-sm">{error}</p>
        ) : (
          <>
            {/* Minimal, descriptive stats — no comparatives, no streaks. */}
            {stats && stats.total_sessions > 0 && (
              <div className="mb-8 rounded-xl border border-stone-850 bg-stone-900/20 px-5 py-4">
                <p className="text-stone-300 text-sm">
                  {stats.this_month_sessions}{' '}
                  {stats.this_month_sessions === 1 ? 'session' : 'sessions'},{' '}
                  {formatDuration(stats.this_month_listened_ms)} total this
                  month.
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-stone-600">
                  {stats.total_sessions} all-time · average{' '}
                  {formatDuration(stats.average_length_ms)}
                </p>
              </div>
            )}

            {plays.length === 0 ? (
              <p className="text-stone-600 text-sm">
                Your sessions will appear here.
              </p>
            ) : (
              <ul className="space-y-4">
                {plays.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-stone-850 bg-stone-900/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-wider text-stone-600">
                          {formatDate(p.started_at)}
                        </p>
                        <h2 className="text-stone-200 mt-0.5">
                          {p.session_title || 'Listening Session'}
                        </h2>
                        <p className="mt-0.5 font-mono text-[10px] text-stone-500">
                          Listened {formatDuration(p.duration_listened_ms)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {p.session_slug && (
                          <Link
                            to={`/listening/${p.session_slug}`}
                            title="Replay this session"
                            className="flex items-center justify-center h-8 w-8 rounded-full border border-stone-800 text-stone-400 hover:text-amber-400 hover:border-amber-500/50 transition-all"
                          >
                            <Play
                              size={13}
                              strokeWidth={1.5}
                              className="ml-0.5"
                            />
                          </Link>
                        )}
                        <button
                          onClick={() => forget(p.id)}
                          title="Forget this session"
                          className="flex items-center justify-center h-8 w-8 rounded-full border border-stone-800 text-stone-500 hover:text-rose-400 hover:border-rose-500/40 transition-all"
                        >
                          <Trash2 size={13} strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                    <ReflectionEditor
                      initial={p.reflection}
                      onSave={(text) => saveReflection(p.id, text)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
