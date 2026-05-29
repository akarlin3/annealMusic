import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { getAnonId } from '@/api/anon';
import { api, getErrorMessage } from '@/api/client';
import { ShieldAlert, ArrowRight, X } from 'lucide-react';

interface ClaimBannerProps {
  showToast: (msg: string) => void;
  onRefreshLists?: () => void;
}

export default function ClaimBanner({
  showToast,
  onRefreshLists,
}: ClaimBannerProps) {
  const { account, claimCurrentDevice, refreshSession } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!account || dismissed) {
      setIsVisible(false);
      return;
    }

    const checkClaimStatus = async () => {
      const anonId = getAnonId();
      if (!anonId) return;

      try {
        // Fetch current guest user info to see if there is any local content
        const me = await api.me();
        const hasContent =
          me.user.patch_count > 0 ||
          me.user.recording_count > 0 ||
          me.user.source_count > 0;

        if (!hasContent) {
          setIsVisible(false);
          return;
        }

        // Fetch claimed anon IDs to see if this guest ID is already claimed
        const claimed = await api.listClaimedAnonIds();
        const isAlreadyClaimed = claimed.some((c) => c.anon_id === anonId);

        setIsVisible(!isAlreadyClaimed);
      } catch (err) {
        console.error('Failed to check claim status:', err);
      }
    };

    checkClaimStatus();
  }, [account, dismissed]);

  const handleClaim = async () => {
    setLoading(true);
    try {
      await claimCurrentDevice();
      showToast('Content successfully claimed');
      setIsVisible(false);

      // Refresh AuthProvider session and any active lists in the UI
      await refreshSession();
      if (onRefreshLists) {
        onRefreshLists();
      }
    } catch (err) {
      console.error('Claim failed:', err);
      const msg = getErrorMessage(err, 'Failed to claim content.');
      showToast(`Claim failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-40 max-w-sm rounded-xl p-4 font-mono shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-5"
      style={{
        background: 'rgba(12, 10, 9, 0.95)',
        border: '1px solid #f59e0b',
        boxShadow: '0 20px 40px -15px rgba(245, 158, 11, 0.15)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="p-1 rounded-lg bg-amber-500/10 text-amber-500 mt-0.5">
          <ShieldAlert size={16} />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] uppercase tracking-[0.2em] font-semibold text-amber-400">
              Sync Local Patches
            </h4>
            <button
              onClick={() => setDismissed(true)}
              className="text-stone-500 hover:text-stone-300 transition-colors"
              aria-label="Dismiss banner"
            >
              <X size={12} />
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-stone-300">
            You have local patches or recordings created on this device. Claim
            them to sync across your devices and link them permanently to your
            account.
          </p>
          <button
            onClick={handleClaim}
            disabled={loading}
            className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[9px] uppercase tracking-wider font-semibold transition-all hover:opacity-90 disabled:opacity-50"
            style={{
              background: '#f59e0b',
              color: '#0c0a09',
            }}
          >
            {loading ? 'Syncing...' : 'Claim & Sync Content'}
            <ArrowRight size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}
