import { useCallback } from 'react';
import { ENGINE_LABELS, ENGINE_ORDER } from '@/audio/engines/index';
import type { EngineId } from '@/audio/engines/types';

interface EngineSelectorProps {
  engineId: EngineId;
  setEngine: (id: EngineId) => void;
  disabled?: boolean;
}

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
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            onClick={() => setEngine(id)}
            className="rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-all"
            style={{
              background: active ? '#f59e0b' : 'transparent',
              color: active ? '#0c0a09' : '#78716c',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {ENGINE_LABELS[id]}
          </button>
        );
      })}
    </div>
  );
}
