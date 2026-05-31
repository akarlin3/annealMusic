import React, { useMemo, useState } from 'react';
import type { Lesson, Track } from './LearnApp';
import type { LessonProgress } from './progress/ProgressClient';

interface CurriculumBrowserProps {
  tracks: Track[];
  onSelectLesson: (trackSlug: string, lessonSlug: string) => void;
  /** Lesson-id → progress, for a quiet completed checkmark + per-track count. */
  progress?: Record<string, LessonProgress>;
  showAll: boolean;
  onToggleShowAll: () => void;
}

type DifficultyFilter = 'all' | 'intro' | 'intermediate' | 'advanced';

export function CurriculumBrowser({
  tracks,
  onSelectLesson,
  progress = {},
  showAll,
  onToggleShowAll,
}: CurriculumBrowserProps) {
  const [query, setQuery] = useState('');
  const [trackFilter, setTrackFilter] = useState<string>('all');
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');

  // Lesson lookup by id, for resolving prerequisite titles + the "Start here"
  // target. Cheap to recompute; the curriculum is small.
  const lessonsById = useMemo(() => {
    const map: Record<string, Lesson> = {};
    for (const t of tracks) for (const l of t.lessons) map[l.id] = l;
    return map;
  }, [tracks]);

  const hasAnyProgress = useMemo(
    () => Object.values(progress).some((p) => p.state !== 'not_started'),
    [progress],
  );

  // "Start here": the first intro lesson of the first track (synthesis/intro by
  // position). Only surfaced for a brand-new learner.
  const startLesson = useMemo(() => {
    const ordered = [...tracks].sort((a, b) => a.position - b.position);
    for (const t of ordered) {
      const intro = [...t.lessons]
        .sort((a, b) => a.position - b.position)
        .find((l) => l.difficulty === 'intro');
      if (intro) return { track: t, lesson: intro };
    }
    return null;
  }, [tracks]);

  const q = query.trim().toLowerCase();
  const matches = (l: Lesson) =>
    !q ||
    l.title.toLowerCase().includes(q) ||
    (l.description ?? '').toLowerCase().includes(q);

  const visibleTracks = useMemo(
    () =>
      tracks
        .filter((t) => trackFilter === 'all' || t.slug === trackFilter)
        .map((t) => ({
          track: t,
          lessons: t.lessons.filter(
            (l) =>
              (difficulty === 'all' || l.difficulty === difficulty) &&
              matches(l),
          ),
        }))
        .filter(
          ({ lessons }) => lessons.length > 0 || (!q && difficulty === 'all'),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracks, trackFilter, difficulty, q],
  );

  const totalMatches = visibleTracks.reduce((n, t) => n + t.lessons.length, 0);

  const unmetPrereqs = (lesson: Lesson): Lesson[] =>
    lesson.prerequisites
      .filter((id) => progress[id]?.state !== 'completed')
      .map((id) => lessonsById[id])
      .filter((l): l is Lesson => Boolean(l));

  return (
    <div className="curriculum-browser">
      <header className="curriculum-header">
        <div className="curriculum-logo">
          <span className="logo-accent">A</span>nnealMusic{' '}
          <span className="logo-badge">Academy</span>
        </div>
        <h1 className="curriculum-title">Pedagogical Tracks</h1>
        <p className="curriculum-subtitle">
          Master the physics of phase coupling, microtonal tuning, and emergent
          synthesis through interactive, self-paced sonic explorations.
        </p>
      </header>

      {!hasAnyProgress && startLesson && (
        <div className="start-here-banner">
          <div className="start-here-copy">
            <h2 className="start-here-title">
              New here? Start with the basics.
            </h2>
            <p className="start-here-sub">
              “{startLesson.lesson.title}” is a calm place to begin — no
              prerequisites, about {startLesson.lesson.estimated_minutes}{' '}
              minutes.
            </p>
          </div>
          <button
            className="learn-primary-btn"
            onClick={() =>
              onSelectLesson(startLesson.track.slug, startLesson.lesson.slug)
            }
          >
            Start here
          </button>
        </div>
      )}

      <div className="curriculum-controls" role="search">
        <input
          className="curriculum-search"
          type="search"
          value={query}
          placeholder="Search lessons by topic…"
          aria-label="Search lessons by topic"
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="curriculum-filter"
          value={trackFilter}
          aria-label="Filter by track"
          onChange={(e) => setTrackFilter(e.target.value)}
        >
          <option value="all">All tracks</option>
          {[...tracks]
            .sort((a, b) => a.position - b.position)
            .map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.title}
              </option>
            ))}
        </select>
        <select
          className="curriculum-filter"
          value={difficulty}
          aria-label="Filter by difficulty"
          onChange={(e) => setDifficulty(e.target.value as DifficultyFilter)}
        >
          <option value="all">All levels</option>
          <option value="intro">Intro</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <button
          type="button"
          className={`curriculum-filter show-all-btn ${showAll ? 'active' : ''}`}
          onClick={onToggleShowAll}
          style={{
            cursor: 'pointer',
            fontWeight: 600,
            background: showAll
              ? 'rgba(99, 102, 241, 0.25)'
              : 'rgba(15, 23, 42, 0.5)',
            borderColor: showAll
              ? 'rgba(99, 102, 241, 0.5)'
              : 'rgba(148, 163, 184, 0.25)',
            color: showAll ? '#a5b4fc' : '#e2e8f0',
            transition: 'all 0.2s ease-in-out',
          }}
        >
          {showAll ? 'Show Mode Lessons' : 'Show All Lessons'}
        </button>
      </div>

      {q && (
        <p className="curriculum-result-count">
          {totalMatches} lesson{totalMatches === 1 ? '' : 's'} match “{query}”.
        </p>
      )}

      <main className="curriculum-content">
        <div className="tracks-grid">
          {visibleTracks.map(({ track, lessons }) => {
            const trackColor = track.color || '#6366f1';
            const completedCount = track.lessons.filter(
              (l) => progress[l.id]?.state === 'completed',
            ).length;
            return (
              <section
                key={track.id}
                className="track-card"
                style={{ '--track-accent': trackColor } as React.CSSProperties}
              >
                <div className="track-glow" />
                <div className="track-header">
                  <div className="track-pillar-badge">
                    PILLAR {track.position + 1}
                  </div>
                  <h2 className="track-title">{track.title}</h2>
                  <p className="track-description">{track.description}</p>
                  <p className="track-lesson-count">
                    {track.lessons.length} lesson
                    {track.lessons.length === 1 ? '' : 's'}
                  </p>
                  {/* Descriptive count only — no percentage, no bar, no streak. */}
                  {track.lessons.length > 0 && completedCount > 0 && (
                    <p className="track-progress-note">
                      {completedCount} of {track.lessons.length} lessons
                      explored
                    </p>
                  )}
                </div>

                <div className="lessons-list">
                  {lessons.length === 0 ? (
                    <div className="no-lessons">
                      No lessons registered under this pillar.
                    </div>
                  ) : (
                    lessons.map((lesson) => {
                      const state = progress[lesson.id]?.state;
                      const isCompleted = state === 'completed';
                      const isInProgress = state === 'in_progress';
                      const unmet = unmetPrereqs(lesson);
                      return (
                        <div
                          key={lesson.id}
                          className={`lesson-row${isCompleted ? ' lesson-completed' : ''}`}
                          onClick={() =>
                            onSelectLesson(track.slug, lesson.slug)
                          }
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              onSelectLesson(track.slug, lesson.slug);
                            }
                          }}
                        >
                          <div className="lesson-info">
                            <h3 className="lesson-title">
                              {isCompleted && (
                                <span
                                  className="lesson-complete-check"
                                  aria-label="completed"
                                  title="Completed"
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    width="14"
                                    height="14"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{
                                      marginRight: '6px',
                                      verticalAlign: 'middle',
                                    }}
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                </span>
                              )}
                              {lesson.title}
                            </h3>
                            <p className="lesson-desc">{lesson.description}</p>
                            <div className="lesson-meta">
                              <span
                                className={`difficulty-badge difficulty-${lesson.difficulty}`}
                              >
                                {lesson.difficulty}
                              </span>
                              {lesson.modes &&
                                lesson.modes.map((m) => {
                                  const label =
                                    m.charAt(0).toUpperCase() + m.slice(1);
                                  const colorMap: Record<
                                    string,
                                    { bg: string; text: string }
                                  > = {
                                    meditation: {
                                      bg: 'rgba(245, 158, 11, 0.15)',
                                      text: '#f59e0b',
                                    },
                                    musician: {
                                      bg: 'rgba(139, 92, 246, 0.15)',
                                      text: '#a78bfa',
                                    },
                                    researcher: {
                                      bg: 'rgba(20, 184, 166, 0.15)',
                                      text: '#2dd4bf',
                                    },
                                  };
                                  const theme = colorMap[m] || {
                                    bg: 'rgba(255, 255, 255, 0.1)',
                                    text: '#fff',
                                  };
                                  return (
                                    <span
                                      key={m}
                                      className="mode-tag-badge"
                                      style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        background: theme.bg,
                                        color: theme.text,
                                      }}
                                    >
                                      {label}
                                    </span>
                                  );
                                })}
                              <span className="duration-badge">
                                <svg
                                  viewBox="0 0 24 24"
                                  width="12"
                                  height="12"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  style={{
                                    marginRight: '4px',
                                    verticalAlign: 'middle',
                                  }}
                                >
                                  <circle cx="12" cy="12" r="10" />
                                  <polyline points="12 6 12 12 16 14" />
                                </svg>
                                {lesson.estimated_minutes} min
                              </span>
                              {isInProgress && (
                                <span className="resume-badge">Resume</span>
                              )}
                            </div>
                            {unmet.length > 0 && (
                              <p className="lesson-prereq-note">
                                Suggested first:{' '}
                                {unmet.map((p) => p.title).join(', ')}
                              </p>
                            )}
                          </div>
                          <div className="lesson-action">
                            <span className="start-lesson-icon">
                              <svg
                                viewBox="0 0 24 24"
                                width="16"
                                height="16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
          {visibleTracks.length === 0 && (
            <p className="curriculum-empty">
              No lessons match your search. Try a different topic or clear the
              filters.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
