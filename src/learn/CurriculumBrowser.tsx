import React from 'react';
import type { Track } from './LearnApp';
import type { LessonProgress } from './progress/ProgressClient';

interface CurriculumBrowserProps {
  tracks: Track[];
  onSelectLesson: (trackSlug: string, lessonSlug: string) => void;
  /** Lesson-id → progress, for a quiet completed checkmark + per-track count. */
  progress?: Record<string, LessonProgress>;
}

export function CurriculumBrowser({
  tracks,
  onSelectLesson,
  progress = {},
}: CurriculumBrowserProps) {
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

      <main className="curriculum-content">
        <div className="tracks-grid">
          {tracks.map((track) => {
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
                  {/* Descriptive count only — no percentage, no bar, no streak. */}
                  {track.lessons.length > 0 && completedCount > 0 && (
                    <p className="track-progress-note">
                      {completedCount} of {track.lessons.length} lessons
                      explored
                    </p>
                  )}
                </div>

                <div className="lessons-list">
                  {track.lessons.length === 0 ? (
                    <div className="no-lessons">
                      No lessons registered under this pillar.
                    </div>
                  ) : (
                    track.lessons.map((lesson) => {
                      const state = progress[lesson.id]?.state;
                      const isCompleted = state === 'completed';
                      const isInProgress = state === 'in_progress';
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
        </div>
      </main>
    </div>
  );
}
