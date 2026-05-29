import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';

interface LikeButtonProps {
  targetKind: 'patch' | 'recording';
  targetId: string;
  initialLiked: boolean;
  initialCount: number;
  size?: number;
}

export const LikeButton: React.FC<LikeButtonProps> = ({
  targetKind,
  targetId,
  initialLiked,
  initialCount,
  size = 16,
}) => {
  const { account } = useAuth();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    const prevLiked = liked;
    const newLiked = !prevLiked;

    // Optimistic UI updates
    setLiked(newLiked);
    setCount((prev) => Math.max(0, prev + (newLiked ? 1 : -1)));
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    // If anonymous, display the calm sign-in reminder tooltip
    if (!account && newLiked) {
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 4000);
    }

    setDisabled(true);
    try {
      if (newLiked) {
        await api.like(targetKind, targetId);
      } else {
        await api.unlike(targetKind, targetId);
      }
    } catch (err) {
      console.error('Failed to update like status:', err);
      // Revert optimistic updates on failure
      setLiked(prevLiked);
      setCount((prev) => Math.max(0, prev + (prevLiked ? 1 : -1)));
    } finally {
      setDisabled(false);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={handleLike}
        disabled={disabled}
        aria-label={liked ? 'Unlike' : 'Like'}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] tracking-wide font-mono transition-all duration-300 ${
          liked
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20'
            : 'bg-stone-900/50 border-stone-800 text-stone-400 hover:text-stone-300 hover:bg-stone-850/60'
        } border`}
      >
        <Heart
          size={size}
          className={`transition-transform duration-300 ${
            isAnimating
              ? 'scale-150 fill-current'
              : liked
                ? 'fill-current scale-100'
                : 'scale-100'
          }`}
        />
        <span>{count}</span>
      </button>

      {/* Guest user reminder tooltip */}
      {showTooltip && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 rounded-lg border p-2 text-center text-[9px] uppercase tracking-wider leading-relaxed shadow-xl animate-fade-in z-50 font-mono"
          style={{
            background: 'rgba(12, 10, 9, 0.95)',
            borderColor: '#44403c',
            color: '#fef3c7',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span className="block mb-1 text-amber-400 font-semibold">
            Like Saved!
          </span>
          Sign in to preserve liked patches across all your devices.
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r border-b"
            style={{
              background: '#0c0a09',
              borderColor: '#44403c',
            }}
          />
        </div>
      )}
    </div>
  );
};
