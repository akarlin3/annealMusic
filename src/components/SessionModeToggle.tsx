import { useCallback } from 'react';
import type { SessionMode } from '@/session/types';

interface SessionModeToggleProps {
  mode: SessionMode;
  setMode: (mode: SessionMode) => void;
  disabled?: boolean;
}

const MODES: { id: SessionMode; label: string; description: string }[] = [
  {
    id: 'open',
    label: 'Open',
    description:
      'Press play and sculpt parameters dynamically in real time. The generative field drifts organically forever.',
  },
  {
    id: 'arc',
    label: 'Arc',
    description:
      'Runs a fixed-duration session over a scripted envelope (settle → deepen → return) to guide your meditation.',
  },
];

/**
 * Segmented control for the session mode (Open / Arc), styled to match the
 * engine selector. Disabled while a session is active (mode can't change mid-run).
 */
export default function SessionModeToggle({
  mode,
  setMode,
  disabled = false,
}: SessionModeToggleProps) {
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
      {MODES.map(({ id, label, description }) => {
        const active = id === mode;
        return (
          <div key={id} className="relative group">
            <button
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              disabled={disabled}
              onClick={() => setMode(id)}
              aria-describedby={`tooltip-session-mode-${id}`}
              className="rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] tracking-wider transition-all hover:text-[#fef3c7] focus-visible:text-[#fef3c7] outline-none"
              style={{
                background: active ? '#f59e0b' : 'transparent',
                color: active ? '#0c0a09' : undefined,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {label}
            </button>

            {/* Premium Tooltip */}
            <div
              id={`tooltip-session-mode-${id}`}
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-64 -translate-x-1/2 translate-y-1 scale-95 rounded-lg border border-[#292524] bg-[#0c0a09]/95 p-3 text-left font-body text-xs leading-relaxed text-[#e7e5e4] opacity-0 shadow-2xl backdrop-blur-md transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100 z-50"
            >
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#f59e0b] mb-1">
                {label} Mode
              </div>
              <div className="text-[#a8a29e]">{description}</div>
              <div className="absolute top-full left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-[#292524] bg-[#0c0a09]" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
