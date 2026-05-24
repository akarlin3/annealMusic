import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AudioLines,
  CloudRain,
  Disc,
  Loader2,
  Piano,
  Radio,
  Sparkles,
  Waves,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { SOURCES, clampSourceIndex } from '@/audio/sources/registry';
import { isSourceCached } from '@/audio/sources/loader';

const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Disc,
  Piano,
  Wind,
  Waves,
  AudioLines,
  CloudRain,
  Radio,
};

interface SourcePickerProps {
  /** Selected source index (the `gr.source` value). */
  value: number;
  onChange: (index: number) => void;
  disabled?: boolean;
  /** When playing, a freshly-selected source shows a loading spinner. */
  isPlaying?: boolean;
}

/**
 * Card-grid picker for the granular source bank. An ARIA radiogroup (arrow-key
 * navigable, matching the engine selector) with one tile per source: a micro
 * icon + label, highlighted when active. Hovering/focusing a tile reveals its
 * description and license in a footer. While playing, a just-selected source
 * that isn't decoded yet shows a spinner until its buffer is cached.
 */
export default function SourcePicker({
  value,
  onChange,
  disabled = false,
  isPlaying = false,
}: SourcePickerProps) {
  const selected = clampSourceIndex(value);
  const [focusIdx, setFocusIdx] = useState(selected);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const footer = useMemo(
    () => SOURCES[focusIdx] ?? SOURCES[selected],
    [focusIdx, selected],
  );

  // While playing, poll the loader cache to clear the spinner once decoded.
  useEffect(() => {
    const def = SOURCES[selected];
    if (!def || !isPlaying || isSourceCached(def.id)) {
      setLoadingId(null);
      return;
    }
    setLoadingId(def.id);
    const timer = setInterval(() => {
      if (isSourceCached(def.id)) {
        setLoadingId(null);
        clearInterval(timer);
      }
    }, 120);
    const stop = setTimeout(() => {
      setLoadingId(null);
      clearInterval(timer);
    }, 8000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [selected, isPlaying]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      let next = focusIdx;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        next = (focusIdx + 1) % SOURCES.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        next = (focusIdx - 1 + SOURCES.length) % SOURCES.length;
      } else if (e.key === 'Enter' || e.key === ' ') {
        onChange(focusIdx);
        e.preventDefault();
        return;
      } else {
        return;
      }
      e.preventDefault();
      setFocusIdx(next);
    },
    [focusIdx, onChange, disabled],
  );

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Granular source"
        onKeyDown={onKeyDown}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        style={{ opacity: disabled ? 0.5 : 1 }}
      >
        {SOURCES.map((src, i) => {
          const active = i === selected;
          const Icon = ICONS[src.icon] ?? Disc;
          const loading = loadingId === src.id;
          return (
            <button
              key={src.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={src.label}
              tabIndex={i === focusIdx ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(i)}
              onFocus={() => setFocusIdx(i)}
              onMouseEnter={() => setFocusIdx(i)}
              className="relative flex flex-col items-center gap-1.5 rounded-lg px-2 py-3 transition-all"
              style={{
                background: active ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                border: `1px solid ${active ? '#f59e0b' : '#1c1917'}`,
                color: active ? '#fbbf24' : '#a8a29e',
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" aria-hidden />
              ) : (
                <Icon size={18} aria-hidden />
              )}
              <span className="text-center text-[11px] leading-tight">
                {src.label}
              </span>
            </button>
          );
        })}
      </div>

      {footer && (
        <div
          className="mt-3 flex items-baseline justify-between gap-3 font-mono text-[10px] leading-relaxed"
          style={{ color: '#78716c' }}
        >
          <span style={{ color: '#a8a29e' }}>{footer.description}</span>
          <span
            className="shrink-0 uppercase tracking-[0.14em]"
            title={footer.attribution ?? 'Original (synthesized)'}
          >
            {footer.license}
          </span>
        </div>
      )}
    </div>
  );
}
