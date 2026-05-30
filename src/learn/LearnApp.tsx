import { useEffect, useState } from 'react';
import { CurriculumBrowser } from './CurriculumBrowser';
import { LessonPlayer } from './LessonPlayer';
import { AdminPanel } from './admin/AdminPanel';

export interface LessonStep {
  id: string;
  lesson_id: string;
  position: number;
  type: 'text' | 'demo' | 'prompt' | 'reflection' | 'audio-clip';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any;
}

export interface Lesson {
  id: string;
  track_id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: 'intro' | 'intermediate' | 'advanced';
  estimated_minutes: number;
  position: number;
  prerequisites: string[];
  steps: LessonStep[];
}

export interface Track {
  id: string;
  slug: string;
  title: string;
  description: string;
  position: number;
  color: string;
  lessons: Lesson[];
}

export function LearnApp() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Router state
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(() =>
    window.location.hash.startsWith('#admin'),
  );

  const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

  useEffect(() => {
    async function fetchCurriculum() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/v1/tracks`);
        if (!res.ok) {
          throw new Error(`Failed to fetch curriculum: ${res.statusText}`);
        }
        const data = await res.json();
        setTracks(data.items || []);
        setError(null);
      } catch (err) {
        console.error(err);
        const errMsg =
          err instanceof Error
            ? err.message
            : 'An error occurred loading the curriculum.';
        setError(errMsg);
      } finally {
        setLoading(false);
      }
    }
    fetchCurriculum();
  }, [API_BASE]);

  // Handle URL hash changes for zero-dependency SPA routing
  useEffect(() => {
    function handleHashChange() {
      const hash = window.location.hash;
      if (!hash) {
        setActiveTrack(null);
        setActiveLesson(null);
        return;
      }

      // Hash pattern: #lesson/track-slug/lesson-slug
      const parts = hash.split('/');
      if (parts[0] === '#lesson' && parts.length === 3) {
        const trackSlug = parts[1];
        const lessonSlug = parts[2];
        const track = tracks.find((t) => t.slug === trackSlug);
        if (track) {
          const lesson = track.lessons.find((l) => l.slug === lessonSlug);
          if (lesson) {
            setActiveTrack(track);
            setActiveLesson(lesson);
            return;
          }
        }
      }

      // Fallback
      setActiveTrack(null);
      setActiveLesson(null);
    }

    if (tracks.length > 0) {
      handleHashChange();
      window.addEventListener('hashchange', handleHashChange);
    }
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [tracks]);

  // Admin console routing (#admin) — independent of curriculum load state so it
  // works even if the public fetch fails.
  useEffect(() => {
    function onHash() {
      setIsAdmin(window.location.hash.startsWith('#admin'));
    }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigateToHome = () => {
    window.location.hash = '';
  };

  if (isAdmin) {
    return <AdminPanel onClose={navigateToHome} />;
  }

  const navigateToLesson = (trackSlug: string, lessonSlug: string) => {
    window.location.hash = `#lesson/${trackSlug}/${lessonSlug}`;
  };

  if (loading) {
    return (
      <div className="learn-loading-container">
        <div className="learn-spinner" />
        <p className="learn-loading-text">Loading curriculum...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="learn-error-container">
        <div className="learn-error-card">
          <h2>Failed to load curriculum</h2>
          <p className="learn-error-text">{error}</p>
          <button
            className="learn-retry-btn"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="learn-app-container">
      {activeLesson ? (
        <LessonPlayer
          track={activeTrack!}
          lesson={activeLesson}
          onClose={navigateToHome}
        />
      ) : (
        <CurriculumBrowser tracks={tracks} onSelectLesson={navigateToLesson} />
      )}
    </div>
  );
}
