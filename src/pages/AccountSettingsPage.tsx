import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { LissajousAvatar } from '@/components/LissajousAvatar';
import { api, getErrorMessage } from '@/api/client';
import { getAnonId } from '@/api/anon';
import type { ClaimedAnonId } from '@/api/types';
import {
  ArrowLeft,
  User,
  Key,
  Shield,
  Trash2,
  RefreshCw,
  Unlink,
  Link2,
} from 'lucide-react';
import Toast, { type ToastMessage } from '@/components/Toast';

const fieldClass =
  'w-full rounded-md bg-transparent px-3 py-2 font-mono text-xs outline-none transition-all';
const fieldStyle = { border: '1px solid #44403c', color: '#f5f5f4' };

export default function AccountSettingsPage() {
  const {
    account,
    loading,
    logout,
    updateProfile,
    triggerOAuth,
    unclaimDevice,
    refreshSession,
  } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [providers, setProviders] = useState<string[]>([]);
  const [claimedDevices, setClaimedDevices] = useState<ClaimedAnonId[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);

  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [toastId, setToastId] = useState(0);

  const showToast = (text: string) => {
    setToastId((id) => id + 1);
    setToast({ id: toastId + 1, text });
  };

  useEffect(() => {
    if (!loading && !account) {
      navigate('/');
    }
  }, [account, loading, navigate]);

  const loadAccountData = useCallback(async () => {
    if (!account) return;
    setDisplayName(account.display_name ?? '');
    setAvatarSeed(account.avatar_seed ?? '');
    setLoadingClaims(true);
    try {
      const p = await api.getProviders();
      setProviders(p);
      const devices = await api.listClaimedAnonIds();
      setClaimedDevices(devices);
    } catch (err) {
      console.error('Failed to load settings data:', err);
    } finally {
      setLoadingClaims(false);
    }
  }, [account]);

  useEffect(() => {
    if (account) {
      void loadAccountData();
    }
  }, [account, loadAccountData]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    setProfileError(null);
    try {
      await updateProfile({
        display_name: displayName.trim() || undefined,
        avatar_seed: avatarSeed.trim() || undefined,
      });
      showToast('Profile updated');
    } catch (err) {
      setProfileError(getErrorMessage(err, 'Failed to update profile.'));
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleRollSeed = () => {
    const newSeed = Math.random().toString(36).substring(2, 15);
    setAvatarSeed(newSeed);
  };

  const handleUnlink = async (provider: 'email' | 'google' | 'github') => {
    if (providers.length <= 1) {
      showToast('Cannot unlink your last login credential');
      return;
    }
    try {
      await api.unlinkProvider(provider);
      showToast(`Unlinked ${provider}`);
      void loadAccountData();
    } catch (err) {
      showToast(getErrorMessage(err, `Failed to unlink ${provider}`));
    }
  };

  const handleUnclaim = async (anonId: string) => {
    try {
      await unclaimDevice(anonId);
      showToast('Device connection removed');
      await refreshSession();
      void loadAccountData();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to unclaim device.'));
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    if (confirmEmail.trim().toLowerCase() !== account.email.toLowerCase()) {
      setDeleteError('Confirmation email does not match.');
      return;
    }

    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteAccount(confirmEmail.trim());
      showToast('Account deleted');
      await logout();
      navigate('/');
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Failed to delete account.'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !account) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center font-mono"
        style={{ background: '#0c0a09', color: '#fef3c7' }}
      >
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-amber-500" size={24} />
          <span className="text-[10px] uppercase tracking-widest text-stone-500">
            Loading settings...
          </span>
        </div>
      </div>
    );
  }

  const currentAnonId = getAnonId();

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: '#0c0a09', color: '#f5f5f4' }}
    >
      <div className="mx-auto max-w-2xl px-6 py-12 font-mono">
        <header className="mb-10 flex items-center gap-4">
          <Link
            to="/"
            className="p-2 rounded-full border border-stone-800 hover:border-stone-700 hover:text-white transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1
              className="text-xl uppercase tracking-[0.2em]"
              style={{ color: '#fef3c7' }}
            >
              Account Settings
            </h1>
            <p className="text-[10px] uppercase tracking-wider text-stone-500 mt-1">
              Configure profile, logins, and claimed devices
            </p>
          </div>
        </header>

        <div className="space-y-8">
          {/* Section 1: Profile */}
          <section
            className="rounded-xl p-6 border border-stone-850"
            style={{ background: '#141210', borderColor: '#292524' }}
          >
            <div className="flex items-center gap-2 mb-6">
              <User size={14} className="text-amber-500" />
              <h2 className="text-[11px] uppercase tracking-[0.2em] font-semibold text-stone-200">
                User Profile
              </h2>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center gap-6 pb-4 border-b border-stone-900">
                <div className="flex flex-col items-center gap-2">
                  <LissajousAvatar
                    seed={avatarSeed || 'placeholder'}
                    size={96}
                  />
                  <button
                    type="button"
                    onClick={handleRollSeed}
                    className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-amber-500/80 hover:text-amber-400 font-semibold"
                  >
                    <RefreshCw size={10} />
                    Roll Avatar
                  </button>
                </div>
                <div className="flex-1 w-full space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[9px] uppercase tracking-wider text-stone-500">
                      Email Address (Verified)
                    </label>
                    <div className="text-xs text-stone-300 font-semibold">
                      {account.email}
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="avatar-seed-input"
                      className="mb-1.5 block text-[9px] uppercase tracking-wider text-stone-500"
                    >
                      Avatar Resonator Seed
                    </label>
                    <input
                      id="avatar-seed-input"
                      type="text"
                      value={avatarSeed}
                      onChange={(e) => setAvatarSeed(e.target.value)}
                      className={fieldClass}
                      style={fieldStyle}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="display-name-input"
                  className="mb-1.5 block text-[9px] uppercase tracking-wider text-stone-500"
                >
                  Display Name
                </label>
                <input
                  id="display-name-input"
                  type="text"
                  placeholder="Anonymous Sculptor"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={fieldClass}
                  style={fieldStyle}
                />
              </div>

              {profileError && (
                <div className="rounded px-3 py-2 text-[10px] uppercase text-red-400 bg-red-950/20 border border-red-900/30">
                  {profileError}
                </div>
              )}

              <button
                type="submit"
                disabled={updatingProfile}
                className="rounded px-4 py-2 text-[9px] uppercase tracking-widest font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: '#f59e0b', color: '#0c0a09' }}
              >
                {updatingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          </section>

          {/* Section 2: Logins & OAuth */}
          <section
            className="rounded-xl p-6 border border-stone-850"
            style={{ background: '#141210', borderColor: '#292524' }}
          >
            <div className="flex items-center gap-2 mb-6">
              <Key size={14} className="text-amber-500" />
              <h2 className="text-[11px] uppercase tracking-[0.2em] font-semibold text-stone-200">
                Connected Providers
              </h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-2.5 border-b border-stone-900">
                <span className="text-xs text-stone-300">
                  Email Magic Links
                </span>
                <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500">
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5 border-b border-stone-900">
                <span className="text-xs text-stone-300">Google OAuth</span>
                {providers.includes('google') ? (
                  <button
                    onClick={() => handleUnlink('google')}
                    className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-red-400 hover:text-red-300 font-semibold"
                  >
                    <Unlink size={11} />
                    Unlink
                  </button>
                ) : (
                  <button
                    onClick={() => triggerOAuth('google')}
                    className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-amber-500 hover:text-amber-400 font-semibold"
                  >
                    <Link2 size={11} />
                    Link Google
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between py-2.5">
                <span className="text-xs text-stone-300">GitHub OAuth</span>
                {providers.includes('github') ? (
                  <button
                    onClick={() => handleUnlink('github')}
                    className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-red-400 hover:text-red-300 font-semibold"
                  >
                    <Unlink size={11} />
                    Unlink
                  </button>
                ) : (
                  <button
                    onClick={() => triggerOAuth('github')}
                    className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-amber-500 hover:text-amber-400 font-semibold"
                  >
                    <Link2 size={11} />
                    Link GitHub
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Section 3: Claimed devices */}
          <section
            className="rounded-xl p-6 border border-stone-850"
            style={{ background: '#141210', borderColor: '#292524' }}
          >
            <div className="flex items-center gap-2 mb-6">
              <Shield size={14} className="text-amber-500" />
              <h2 className="text-[11px] uppercase tracking-[0.2em] font-semibold text-stone-200">
                Synced Devices & Guest Accounts
              </h2>
            </div>

            {loadingClaims ? (
              <div className="text-[10px] text-stone-500 uppercase py-4">
                Fetching devices...
              </div>
            ) : claimedDevices.length === 0 ? (
              <div className="text-[10px] text-stone-500 uppercase py-4">
                No claimed devices associated with this account.
              </div>
            ) : (
              <div className="space-y-4">
                {claimedDevices.map((dev) => {
                  const isCurrent = dev.anon_id === currentAnonId;
                  return (
                    <div
                      key={dev.anon_id}
                      className="p-4 rounded border border-stone-900 bg-stone-950/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-stone-300">
                            ID: {dev.anon_id.substring(0, 8)}...
                          </span>
                          {isCurrent && (
                            <span className="text-[8px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">
                              Current Device
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:flex sm:items-center gap-x-3 gap-y-1 text-[9px] uppercase text-stone-500 tracking-wider">
                          <span>Patches: {dev.patch_count}</span>
                          <span>Recordings: {dev.recording_count}</span>
                          <span>Sources: {dev.source_count}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUnclaim(dev.anon_id)}
                        className="text-[9px] uppercase tracking-wider font-semibold text-stone-500 hover:text-red-400 transition-colors"
                      >
                        Unclaim Device
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 4: Deletion panel */}
          <section className="rounded-xl p-6 border border-red-950/40 bg-red-950/5">
            <div className="flex items-center gap-2 mb-6">
              <Trash2 size={14} className="text-red-500" />
              <h2 className="text-[11px] uppercase tracking-[0.2em] font-semibold text-red-400">
                Danger Zone
              </h2>
            </div>

            <p className="text-xs text-stone-400 mb-6 leading-relaxed">
              Deleting your account is permanent. All claimed guest device
              connections will be unlinked, and your account database profile
              will be destroyed forever.
            </p>

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div>
                <label
                  htmlFor="confirm-email-input"
                  className="mb-1.5 block text-[9px] uppercase tracking-wider text-stone-500"
                >
                  Type{' '}
                  <span className="text-stone-300 font-semibold">
                    {account.email}
                  </span>{' '}
                  to confirm deletion
                </label>
                <input
                  id="confirm-email-input"
                  type="text"
                  placeholder={account.email}
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  className={fieldClass}
                  style={{ ...fieldStyle, borderColor: '#7f1d1d' }}
                />
              </div>

              {deleteError && (
                <div className="rounded px-3 py-2 text-[10px] uppercase text-red-400 bg-red-950/20 border border-red-900/30">
                  {deleteError}
                </div>
              )}

              <button
                type="submit"
                disabled={deleting || confirmEmail !== account.email}
                className="rounded px-4 py-2.5 text-[9px] uppercase tracking-widest font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: '#7f1d1d', color: '#fef2f2' }}
              >
                {deleting ? 'Deleting...' : 'Permanently Delete Account'}
              </button>
            </form>
          </section>
        </div>
      </div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
