import { useEffect, useMemo, useState } from 'react';
import { CurriculumBrowser } from './CurriculumBrowser';
import { LessonPlayer } from './LessonPlayer';
import { AdminPanel } from './admin/AdminPanel';
import {
  ProgressClient,
  importLocalProgress,
  type LessonProgress,
} from './progress/ProgressClient';
import { NextLessonPicker } from './recommend/NextLessonPicker';
import { useMode } from '@/mode/useMode';

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
  const { mode } = useMode();

  const filteredTracks = useMemo(() => {
    if (!mode) return tracks;
    return tracks
      .map((track) => {
        const filteredLessons = track.lessons.filter((lesson) => {
          const description = (lesson.description || '').toLowerCase();
          const title = (lesson.title || '').toLowerCase();
          const trackSlug = (track.slug || '').toLowerCase();

          if (mode === 'meditation') {
            return (
              description.includes('meditation') ||
              description.includes('mindfulness') ||
              description.includes('focus') ||
              description.includes('breath') ||
              description.includes('calm') ||
              title.includes('meditation') ||
              title.includes('breath') ||
              title.includes('calm') ||
              trackSlug.includes('meditation') ||
              trackSlug.includes('breath')
            );
          }
          if (mode === 'researcher') {
            return (
              description.includes('science') ||
              description.includes('research') ||
              description.includes('clinical') ||
              description.includes('psychoacoustic') ||
              description.includes('experiments') ||
              description.includes('study') ||
              description.includes('sonification') ||
              title.includes('science') ||
              title.includes('experiment') ||
              title.includes('sonification') ||
              trackSlug.includes('science') ||
              trackSlug.includes('research')
            );
          }
          // Musician mode shows standard creative paths
          return (
            !description.includes('science') &&
            !description.includes('clinical') &&
            !description.includes('experiments') &&
            !description.includes('psychoacoustic')
          );
        });
        return { ...track, lessons: filteredLessons };
      })
      .filter((track) => track.lessons.length > 0);
  }, [tracks, mode]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Router state
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(() =>
    window.location.hash.startsWith('#admin'),
  );

  // Progress + auth state.
  const [authenticated, setAuthenticated] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [progress, setProgress] = useState<Record<string, LessonProgress>>({});
  // Lesson just completed → drives the post-completion next-lesson picker.
  const [justCompleted, setJustCompleted] = useState<string | null>(null);

  const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

  const progressClient = useMemo(
    () => new ProgressClient(authenticated),
    [authenticated],
  );

  // Resolve auth state once (account → cross-device progress + import on sign-in).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/auth/session`, {
          credentials: 'include',
        });
        const data = res.ok ? await res.json() : { account: null };
        if (!cancelled) setAuthenticated(!!data?.account);
      } catch {
        if (!cancelled) setAuthenticated(false);
      } finally {
        if (!cancelled) setAuthResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [API_BASE]);

  // On first sign-in, migrate any buffered anonymous (localStorage) progress, then
  // (re)load the unified progress map for the curriculum browser checkmarks.
  useEffect(() => {
    if (!authResolved) return;
    let cancelled = false;
    (async () => {
      if (authenticated) {
        await importLocalProgress();
      }
      const map = await progressClient.list();
      if (!cancelled) setProgress(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [authResolved, authenticated, progressClient]);

  const refreshProgress = async () => {
    setProgress(await progressClient.list());
  };

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

  const handleLessonCompleted = (lessonId: string) => {
    setJustCompleted(lessonId);
    void refreshProgress();
  };

  return (
    <div className="learn-app-container">
      {activeLesson ? (
        <LessonPlayer
          track={activeTrack!}
          lesson={activeLesson}
          onClose={navigateToHome}
          progressClient={progressClient}
          onCompleted={handleLessonCompleted}
        />
      ) : (
        <>
          <NextLessonPicker
            apiBase={API_BASE}
            authenticated={authenticated}
            context={justCompleted ? 'completion' : 'arrival'}
            justCompletedLessonId={justCompleted}
            tracks={filteredTracks}
            onPick={navigateToLesson}
          />
          <CurriculumBrowser
            tracks={filteredTracks}
            progress={progress}
            onSelectLesson={navigateToLesson}
          />
        </>
      )}
    </div>
  );
}
