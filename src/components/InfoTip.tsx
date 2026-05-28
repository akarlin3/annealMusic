import { useEffect, useId, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { getExplain } from '@/content/explanations';

interface InfoTipProps {
  /** Explanation id (matches a control-schema key, engine id, or feature id). */
  id: string;
  /** Optional override label for the accessible name (defaults to the entry label). */
  label?: string;
  /** Icon size in px. */
  size?: number;
}

/**
 * Accessible per-control info button. Reads its tooltip text from the single
 * copy registry (`getExplain(id).tooltip`) — never an inline string. Opens on
 * hover and on keyboard focus; on touch, a tap toggles it. ESC or an outside
 * tap closes it. The open animation is suppressed under `prefers-reduced-motion`.
 *
 * The tooltip body is always rendered (visually hidden when closed) so the
 * `aria-describedby` association is stable for assistive tech.
 */
export default function InfoTip({ id, label, size = 12 }: InfoTipProps) {
  const entry = getExplain(id);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (e: PointerEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  if (!entry) return null;

  const accessibleName = `What is ${label ?? entry.label}?`;

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={accessibleName}
        aria-describedby={tipId}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center justify-center rounded-full motion-safe:transition-colors"
        style={{ color: open ? '#fbbf24' : '#57534e', lineHeight: 0 }}
      >
        <HelpCircle size={size} strokeWidth={1.5} />
      </button>
      <span
        id={tipId}
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 rounded-md px-3 py-2 text-[12px] leading-snug motion-safe:transition-opacity ${
          open ? 'opacity-100' : 'sr-only opacity-0'
        }`}
        style={
          open
            ? {
                background: '#1c1917',
                border: '1px solid #44403c',
                color: '#d6d3d1',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }
            : undefined
        }
      >
        {entry.tooltip}
      </span>
    </span>
  );
}
