import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import {
  ABOUT_INTRO,
  EXPLAIN_GROUP_LABELS,
  EXPLAIN_GROUP_ORDER,
  explainByGroup,
} from '@/content/explanations';

interface HelpPanelProps {
  onClose: () => void;
  /** Start the first-run walkthrough again. */
  onReplayTour: () => void;
}

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible "What is AnnealMusic?" modal. Lists every explanation grouped by
 * its `group` field, reading bodies from the single copy registry. Traps focus,
 * closes on ESC or backdrop click, and restores focus to the opener on close.
 */
export default function HelpPanel({ onClose, onReplayTour }: HelpPanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const items = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg"
        style={{ background: '#1c1917', border: '1px solid #44403c' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between gap-4 border-b p-5"
          style={{ borderColor: '#292524' }}
        >
          <div>
            <h2
              id="help-title"
              className="font-display text-2xl"
              style={{ color: '#fef3c7' }}
            >
              What is AnnealMusic?
            </h2>
            <p
              className="mt-2 max-w-xl text-[13px] leading-relaxed"
              style={{ color: '#a8a29e' }}
            >
              {ABOUT_INTRO}
            </p>
            <button
              type="button"
              onClick={onReplayTour}
              className="mt-3 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-all"
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid #44403c',
                color: '#fef3c7',
              }}
            >
              Replay tour
            </button>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close help"
            onClick={onClose}
            className="rounded-full p-2 transition-all"
            style={{ border: '1px solid #44403c', color: '#a8a29e' }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {EXPLAIN_GROUP_ORDER.map((group) => {
            const entries = explainByGroup(group);
            if (entries.length === 0) return null;
            return (
              <section key={group} className="mb-7 last:mb-0">
                <h3
                  className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em]"
                  style={{ color: '#78716c' }}
                >
                  {EXPLAIN_GROUP_LABELS[group]}
                </h3>
                <dl className="space-y-3">
                  {entries.map((entry) => (
                    <div key={entry.id}>
                      <dt
                        className="text-[13px] font-medium"
                        style={{ color: '#d6d3d1' }}
                      >
                        {entry.label}
                      </dt>
                      <dd
                        className="mt-0.5 text-[12px] leading-relaxed"
                        style={{ color: '#a8a29e' }}
                      >
                        {entry.help}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
