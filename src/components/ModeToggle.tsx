import { useCallback } from 'react';
import type { SessionMode } from '@/session/types';

interface ModeToggleProps {
  mode: SessionMode;
  setMode: (mode: SessionMode) => void;
  disabled?: boolean;
}

const MODES: { id: SessionMode; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'arc', label: 'Arc' },
];

/**
 * Segmented control for the session mode (Open / Arc), styled to match the
 * engine selector. Disabled while a session is active (mode can't change mid-run).
 */
export default function ModeToggle({
  mode,
  setMode,
  disabled = false,
}: ModeToggleProps) {
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (
        e.key === 'ArrowRight' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown'
      ) {
        e.preventDefault();
        setMode(mode === 'open' ? 'arc' : 'open');
      }
    },
    [mode, setMode, disabled],
  );

  return (
    <div
      role="radiogroup"
      aria-label="Session mode"
      onKeyDown={onKeyDown}
      className="inline-flex items-center gap-1 rounded-full p-1"
      style={{
        background: 'rgba(245, 158, 11, 0.04)',
        border: '1px solid #1c1917',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {MODES.map(({ id, label }) => {
        const active = id === mode;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            onClick={() => setMode(id)}
            className="rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-all"
            style={{
              background: active ? '#f59e0b' : 'transparent',
              color: active ? '#0c0a09' : '#78716c',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
