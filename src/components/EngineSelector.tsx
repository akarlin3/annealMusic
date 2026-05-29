import { useCallback } from 'react';
import { ENGINE_LABELS, ENGINE_ORDER } from '@/audio/engines/index';
import type { EngineId } from '@/audio/engines/types';

interface EngineSelectorProps {
  engineId: EngineId;
  setEngine: (id: EngineId) => void;
  disabled?: boolean;
}

const ENGINE_DESCRIPTIONS: Record<EngineId, string> = {
  sine: 'Organic coupled oscillators drifting over a harmonic lattice. Frequencies dynamically lock and phase-couple.',
  fm: 'Frequency modulation with operator self-feedback. Produces metallic, glass-like, and harmonically rich timbres.',
  granular:
    'Splices acoustic and synthetic source files into micro-grains. Generates lush, atmospheric, and cloud-like textures.',
  physical:
    'Digital waveguides and modal resonators (string, tube, plate, membrane, bowed, mallet, edge, bell) excited continuously. Recreates acoustic instrument physics.',
  pulse: 'Percussive physical resonators excited by brief noise bursts. Synthesizes tempo-locked acoustic ticks, clicks, and bells.',
};

/**
 * Segmented control for picking the active synthesis engine. Selecting a
 * segment dispatches an engine change (the orchestrator crossfades if playing).
 * Implemented as an ARIA radiogroup with arrow-key navigation. Disabled while an
 * arc is running (engine swaps are out of scope mid-arc).
 */
export default function EngineSelector({
  engineId,
  setEngine,
  disabled = false,
}: EngineSelectorProps) {
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      const idx = ENGINE_ORDER.indexOf(engineId);
      if (idx === -1) return;
      let nextIdx = idx;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextIdx = (idx + 1) % ENGINE_ORDER.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        nextIdx = (idx - 1 + ENGINE_ORDER.length) % ENGINE_ORDER.length;
      } else {
        return;
      }
      e.preventDefault();
      const next = ENGINE_ORDER[nextIdx];
      if (next) setEngine(next);
    },
    [engineId, setEngine, disabled],
  );

  return (
    <div
      role="radiogroup"
      aria-label="Synthesis engine"
      onKeyDown={onKeyDown}
      className="inline-flex items-center gap-1 rounded-full p-1"
      style={{
        background: 'rgba(245, 158, 11, 0.04)',
        border: '1px solid #1c1917',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {ENGINE_ORDER.map((id) => {
        const active = id === engineId;
        const label = ENGINE_LABELS[id];
        const description = ENGINE_DESCRIPTIONS[id];
        return (
          <div key={id} className="relative group">
            <button
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              disabled={disabled}
              onClick={() => setEngine(id)}
              aria-describedby={`tooltip-engine-${id}`}
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
              id={`tooltip-engine-${id}`}
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-64 -translate-x-1/2 translate-y-1 scale-95 rounded-lg border border-[#292524] bg-[#0c0a09]/95 p-3 text-left font-body text-xs leading-relaxed text-[#e7e5e4] opacity-0 shadow-2xl backdrop-blur-md transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100 z-50"
            >
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#f59e0b] mb-1">
                {label} Engine
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
