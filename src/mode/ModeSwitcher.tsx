import { ComponentType, useEffect, useState } from 'react';
import { useMode } from './useMode';
import type { AppMode } from './types';
import { Wind, Music, FlaskConical } from 'lucide-react';

export function ModeSwitcher() {
  const { mode, setMode } = useMode();
  const [hoveredMode, setHoveredMode] = useState<AppMode | null>(null);

  // Global Shift+M listener to cycle modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'M' || e.key === 'm')) {
        // Prevent key typing inside inputs
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }

        e.preventDefault();

        // Cycle: meditation -> musician -> researcher -> meditation
        const modes: AppMode[] = ['meditation', 'musician', 'researcher'];
        const currentIdx = mode ? modes.indexOf(mode) : 1; // default to musician if null
        const nextMode = modes[(currentIdx + 1) % modes.length]!;

        void setMode(nextMode).then(() => {
          // Trigger hard redirect
          if (nextMode === 'researcher') {
            window.location.href = '/research.html';
          } else if (nextMode === 'meditation') {
            window.location.href = '/listen';
          } else {
            window.location.href = '/';
          }
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, setMode]);

  const handleModeClick = (targetMode: AppMode) => {
    if (mode === targetMode) return;
    void setMode(targetMode).then(() => {
      if (targetMode === 'researcher') {
        window.location.href = '/research.html';
      } else if (targetMode === 'meditation') {
        window.location.href = '/listen';
      } else {
        window.location.href = '/';
      }
    });
  };

  const modesConfig: {
    id: AppMode;
    label: string;
    shortLabel: string;
    icon: ComponentType<{
      size?: number;
      strokeWidth?: number;
      className?: string;
    }>;
  }[] = [
    { id: 'meditation', label: 'Meditation', shortLabel: 'FOCUS', icon: Wind },
    { id: 'musician', label: 'Musician', shortLabel: 'MUSIC', icon: Music },
    {
      id: 'researcher',
      label: 'Researcher',
      shortLabel: 'STATS',
      icon: FlaskConical,
    },
  ];

  return (
    <div className="relative flex items-center rounded-full p-1 border border-stone-800 bg-stone-950/60 backdrop-blur-md shadow-inner select-none">
      {/* Sliding background pill */}
      <div
        className="absolute top-1 bottom-1 rounded-full transition-all duration-300 ease-out bg-amber-500/10 border border-amber-500/20 shadow-md"
        style={{
          width: 'calc(33.333% - 5px)',
          left:
            mode === 'meditation'
              ? '4px'
              : mode === 'musician'
                ? '33.333%'
                : 'calc(66.666% - 3px)',
        }}
      />

      {modesConfig.map((m) => {
        const Icon = m.icon;
        const isActive = mode === m.id;
        const isHovered = hoveredMode === m.id;

        return (
          <button
            key={m.id}
            type="button"
            onClick={() => handleModeClick(m.id)}
            onMouseEnter={() => setHoveredMode(m.id)}
            onMouseLeave={() => setHoveredMode(null)}
            className={`relative flex flex-col items-center justify-center rounded-full px-4 py-2 text-stone-400 hover:text-stone-200 transition-all cursor-pointer`}
            style={{ width: '80px', height: '40px' }}
            title={m.label}
          >
            <Icon
              size={15}
              strokeWidth={isActive ? 2 : 1.5}
              className={`transition-all duration-200 ${
                isActive ? 'text-amber-400 scale-110' : 'text-stone-500'
              }`}
            />
            <span
              className={`text-[8px] font-mono uppercase tracking-[0.15em] mt-1 transition-all duration-200 ${
                isActive ? 'text-amber-400/90 font-medium' : 'text-stone-600'
              }`}
            >
              {m.shortLabel}
            </span>

            {/* Hover Tooltip Label */}
            {isHovered && !isActive && (
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-stone-900 border border-stone-850 text-stone-300 font-mono text-[9px] uppercase tracking-wider py-1 px-2.5 rounded shadow-lg whitespace-nowrap z-50 animate-fade-in">
                {m.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
