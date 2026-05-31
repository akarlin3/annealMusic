/**
 * v6.3 — next-lesson picker (Stage 3 presentation).
 *
 * Shows 1–3 calm "why this next" cards after a completion or on arrival, plus an
 * onboarding variant (track chips) for brand-new learners. Calm-by-design: this
 * is an *offer*, not a funnel — it is dismissible, always paired with a "browse
 * all lessons" escape, and carries no streak / score / urgency. It also hosts the
 * single, gentle, once-per-session "sign in to keep your progress" nudge.
 */
import { useEffect, useState } from 'react';
import type { Track } from '../LearnApp';
import {
  shouldShowSyncNudge,
  markSyncNudgeShown,
} from '../progress/ProgressClient';
import { useMode } from '@/mode/useMode';

interface RecommendationItem {
  lesson_id: string;
  slug: string;
  title: string;
  difficulty: string;
  track_slug: string;
  rationale: string;
}

interface RecommendationsOut {
  items: RecommendationItem[];
  source: 'llm' | 'deterministic' | 'onboarding' | 'empty';
}

interface NextLessonPickerProps {
  apiBase: string;
  authenticated: boolean;
  context: 'completion' | 'arrival';
  justCompletedLessonId: string | null;
  tracks: Track[];
  onPick: (trackSlug: string, lessonSlug: string) => void;
}

function anonHeader(): Record<string, string> {
  const id =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('am_anon_id')
      : null;
  return id ? { 'x-anon-id': id } : {};
}

export function NextLessonPicker({
  apiBase,
  authenticated,
  context,
  justCompletedLessonId,
  tracks,
  onPick,
}: NextLessonPickerProps) {
  const [recs, setRecs] = useState<RecommendationsOut | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const { mode: appMode } = useMode();

  useEffect(() => {
    setDismissed(false);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/v1/recommendations/next`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...anonHeader() },
          credentials: 'include',
          body: JSON.stringify({
            context,
            just_completed_lesson_id: justCompletedLessonId,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as RecommendationsOut;
        if (!cancelled) setRecs(data);
      } catch {
        /* recommendations are best-effort; the curriculum is always below */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, context, justCompletedLessonId]);

  // Gentle once-per-session sync nudge for anon users with local progress.
  useEffect(() => {
    if (shouldShowSyncNudge(authenticated)) {
      setShowNudge(true);
      markSyncNudgeShown();
    }
  }, [authenticated]);

  const dismissNudge = () => setShowNudge(false);

  const openTrack = (track: Track) => {
    const first = track.lessons[0];
    if (first) onPick(track.slug, first.slug);
  };

  if (dismissed) return null;
  const hasItems = recs && recs.items.length > 0 && recs.source !== 'empty';
  const isOnboarding = recs?.source === 'onboarding';
  if (!hasItems && !showNudge) return null;

  const heading = isOnboarding
    ? 'A gentle place to begin'
    : context === 'completion'
      ? 'Where to go next'
      : 'Pick up where it feels right';

  return (
    <section className="next-lesson-picker" aria-label="Suggested lessons">
      {showNudge && (
        <div className="sync-nudge">
          <span>Sign in to keep your progress across devices.</span>
          <button
            className="sync-nudge-dismiss"
            onClick={dismissNudge}
            aria-label="Dismiss"
          >
            Not now
          </button>
        </div>
      )}

      {hasItems && (
        <div className="picker-inner">
          <div className="picker-header">
            <h2 className="picker-title">{heading}</h2>
            <button
              className="picker-dismiss"
              onClick={() => setDismissed(true)}
            >
              Dismiss
            </button>
          </div>

          <div className="picker-cards">
            {recs!.items.map((item) => {
              const lesson = tracks
                .flatMap((t) => t.lessons)
                .find((l) => l.id === item.lesson_id || l.slug === item.slug);
              const isCrossMode =
                lesson &&
                appMode &&
                lesson.modes &&
                lesson.modes.length > 0 &&
                !lesson.modes.includes(appMode);
              const getRelevanceLabel = () => {
                if (!lesson || !lesson.modes || lesson.modes.length === 0)
                  return null;
                const relevant = lesson.modes
                  .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
                  .join(', ');
                return `This lesson is also relevant to ${relevant} mode`;
              };

              return (
                <button
                  key={item.lesson_id}
                  className="picker-card"
                  onClick={() => onPick(item.track_slug, item.slug)}
                >
                  <span
                    className={`difficulty-badge difficulty-${item.difficulty}`}
                  >
                    {item.difficulty}
                  </span>
                  <h3 className="picker-card-title">{item.title}</h3>
                  <p className="picker-card-why">{item.rationale}</p>
                  {isCrossMode && (
                    <span className="text-[9px] uppercase tracking-wider text-amber-500/80 mt-2 font-mono block text-left">
                      {getRelevanceLabel()}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {isOnboarding && tracks.length > 0 && (
            <div className="picker-tracks">
              <p className="picker-tracks-label">Or explore a track:</p>
              <div className="picker-track-chips">
                {tracks.map((t) => (
                  <button
                    key={t.id}
                    className="picker-track-chip"
                    onClick={() => openTrack(t)}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="picker-escape">Or browse all lessons below.</p>
        </div>
      )}
    </section>
  );
}
