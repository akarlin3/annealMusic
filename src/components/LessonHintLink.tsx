/**
 * v6.5 — LessonHintLink: the one discoverability primitive used everywhere a
 * main-app surface wants to point at a relevant /learn lesson. Keeping it a
 * single component (rules of engagement: "lesson-hint primitive is one component
 * used everywhere") means the calm, understated styling and the opt-out gate
 * live in exactly one place.
 *
 * Calm-by-design: a hint is a quiet, optional invitation — never a nag. It
 * renders nothing when the user has hidden learning hints, opens the lesson in a
 * new tab (so it never interrupts what they're making), and carries no counts,
 * badges, or urgency.
 */
import { lessonHref, useShowLearningHints } from '@/components/lessonHints';

interface LessonHintLinkProps {
  /** `track-slug/lesson-slug` path into the curriculum. */
  lessonPath: string;
  /** Visible text (link variant) or accessible label (icon variant). */
  label: string;
  variant?: 'link' | 'icon';
  className?: string;
}

export default function LessonHintLink({
  lessonPath,
  label,
  variant = 'link',
  className,
}: LessonHintLinkProps) {
  const show = useShowLearningHints();
  if (!show) return null;

  const href = lessonHref(lessonPath);

  if (variant === 'icon') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        title={label}
        className={`lesson-hint-icon ${className ?? ''}`}
      >
        <span aria-hidden="true">?</span>
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`lesson-hint-link ${className ?? ''}`}
    >
      {label}
    </a>
  );
}
