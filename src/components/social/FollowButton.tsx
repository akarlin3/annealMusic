import React, { useState } from 'react';
import { UserPlus, UserMinus, RefreshCw } from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';

interface FollowButtonProps {
  accountId: string;
  initialFollowing: boolean;
  onStatusChange?: (following: boolean) => void;
  className?: string;
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  accountId,
  initialFollowing,
  onStatusChange,
  className = '',
}) => {
  const { account } = useAuth();
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const isSelf = account && account.id === accountId;

  if (isSelf) return null; // Can't follow oneself

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!account) {
      // Direct guest users to log in / sign up since follows require accounts.
      alert('Authentication required. Please sign in to follow creators.');
      return;
    }

    if (loading) return;

    setLoading(true);
    const prevFollowing = following;
    const nextFollowing = !prevFollowing;

    // Optimistic UI update
    setFollowing(nextFollowing);
    if (onStatusChange) onStatusChange(nextFollowing);

    try {
      if (nextFollowing) {
        await api.follow(accountId);
      } else {
        await api.unfollow(accountId);
      }
    } catch (err) {
      console.error('Failed to toggle follow status:', err);
      // Revert on error
      setFollowing(prevFollowing);
      if (onStatusChange) onStatusChange(prevFollowing);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleFollowToggle}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-mono text-[9px] uppercase tracking-widest font-semibold transition-all duration-200 border ${
        following
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20'
          : 'bg-stone-100 border-stone-200 text-stone-900 hover:bg-stone-200'
      } ${className}`}
    >
      {loading ? (
        <RefreshCw size={10} className="animate-spin" />
      ) : following ? (
        <UserMinus size={10} />
      ) : (
        <UserPlus size={10} />
      )}
      <span>{following ? 'Following' : 'Follow'}</span>
    </button>
  );
};
