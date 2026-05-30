import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useParamStore } from '@/state/params';

export type CreativeMode = 'sketch' | 'compose' | 'drone';

interface ModeToggleProps {
  disabled?: boolean;
}

const MODES: { id: CreativeMode; label: string; description: string }[] = [
  {
    id: 'sketch',
    label: 'Sketch',
    description:
      'Freely sculpt endless generative ambient soundscapes in real time.',
  },
  {
    id: 'compose',
    label: 'Compose',
    description:
      'Compose multi-movement linear pieces and timeline arrangements.',
  },
  {
    id: 'drone',
    label: 'Drone',
    description:
      'Immersive meditation drone: a single sustained fundamental and chosen tuning.',
  },
];

/**
 * Segmented control for the top-level creative mode (Sketch / Compose / Drone).
 * Handles React Router navigation to Piece Editor and local param store mode state.
 */
export default function ModeToggle({ disabled = false }: ModeToggleProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const uiMode = useParamStore((s) => s.mode);
  const setUiMode = useParamStore((s) => s.setMode);

  // If on piece editor page, active mode is 'compose'
  // Otherwise, active mode is based on store state (sketch or drone)
  const currentMode: CreativeMode = location.pathname.startsWith('/piece')
    ? 'compose'
    : uiMode;

  const handleModeChange = useCallback(
    (newMode: CreativeMode) => {
      if (disabled) return;
      if (newMode === 'compose') {
        navigate('/piece');
      } else {
        setUiMode(newMode);
        if (location.pathname !== '/') {
          navigate('/');
        }
      }
    },
    [navigate, setUiMode, location.pathname, disabled],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const nextMap: Record<CreativeMode, CreativeMode> = {
          sketch: 'compose',
          compose: 'drone',
          drone: 'sketch',
        };
        handleModeChange(nextMap[currentMode]);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prevMap: Record<CreativeMode, CreativeMode> = {
          sketch: 'drone',
          compose: 'sketch',
          drone: 'compose',
        };
        handleModeChange(prevMap[currentMode]);
      }
    },
    [currentMode, handleModeChange, disabled],
  );

  return (
    <div
      role="radiogroup"
      aria-label="Creative mode"
      onKeyDown={onKeyDown}
      className="inline-flex items-center gap-1 rounded-full p-1"
      style={{
        background: 'rgba(245, 158, 11, 0.04)',
        border: '1px solid #1c1917',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {MODES.map(({ id, label, description }) => {
        const active = id === currentMode;
        return (
          <div key={id} className="relative group">
            <button
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              disabled={disabled}
              onClick={() => handleModeChange(id)}
              aria-describedby={`tooltip-top-mode-${id}`}
              className="rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-all hover:text-[#fef3c7] focus-visible:text-[#fef3c7] outline-none"
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
              id={`tooltip-top-mode-${id}`}
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
