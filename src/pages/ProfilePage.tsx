import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { LissajousAvatar } from '@/components/LissajousAvatar';
import { api, getErrorMessage } from '@/api/client';
import type { PublicProfile } from '@/api/types';
import {
  ArrowLeft,
  Award,
  Music,
  Disc,
  RefreshCw,
  Calendar,
} from 'lucide-react';

export default function ProfilePage() {
  const { account_id } = useParams<{ account_id: string }>();
  const { account: currentUser } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

    fetchProfile();
  }, [account_id]);

  if (loading) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center font-mono"
        style={{ background: '#0c0a09', color: '#fef3c7' }}
      >
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-amber-500" size={24} />
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
            Back to Sandbox
          </Link>
        </div>
      </div>
    );
  }

  const isSelf = currentUser && currentUser.id === profile.id;
  const registrationDate = new Date(profile.created_at).toLocaleDateString(
    undefined,
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    },
  );

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: '#0c0a09', color: '#f5f5f4' }}
    >
      <div className="mx-auto max-w-xl px-6 py-16 font-mono">
        <header className="mb-10">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-stone-500 hover:text-stone-300 transition-colors"
          >
            <ArrowLeft size={10} />
            Sandbox
          </Link>
        </header>

        <div className="flex flex-col items-center text-center space-y-8">
          {/* Avatar Container */}
          <div className="relative">
            <LissajousAvatar
              seed={profile.avatar_seed ?? 'default'}
              size={144}
            />
            {isSelf && (
              <div
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-2.5 py-0.5 border text-[8px] uppercase tracking-widest font-semibold"
                style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  borderColor: '#f59e0b',
                  color: '#fef3c7',
                }}
              >
                <Award size={10} className="text-amber-500" />
                This is you
              </div>
            )}
          </div>

          {/* Profile Metadata */}
          <div className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-stone-100">
              {profile.display_name ?? 'Anonymous Sculptor'}
            </h1>
            <div className="flex items-center justify-center gap-1.5 text-[9px] uppercase tracking-widest text-stone-500">
              <Calendar size={10} />
              <span>Joined {registrationDate}</span>
            </div>
          </div>

          <div className="w-full border-t border-stone-900 my-4" />

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 w-full">
            <div
              className="p-4 rounded-xl border border-stone-850 flex flex-col items-center justify-center space-y-2"
              style={{ background: '#141210', borderColor: '#292524' }}
            >
              <Music size={16} className="text-amber-500" />
              <span className="text-2xl font-semibold text-stone-200">
                {profile.counts.patches}
              </span>
              <span className="text-[9px] uppercase tracking-widest text-stone-500">
                Public Patches
              </span>
            </div>

            <div
              className="p-4 rounded-xl border border-stone-850 flex flex-col items-center justify-center space-y-2"
              style={{ background: '#141210', borderColor: '#292524' }}
            >
              <Disc size={16} className="text-amber-500" />
              <span className="text-2xl font-semibold text-stone-200">
                {profile.counts.recordings}
              </span>
              <span className="text-[9px] uppercase tracking-widest text-stone-500">
                Public Recordings
              </span>
            </div>
          </div>

          {isSelf && (
            <Link
              to="/account"
              className="rounded-full px-5 py-2 border text-[9px] uppercase tracking-[0.2em] font-semibold text-stone-300 hover:text-white hover:border-stone-700 hover:bg-stone-950/20 transition-all"
              style={{ borderColor: '#44403c' }}
            >
              Edit Profile & Settings
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
