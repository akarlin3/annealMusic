import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { LissajousAvatar } from '@/components/LissajousAvatar';
import { LikeButton } from '@/components/social/LikeButton';
import { FollowButton } from '@/components/social/FollowButton';
import { BlockMuteMenu } from '@/components/social/BlockMuteMenu';
import { api, getErrorMessage } from '@/api/client';
import type { PublicProfile, Patch, Recording } from '@/api/types';
import {
  ArrowLeft,
  Calendar,
  Disc,
  Heart,
  Music,
  Play,
  Square,
  ChevronRight,
  Loader2,
} from 'lucide-react';

type TabType = 'patches' | 'recordings' | 'liked';

export default function ProfilePage() {
  const { account_id } = useParams<{ account_id: string }>();
  const navigate = useNavigate();
  const { account: currentUser, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>('patches');
  const [patches, setPatches] = useState<Patch[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [likedPatches, setLikedPatches] = useState<Patch[]>([]);
  const [loadingTabContent, setLoadingTabContent] = useState(false);
  const [tabCursor, setTabCursor] = useState<string | null>(null);

  // Audio Playback State for recordings and patches
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(
    null,
  );

  const isSelf = currentUser && currentUser.id === account_id;

  // Fetch Profile Metadata
  const fetchProfile = async () => {
    if (!account_id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPublicProfile(account_id);
      setProfile(res);
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError(getErrorMessage(err, 'Profile not found.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // Reset active tab and lists on profile change
    setActiveTab('patches');
    setPatches([]);
    setRecordings([]);
    setLikedPatches([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account_id]);

  // Fetch Tab Content
  useEffect(() => {
    if (!account_id || !profile) return;

    const fetchTabContent = async () => {
      setLoadingTabContent(true);
      try {
        if (activeTab === 'patches') {
          const res = await api.getProfilePatches(account_id);
          setPatches(res.items);
          setTabCursor(res.next_cursor);
        } else if (activeTab === 'recordings') {
          const res = await api.getProfileRecordings(account_id);
          setRecordings(res.items);
          setTabCursor(null);
        } else if (activeTab === 'liked') {
          if (profile.likes_public || isSelf) {
            const res = await api.getProfileLiked(account_id);
            setLikedPatches(res.items);
            setTabCursor(res.next_cursor);
          } else {
            setLikedPatches([]);
            setTabCursor(null);
          }
        }
      } catch (err) {
        console.error(`Failed to load ${activeTab}:`, err);
      } finally {
        setLoadingTabContent(false);
      }
    };

    fetchTabContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account_id, activeTab, profile, isSelf]);

  // Pagination Load More
  const handleLoadMore = async () => {
    if (!account_id || !tabCursor || loadingTabContent) return;

    setLoadingTabContent(true);
    try {
      if (activeTab === 'patches') {
        const res = await api.getProfilePatches(account_id, tabCursor);
        setPatches((prev) => [...prev, ...res.items]);
        setTabCursor(res.next_cursor);
      } else if (activeTab === 'liked') {
        const res = await api.getProfileLiked(account_id, tabCursor);
        setLikedPatches((prev) => [...prev, ...res.items]);
        setTabCursor(res.next_cursor);
      }
    } catch (err) {
      console.error('Failed to load more:', err);
    } finally {
      setLoadingTabContent(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center font-mono"
        style={{ background: '#0c0a09', color: '#fef3c7' }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-amber-500" size={24} />
          <span className="text-[10px] uppercase tracking-widest text-stone-500">
            Loading profile...
          </span>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center font-mono px-6"
        style={{ background: '#0c0a09', color: '#f5f5f4' }}
      >
        <div
          className="w-full max-w-md rounded-xl p-6 border text-center space-y-4"
          style={{ background: '#141210', borderColor: '#292524' }}
        >
          <h2 className="text-[11px] uppercase tracking-widest text-red-400">
            Profile Error
          </h2>
          <p className="text-xs text-stone-400">
            {error ?? 'Profile could not be resolved.'}
          </p>
          <Link
            to="/"
            className="inline-block rounded px-4 py-2 text-[9px] uppercase tracking-widest font-semibold transition-all hover:opacity-90"
            style={{ background: '#f59e0b', color: '#0c0a09' }}
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const registrationDate = new Date(profile.created_at).toLocaleDateString(
    undefined,
    {
      year: 'numeric',
      month: 'long',
    },
  );

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: '#0c0a09', color: '#f5f5f4' }}
    >
      <div className="mx-auto max-w-xl px-6 py-12 font-mono">
        <header className="mb-8 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-stone-500 hover:text-stone-300 transition-colors"
          >
            <ArrowLeft size={10} />
            Sandbox
          </Link>

          {isAuthenticated && !isSelf && (
            <BlockMuteMenu
              accountId={profile.id}
              accountName={profile.display_name ?? 'Anonymous Sculptor'}
              onBlockedStatusChange={(blocked) => {
                if (blocked) {
                  // Direct back home if blocked to respect the invisibility paradigm
                  navigate('/');
                }
              }}
            />
          )}
        </header>

        <div className="flex flex-col items-center text-center space-y-6">
          {/* Avatar Container */}
          <div className="relative">
            <LissajousAvatar
              seed={profile.avatar_seed ?? 'default'}
              size={120}
            />
          </div>

          {/* Profile Name & Follow Action */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
              <h1 className="text-xl font-bold tracking-tight text-stone-100">
                {profile.display_name ?? 'Anonymous Sculptor'}
              </h1>
              {isAuthenticated && !isSelf && (
                <FollowButton
                  accountId={profile.id}
                  initialFollowing={profile.following}
                  onStatusChange={(following) => {
                    setProfile((prev) =>
                      prev
                        ? {
                            ...prev,
                            follower_count:
                              prev.follower_count + (following ? 1 : -1),
                            following: following,
                          }
                        : null,
                    );
                  }}
                />
              )}
            </div>

            <div className="flex items-center justify-center gap-4 text-[9px] uppercase tracking-widest text-stone-500">
              <div className="flex items-center gap-1">
                <Calendar size={10} />
                <span>Since {registrationDate}</span>
              </div>
              <div className="flex items-center gap-3">
                <span>{profile.follower_count} Followers</span>
                <span className="w-1 h-1 rounded-full bg-stone-700" />
                <span>{profile.following_count} Following</span>
              </div>
            </div>
          </div>

          {/* Profile Bio */}
          {profile.bio && (
            <p className="text-xs text-stone-400 max-w-sm border-l border-amber-500/20 pl-4 py-1 italic leading-relaxed text-left">
              {profile.bio}
            </p>
          )}

          {isSelf && (
            <Link
              to="/account"
              className="rounded-full px-4 py-1.5 border text-[9px] uppercase tracking-[0.2em] font-semibold text-stone-400 hover:text-white hover:border-stone-700 hover:bg-stone-900/40 transition-all"
              style={{ borderColor: '#292524' }}
            >
              Edit Profile
            </Link>
          )}

          <div className="w-full border-t border-stone-900 my-4" />

          {/* Stats Bar / Tab Switchers */}
          <div className="flex justify-center w-full gap-2 text-[10px] uppercase tracking-widest">
            <button
              onClick={() => setActiveTab('patches')}
              className={`flex items-center gap-1.5 px-4 py-2 border-b-2 transition-all ${
                activeTab === 'patches'
                  ? 'border-amber-500 text-stone-200'
                  : 'border-transparent text-stone-500 hover:text-stone-400'
              }`}
            >
              <Music size={12} />
              <span>Patches ({profile.counts.patches})</span>
            </button>

            <button
              onClick={() => setActiveTab('recordings')}
              className={`flex items-center gap-1.5 px-4 py-2 border-b-2 transition-all ${
                activeTab === 'recordings'
                  ? 'border-amber-500 text-stone-200'
                  : 'border-transparent text-stone-500 hover:text-stone-400'
              }`}
            >
              <Disc size={12} />
              <span>Recordings ({profile.counts.recordings})</span>
            </button>

            {(profile.likes_public || isSelf) && (
              <button
                onClick={() => setActiveTab('liked')}
                className={`flex items-center gap-1.5 px-4 py-2 border-b-2 transition-all ${
                  activeTab === 'liked'
                    ? 'border-amber-500 text-stone-200'
                    : 'border-transparent text-stone-500 hover:text-stone-400'
                }`}
              >
                <Heart size={12} />
                <span>Liked</span>
              </button>
            )}
          </div>

          {/* Tab Content Rendering */}
          <div className="w-full text-left mt-6">
            {loadingTabContent &&
            patches.length === 0 &&
            recordings.length === 0 &&
            likedPatches.length === 0 ? (
              <div className="flex items-center justify-center py-12 gap-2 text-stone-500">
                <Loader2 className="animate-spin" size={14} />
                <span className="text-[10px] uppercase tracking-widest">
                  Hydrating Tab...
                </span>
              </div>
            ) : (
              <>
                {/* Patches Grid */}
                {activeTab === 'patches' && (
                  <div className="space-y-4">
                    {patches.length === 0 ? (
                      <p className="text-center py-12 text-[10px] uppercase tracking-wider text-stone-600">
                        No public patches found.
                      </p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-1">
                        {patches.map((p) => (
                          <div
                            key={p.id}
                            className="rounded-xl border border-stone-850 p-4 hover:border-stone-700 bg-stone-900/30 flex flex-col justify-between gap-4 transition-all"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <Link
                                  to={`/p/${p.short_slug}`}
                                  className="text-sm font-semibold text-stone-200 hover:text-amber-400 transition-colors"
                                >
                                  {p.title || 'Untitled Patch'}
                                </Link>
                                <span className="text-[8px] uppercase tracking-wider bg-stone-950 px-2 py-0.5 border border-stone-800 text-stone-500 rounded">
                                  v{p.schema_ver}
                                </span>
                              </div>
                              {p.description && (
                                <p className="text-xs text-stone-400 mt-1.5 leading-normal">
                                  {p.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-stone-900">
                              <LikeButton
                                targetKind="patch"
                                targetId={p.id}
                                initialLiked={
                                  (p as unknown as { liked_by_me?: boolean })
                                    .liked_by_me ?? false
                                }
                                initialCount={
                                  (p as unknown as { like_count?: number })
                                    .like_count ?? 0
                                }
                              />
                              <Link
                                to={`/p/${p.short_slug}`}
                                className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-semibold text-amber-500 hover:text-amber-400 transition-colors"
                              >
                                <span>Load</span>
                                <ChevronRight size={10} />
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Recordings Tab */}
                {activeTab === 'recordings' && (
                  <div className="space-y-4">
                    {recordings.length === 0 ? (
                      <p className="text-center py-12 text-[10px] uppercase tracking-wider text-stone-600">
                        No public recordings found.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {recordings.map((r) => {
                          const isPlaying = playingRecordingId === r.id;
                          return (
                            <div
                              key={r.id}
                              className="rounded-xl border border-stone-850 p-4 bg-stone-900/30 hover:border-stone-700 flex items-center justify-between gap-4 transition-all"
                            >
                              <div className="flex-1 space-y-1">
                                <div className="text-sm font-semibold text-stone-200">
                                  {r.title || 'Untitled Recording'}
                                </div>
                                <div className="text-[9px] text-stone-500 uppercase tracking-widest flex items-center gap-3">
                                  <span>
                                    {Math.round(r.duration_ms / 1000)}s
                                  </span>
                                  <span className="w-1 h-1 rounded-full bg-stone-800" />
                                  <span>{r.format}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <LikeButton
                                  targetKind="recording"
                                  targetId={r.id}
                                  initialLiked={
                                    (r as unknown as { liked_by_me?: boolean })
                                      .liked_by_me ?? false
                                  }
                                  initialCount={
                                    (r as unknown as { like_count?: number })
                                      .like_count ?? 0
                                  }
                                />

                                <button
                                  onClick={() => {
                                    if (isPlaying) {
                                      setPlayingRecordingId(null);
                                    } else {
                                      setPlayingRecordingId(r.id);
                                    }
                                  }}
                                  className="p-2 rounded-full border border-stone-800 text-stone-300 hover:text-white bg-stone-950/60 hover:bg-stone-900 hover:border-stone-700 transition-all"
                                  aria-label={isPlaying ? 'Pause' : 'Play'}
                                >
                                  {isPlaying ? (
                                    <Square
                                      size={12}
                                      className="fill-current"
                                    />
                                  ) : (
                                    <Play size={12} className="fill-current" />
                                  )}
                                </button>
                              </div>

                              {isPlaying && (
                                <audio
                                  autoPlay
                                  src={api.recordingAudioUrl(r.short_slug)}
                                  onEnded={() => setPlayingRecordingId(null)}
                                  onError={() => setPlayingRecordingId(null)}
                                  className="hidden"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Liked Patches Tab */}
                {activeTab === 'liked' && (
                  <div className="space-y-4">
                    {likedPatches.length === 0 ? (
                      <p className="text-center py-12 text-[10px] uppercase tracking-wider text-stone-600">
                        No liked patches found.
                      </p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-1">
                        {likedPatches.map((p) => (
                          <div
                            key={p.id}
                            className="rounded-xl border border-stone-850 p-4 hover:border-stone-700 bg-stone-900/30 flex flex-col justify-between gap-4 transition-all"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <Link
                                  to={`/p/${p.short_slug}`}
                                  className="text-sm font-semibold text-stone-200 hover:text-amber-400 transition-colors"
                                >
                                  {p.title || 'Untitled Patch'}
                                </Link>
                                <span className="text-[8px] uppercase tracking-wider bg-stone-950 px-2 py-0.5 border border-stone-800 text-stone-500 rounded">
                                  v{p.schema_ver}
                                </span>
                              </div>
                              {p.description && (
                                <p className="text-xs text-stone-400 mt-1.5 leading-normal">
                                  {p.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-stone-900">
                              <LikeButton
                                targetKind="patch"
                                targetId={p.id}
                                initialLiked={true} // Since it's from liked patches list, initially liked is true
                                initialCount={
                                  (p as unknown as { like_count?: number })
                                    .like_count ?? 0
                                }
                              />
                              <Link
                                to={`/p/${p.short_slug}`}
                                className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-semibold text-amber-500 hover:text-amber-400 transition-colors"
                              >
                                <span>Load</span>
                                <ChevronRight size={10} />
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Cursor Pagination Button */}
                {tabCursor && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingTabContent}
                      className="rounded-full px-6 py-2 border border-stone-800 text-[9px] uppercase tracking-widest font-semibold text-stone-400 hover:text-stone-200 hover:border-stone-700 transition-all flex items-center gap-2"
                    >
                      {loadingTabContent && (
                        <Loader2 className="animate-spin" size={10} />
                      )}
                      <span>Load More</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
