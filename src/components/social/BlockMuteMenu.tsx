import React, { useState, useEffect, useRef } from 'react';
import { MoreHorizontal, ShieldAlert, EyeOff } from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';

interface BlockMuteMenuProps {
  accountId: string;
  accountName: string;
  initialBlocked?: boolean;
  initialMuted?: boolean;
  onBlockedStatusChange?: (blocked: boolean) => void;
  onMutedStatusChange?: (muted: boolean) => void;
  className?: string;
}

export const BlockMuteMenu: React.FC<BlockMuteMenuProps> = ({
  accountId,
  accountName,
  initialBlocked = false,
  initialMuted = false,
  onBlockedStatusChange,
  onMutedStatusChange,
  className = '',
}) => {
  const { account } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [muted, setMuted] = useState(initialMuted);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSelf = account && account.id === accountId;

  // Handle outside clicks to close the dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        isOpen &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  if (isSelf || !account) return null; // Guest or self shouldn't see relationship actions

  const toggleBlock = async () => {
    if (loading) return;
    setLoading(true);
    const nextBlocked = !blocked;
    setBlocked(nextBlocked);
    if (onBlockedStatusChange) onBlockedStatusChange(nextBlocked);
    setIsOpen(false);

    try {
      if (nextBlocked) {
        await api.block(accountId);
      } else {
        await api.unblock(accountId);
      }
    } catch (err) {
      console.error('Failed to block/unblock account:', err);
      // Revert on error
      setBlocked(!nextBlocked);
      if (onBlockedStatusChange) onBlockedStatusChange(!nextBlocked);
    } finally {
      setLoading(false);
    }
  };

  const toggleMute = async () => {
    if (loading) return;
    setLoading(true);
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (onMutedStatusChange) onMutedStatusChange(nextMuted);
    setIsOpen(false);

    try {
      if (nextMuted) {
        await api.mute(accountId);
      } else {
        await api.unmute(accountId);
      }
    } catch (err) {
      console.error('Failed to mute/unmute account:', err);
      // Revert on error
      setMuted(!nextMuted);
      if (onMutedStatusChange) onMutedStatusChange(!nextMuted);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative inline-block ${className}`} ref={menuRef}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        aria-label="Community actions menu"
        className="flex items-center justify-center rounded-full p-1.5 border border-stone-800 text-stone-500 hover:text-stone-300 bg-stone-900/40 hover:bg-stone-850/60 transition-all"
      >
        <MoreHorizontal size={14} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-48 rounded-xl border p-1 shadow-2xl z-40 font-mono text-[9px] uppercase tracking-wider animate-fade-in"
          style={{
            background: 'rgba(28, 25, 23, 0.95)',
            borderColor: '#44403c',
            backdropFilter: 'blur(8px)',
          }}
        >
          {/* Mute toggle button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleMute();
            }}
            className="flex items-center gap-2 w-full text-left rounded-lg px-3 py-2 text-stone-300 hover:text-stone-100 hover:bg-stone-800/50 transition-colors"
          >
            <EyeOff
              size={11}
              className={muted ? 'text-amber-500' : 'text-stone-500'}
            />
            <span>
              {muted ? `Unmute ${accountName}` : `Mute ${accountName}`}
            </span>
          </button>

          {/* Block toggle button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleBlock();
            }}
            className="flex items-center gap-2 w-full text-left rounded-lg px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-colors border-t border-stone-800/40"
          >
            <ShieldAlert
              size={11}
              className={blocked ? 'text-red-500' : 'text-red-400'}
            />
            <span>
              {blocked ? `Unblock ${accountName}` : `Block ${accountName}`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
