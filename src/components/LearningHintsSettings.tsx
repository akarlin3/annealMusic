/**
 * v6.5 — the global opt-out for in-app learning hints. Default on; flipping it
 * off suppresses every LessonHintLink and the first-time banner across the main
 * app (reactively, via the lessonHints external store). Device-local, matching
 * the other calm preferences.
 */
import { GraduationCap } from 'lucide-react';
import {
  setShowLearningHints,
  useShowLearningHints,
} from '@/components/lessonHints';

interface LearningHintsSettingsProps {
  showToast?: (text: string) => void;
}

export default function LearningHintsSettings({
  showToast,
}: LearningHintsSettingsProps) {
  const show = useShowLearningHints();

  const onToggle = (checked: boolean) => {
    setShowLearningHints(checked);
    showToast?.(checked ? 'Learning hints enabled' : 'Learning hints hidden');
  };

  return (
    <section
      className="rounded-xl p-6 border border-stone-900 bg-stone-950/20"
      style={{ borderColor: '#292524' }}
    >
      <div className="mb-4 flex items-center gap-2">
        <GraduationCap size={14} className="text-amber-500" />
        <h2 className="text-[11px] uppercase tracking-[0.2em] font-semibold text-stone-200">
          Learning
        </h2>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={show}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-0.5 rounded border-stone-800 bg-stone-900 text-amber-500 focus:ring-0 focus:ring-offset-0 focus:outline-none"
          style={{ borderColor: '#44403c' }}
        />
        <div>
          <span className="text-[10px] text-stone-300 font-semibold uppercase tracking-wider block">
            Show learning hints
          </span>
          <span className="text-[9px] text-stone-500 leading-normal block mt-0.5">
            Quiet “learn more” links on engines, controls, and modes that open
            the matching /learn lesson in a new tab. Turning this off hides
            every hint and the intro banner.
          </span>
        </div>
      </label>
    </section>
  );
}
