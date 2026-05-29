import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { api, getErrorMessage } from '@/api/client';
import { LissajousAvatar } from '@/components/LissajousAvatar';
import { LikeButton } from '@/components/social/LikeButton';
import type { FeedItemOut, FeaturedPickOut } from '@/api/types';
import {
  Sparkles,
  Play,
  Square,
  ChevronRight,
  Disc,
  Music,
  ArrowRight,
  Loader2,
} from 'lucide-react';

export default function FeedPage() {
  const { isAuthenticated } = useAuth();
  const [feedItems, setFeedItems] = useState<FeedItemOut[]>([]);
  const [featuredPicks, setFeaturedPicks] = useState<FeaturedPickOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Playback states
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(
    null,
  );

  const fetchFeed = async (nextCursor?: string) => {
    if (!isAuthenticated) return;
    try {
      if (nextCursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const res = await api.getFeed(nextCursor);
      if (nextCursor) {
        setFeedItems((prev) => [...prev, ...res.items]);
      } else {
        setFeedItems(res.items);
      }
      setCursor(res.next_cursor);
    } catch (err) {
      console.error('Failed to load activity feed:', err);
      setError(getErrorMessage(err, 'Failed to resolve activity feed.'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchFeatured = async () => {
    try {
      const picks = await api.getFeaturedPicks();
      setFeaturedPicks(picks);
    } catch (err) {
      console.error('Failed to fetch featured picks:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchFeed();
    } else {
      setLoading(false);
    }
    // Always load featured picks in case they are needed for discovery empty state
    fetchFeatured();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleLoadMore = () => {
    if (cursor && !loadingMore) {
      fetchFeed(cursor);
    }
  };

  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center font-mono px-6"
        style={{ background: '#0c0a09', color: '#f5f5f4' }}
      >
        <div
          className="w-full max-w-md rounded-xl p-6 border text-center space-y-5"
          style={{ background: '#141210', borderColor: '#292524' }}
        >
          <div className="flex justify-center text-amber-500">
            <Sparkles size={36} className="animate-pulse" />
          </div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-stone-200">
            Social Community Surface
          </h2>
          <p className="text-xs text-stone-400 leading-relaxed">
            Sign in to claim your account, follow ambient sculptors, build a
            custom chronological feed, and share resonant modular patches.
          </p>
          <Link
            to="/account"
            className="inline-block w-full rounded-full py-2.5 text-[9px] uppercase tracking-widest font-semibold transition-all hover:opacity-90 text-center"
            style={{ background: '#f59e0b', color: '#0c0a09' }}
          >
            Authenticate Account
          </Link>
        </div>
      </div>
    );
  }

  if (loading && feedItems.length === 0) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center font-mono"
        style={{ background: '#0c0a09', color: '#fef3c7' }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-amber-500" size={24} />
          <span className="text-[10px] uppercase tracking-widest text-stone-500">
            Aligning Feed resonances...
          </span>
        </div>
      </div>
    );
  }

  const formatFeedDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: '#0c0a09', color: '#f5f5f4' }}
    >
      <div className="mx-auto max-w-xl px-6 py-12 font-mono">
        <header className="mb-10 flex items-center justify-between border-b border-stone-900 pb-4">
          <div>
            <h1
              className="text-lg uppercase tracking-[0.22em] font-bold"
              style={{ color: '#fef3c7' }}
            >
              Activity Feed
            </h1>
            <p className="text-[9px] uppercase tracking-wider text-stone-500 mt-1">
              Chronological updates from people you follow
            </p>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-400">
            {error}
          </div>
        )}

        {feedItems.length === 0 ? (
          /* Empty State: Discover People */
          <div className="space-y-8 animate-fade-in">
            <div
              className="rounded-xl border border-stone-850 p-6 text-center space-y-4"
              style={{ background: '#141210', borderColor: '#292524' }}
            >
              <h2 className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">
                Your Feed is Quiet
              </h2>
              <p className="text-xs text-stone-500 leading-relaxed max-w-xs mx-auto">
                No activity yet. Follow creators to fill your feed with ambient
                patches and audio recordings.
              </p>
            </div>

            {featuredPicks.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-stone-900 pb-2">
                  <Sparkles size={12} className="text-amber-500" />
                  <h3 className="text-[10px] uppercase tracking-[0.2em] font-semibold text-stone-300">
                    Curated Picks of the Week
                  </h3>
                </div>

                <div className="grid gap-3">
                  {featuredPicks.map((pick) => {
                    if (!pick.patch) return null;
                    return (
                      <div
                        key={pick.id}
                        className="rounded-xl border border-stone-850 p-4 bg-stone-900/30 hover:border-stone-700 transition-all flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-xs text-stone-500 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                              <span>Position #{pick.position}</span>
                              {pick.curator_note && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-stone-800" />
                                  <span className="text-amber-500/80 italic">
                                    "{pick.curator_note}"
                                  </span>
                                </>
                              )}
                            </div>
                            <Link
                              to={`/p/${pick.patch.short_slug}`}
                              className="text-sm font-semibold text-stone-200 hover:text-amber-400 transition-colors"
                            >
                              {pick.patch.title || 'Untitled Patch'}
                            </Link>
                            {pick.patch.description && (
                              <p className="text-xs text-stone-400 mt-1.5 leading-normal">
                                {pick.patch.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-stone-900/60 pt-2.5 mt-1">
                          <LikeButton
                            targetKind="patch"
                            targetId={pick.patch_id}
                            initialLiked={
                              (
                                pick.patch as unknown as {
                                  liked_by_me?: boolean;
                                }
                              ).liked_by_me ?? false
                            }
                            initialCount={
                              (pick.patch as unknown as { like_count?: number })
                                .like_count ?? 0
                            }
                          />

                          <Link
                            to={`/p/${pick.patch.short_slug}`}
                            className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-semibold text-amber-500 hover:text-amber-400 transition-colors"
                          >
                            <span>Load Patch</span>
                            <ArrowRight size={10} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Feed Content Stream */
          <div className="space-y-6">
            {feedItems.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-stone-850 p-5 bg-stone-900/20 hover:border-stone-800 transition-all space-y-4"
              >
                {/* Header: User Attribution & Timing */}
                <div className="flex items-center justify-between border-b border-stone-900/60 pb-3">
                  <Link
                    to={`/u/${item.creator_id}`}
                    className="flex items-center gap-3 text-left hover:opacity-90 group"
                  >
                    <LissajousAvatar
                      seed={item.creator_avatar_seed ?? 'default'}
                      size={36}
                    />
                    <div>
                      <div className="text-xs font-semibold text-stone-200 group-hover:text-amber-400 transition-colors">
                        {item.creator_name || 'Anonymous Creator'}
                      </div>
                      <div className="text-[8px] text-amber-500/80 uppercase tracking-widest font-mono mt-0.5">
                        View Profile
                      </div>
                    </div>
                  </Link>
                  <div className="text-[8px] uppercase tracking-wider text-stone-500 font-mono">
                    {formatFeedDate(item.created_at)}
                  </div>
                </div>

                {/* Body Content */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {item.kind === 'patch' ? (
                      <Music size={13} className="text-amber-500" />
                    ) : (
                      <Disc size={13} className="text-amber-500" />
                    )}
                    <span className="text-[9px] uppercase tracking-widest text-stone-500 font-semibold">
                      Published {item.kind}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-stone-200">
                    {item.title || `Untitled ${item.kind}`}
                  </h3>

                  {item.description && (
                    <p className="text-xs text-stone-400 leading-relaxed">
                      {item.description}
                    </p>
                  )}

                  {item.kind === 'recording' && item.duration_ms && (
                    <div className="text-[9px] text-stone-500 uppercase tracking-widest mt-1">
                      Duration: {Math.round(item.duration_ms / 1000)}s &bull;
                      Format: {item.format}
                    </div>
                  )}
                </div>

                {/* Footer Controls & Social metrics */}
                <div className="flex items-center justify-between border-t border-stone-900/60 pt-3">
                  <LikeButton
                    targetKind={item.kind}
                    targetId={item.id}
                    initialLiked={item.liked_by_me}
                    initialCount={item.like_count}
                  />

                  {item.kind === 'patch' ? (
                    <Link
                      to={`/p/${item.short_slug}`}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[9px] uppercase tracking-wider font-semibold border border-amber-500/30 text-amber-500 bg-amber-500/5 hover:bg-amber-500/10 transition-all"
                    >
                      <span>Load Patch</span>
                      <ChevronRight size={10} />
                    </Link>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          if (playingRecordingId === item.id) {
                            setPlayingRecordingId(null);
                          } else {
                            setPlayingRecordingId(item.id);
                          }
                        }}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[9px] uppercase tracking-wider font-semibold border border-stone-700 text-stone-300 hover:text-white bg-stone-950/60 hover:bg-stone-900 transition-all"
                      >
                        {playingRecordingId === item.id ? (
                          <>
                            <Square size={10} className="fill-current" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Play size={10} className="fill-current" />
                            <span>Play</span>
                          </>
                        )}
                      </button>

                      {playingRecordingId === item.id && (
                        <audio
                          autoPlay
                          src={api.recordingAudioUrl(item.short_slug)}
                          onEnded={() => setPlayingRecordingId(null)}
                          onError={() => setPlayingRecordingId(null)}
                          className="hidden"
                        />
                      )}
                    </>
                  )}
                </div>
              </article>
            ))}

            {/* Keyset Infinite scroll load button */}
            {cursor && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="rounded-full px-6 py-2 border border-stone-800 text-[9px] uppercase tracking-widest font-semibold text-stone-400 hover:text-stone-200 hover:border-stone-700 transition-all flex items-center gap-2"
                >
                  {loadingMore && (
                    <Loader2 className="animate-spin" size={10} />
                  )}
                  <span>Load Older Updates</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
