import React from 'react';
import type { Track } from './LearnApp';

interface CurriculumBrowserProps {
  tracks: Track[];
  onSelectLesson: (trackSlug: string, lessonSlug: string) => void;
}

export function CurriculumBrowser({
  tracks,
  onSelectLesson,
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
                </div>

                <div className="lessons-list">
                  {track.lessons.length === 0 ? (
                    <div className="no-lessons">
                      No lessons registered under this pillar.
                    </div>
                  ) : (
                    track.lessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="lesson-row"
                        onClick={() => onSelectLesson(track.slug, lesson.slug)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            onSelectLesson(track.slug, lesson.slug);
                          }
                        }}
                      >
                        <div className="lesson-info">
                          <h3 className="lesson-title">{lesson.title}</h3>
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
                    ))
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
