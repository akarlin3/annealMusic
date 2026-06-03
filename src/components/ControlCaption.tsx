import { getExplain } from '@/content/explanations';

interface ControlCaptionProps {
  /** Explanation id (matches a control-schema key, engine id, or feature id). */
  id: string;
}

/**
 * Always-visible one-line caption rendered under a control. Reads from the same
 * copy registry as the tooltip (`getExplain(id).caption`), so the two can never
 * disagree. Renders nothing if the id has no entry.
 *
 * Visibility is gated by the parent (e.g. ControlPanel's `showCaptions` prop),
 * so the minimal embed surface can suppress captions when space is tight.
 */
export default function ControlCaption({ id }: ControlCaptionProps) {
  const entry = getExplain(id);
  if (!entry) return null;
  return (
    <p className="mt-1 text-[11px] leading-snug" style={{ color: '#a8a29e' }}>
      {entry.caption}
    </p>
  );
}
