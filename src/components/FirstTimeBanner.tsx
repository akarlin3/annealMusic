/**
 * v6.5 — a single, dismissable first-time-user line inviting new users into the
 * intro lesson. Calm-by-design: one quiet line, opens /learn in a new tab,
 * dismissal persists forever (localStorage), suppressed entirely when the user
 * has hidden learning hints. No recurring nag, no countdown, no modal.
 */
import {
  INTRO_LESSON,
  lessonHref,
  useFirstTimeBanner,
} from '@/components/lessonHints';

export default function FirstTimeBanner() {
  const { show, dismiss } = useFirstTimeBanner();
  if (!show) return null;

  return (
    <div
      className="mb-6 flex items-center justify-between gap-3 rounded-md px-3 py-2"
      style={{
        border: '1px solid #292524',
        background: 'rgba(245,158,11,0.04)',
      }}
    >
      <p className="font-body text-sm" style={{ color: '#a8a29e' }}>
        New to AnnealMusic?{' '}
        <a
          href={lessonHref(INTRO_LESSON)}
          target="_blank"
          rel="noopener noreferrer"
          className="lesson-hint-link"
        >
          Start with the intro lesson →
        </a>
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="font-mono text-[11px] uppercase tracking-[0.18em]"
        style={{ color: '#78716c' }}
      >
        Dismiss
      </button>
    </div>
  );
}
