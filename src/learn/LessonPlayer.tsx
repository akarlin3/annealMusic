import { useRef, useState, useEffect } from 'react';
import type { Track, Lesson } from './LearnApp';
import { StepContainer } from './stepTypes/StepContainer';
import { BridgeClient } from '../research/bridge/BridgeClient';
import { PostMessageTransport } from '../research/bridge/transport/postmessage';
import type { ProgressClient } from './progress/ProgressClient';
import {
  resumeLesson,
  applyScrollRatio,
  readScrollRatio,
} from './progress/ResumeHandler';

interface LessonPlayerProps {
  track: Track;
  lesson: Lesson;
  onClose: () => void;
  progressClient: ProgressClient;
  /** Called once when the lesson is completed (CP3 surfaces the next-lesson picker). */
  onCompleted?: (lessonId: string) => void;
}

export function LessonPlayer({
  track,
  lesson,
  onClose,
  progressClient,
  onCompleted,
}: LessonPlayerProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [reflections, setReflections] = useState<Record<string, string>>({});

  // Progress / resume bookkeeping.
  const stepBodyRef = useRef<HTMLElement>(null);
  const stepEnteredAt = useRef<number>(Date.now());
  const pendingScroll = useRef<number>(0);
  const savedCompletion = useRef<boolean>(false);

  // Bridge client and iframe reference
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [bridgeClient, setBridgeClient] = useState<BridgeClient | null>(null);

  // Mobile layout state
  const [isIframeExpanded, setIsIframeExpanded] = useState(false);

  const stepsCount = lesson.steps?.length || 0;
  const isLastStep = currentStepIndex === stepsCount - 1;
  const isSummaryStep = currentStepIndex === stepsCount;

  // Collect any reflection notes the user wrote, for their own private summary.
  // This is the user's data; it is stored server-side but NEVER sent to the LLM.
  const collectReflections = (): string | undefined => {
    const parts = lesson.steps
      .filter((s) => s.type === 'reflection')
      .map((s) => reflections[s.id]?.trim())
      .filter((t): t is string => !!t);
    return parts.length ? parts.join('\n\n') : undefined;
  };

  // Clean up constraints when the player is closed/unmounted
  useEffect(() => {
    return () => {
      if (bridgeClient) {
        bridgeClient.releaseConstraints().catch((err) => {
          console.warn('Failed to release constraints on unmount:', err);
        });
      }
    };
  }, [bridgeClient]);

  // Resume: open at the saved step + scroll position, cross-device for accounts.
  useEffect(() => {
    let cancelled = false;
    savedCompletion.current = false;
    stepEnteredAt.current = Date.now();
    (async () => {
      const point = await resumeLesson(progressClient, lesson.id, stepsCount);
      if (cancelled) return;
      if (point) {
        setCurrentStepIndex(point.stepIndex);
        pendingScroll.current = point.scrollRatio;
        stepEnteredAt.current = Date.now();
      } else {
        // Mark the lesson opened (not_started → in_progress) without nagging.
        void progressClient.save(lesson.id, {
          state: 'in_progress',
          current_step_position: 0,
          step_actions: [{ step_position: 0, action: 'started', ms: 0 }],
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  // After a resume sets the step, restore the scroll position once it has rendered.
  useEffect(() => {
    if (pendingScroll.current > 0 && stepBodyRef.current) {
      applyScrollRatio(stepBodyRef.current, pendingScroll.current);
      pendingScroll.current = 0;
    }
  }, [currentStepIndex]);

  // Pause on tab-hide / close: flush the current step + scroll with sendBeacon.
  useEffect(() => {
    const flush = () => {
      if (savedCompletion.current || currentStepIndex >= stepsCount) return;
      const ms = Date.now() - stepEnteredAt.current;
      progressClient.saveBeacon(lesson.id, {
        state: 'in_progress',
        current_step_position: currentStepIndex,
        scroll_ratio: readScrollRatio(stepBodyRef.current),
        step_actions: [
          { step_position: currentStepIndex, action: 'started', ms },
        ],
      });
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', flush);
    };
  }, [currentStepIndex, stepsCount, lesson.id, progressClient]);

  const handleIframeLoad = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        const transport = new PostMessageTransport(
          iframeRef.current.contentWindow,
        );
        const client = new BridgeClient(transport);
        setBridgeClient(client);
        console.log('[LessonPlayer] Connected to embedded app bridge.');
      } catch (err) {
        console.error(
          '[LessonPlayer] Failed to initialize postMessage bridge:',
          err,
        );
      }
    }
  };

  const handleNext = async () => {
    if (bridgeClient) {
      try {
        await bridgeClient.releaseConstraints();
      } catch (err) {
        console.warn('Failed to release constraints:', err);
      }
    }

    if (currentStepIndex < stepsCount) {
      const fromPos = currentStepIndex;
      const ms = Date.now() - stepEnteredAt.current;
      const next = currentStepIndex + 1;
      setCurrentStepIndex(next);
      stepEnteredAt.current = Date.now();

      if (next >= stepsCount) {
        // Reached the end + acknowledged → completed (idempotent).
        if (!savedCompletion.current) {
          savedCompletion.current = true;
          void progressClient.save(lesson.id, {
            state: 'completed',
            current_step_position: Math.max(stepsCount - 1, 0),
            step_actions: [{ step_position: fromPos, action: 'completed', ms }],
            reflection_text: collectReflections() ?? null,
          });
          onCompleted?.(lesson.id);
        }
      } else {
        void progressClient.save(lesson.id, {
          state: 'in_progress',
          current_step_position: next,
          scroll_ratio: 0,
          step_actions: [{ step_position: fromPos, action: 'completed', ms }],
        });
      }
    }
  };

  const handleBack = async () => {
    if (bridgeClient) {
      try {
        await bridgeClient.releaseConstraints();
      } catch (err) {
        console.warn('Failed to release constraints:', err);
      }
    }

    if (currentStepIndex > 0) {
      const prev = currentStepIndex - 1;
      stepEnteredAt.current = Date.now();
      setCurrentStepIndex(prev);
      void progressClient.save(lesson.id, {
        state: 'in_progress',
        current_step_position: prev,
        scroll_ratio: 0,
      });
    }
  };

  const handleReflectionChange = (stepId: string, val: string) => {
    setReflections((prev) => ({
      ...prev,
      [stepId]: val,
    }));
  };

  const activeStep = !isSummaryStep ? lesson.steps[currentStepIndex] : null;

  return (
    <div className="lesson-player-container">
      {/* Left panel: Lesson player chrome */}
      <div className="lesson-chrome-panel">
        <header className="player-header">
          <button
            className="exit-btn"
            onClick={onClose}
            aria-label="Exit lesson"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div className="player-title-block">
            <span className="player-track-tag" style={{ color: track.color }}>
              {track.title}
            </span>
            <h1 className="player-lesson-title">{lesson.title}</h1>
          </div>
        </header>

        {/* Calm by Design progress indicator */}
        {!isSummaryStep && stepsCount > 0 && (
          <div className="player-progress-bar">
            {Array.from({ length: stepsCount }).map((_, idx) => (
              <span
                key={idx}
                className={`progress-dot ${idx === currentStepIndex ? 'dot-active' : idx < currentStepIndex ? 'dot-completed' : 'dot-upcoming'}`}
              />
            ))}
          </div>
        )}

        <main className="player-step-body" ref={stepBodyRef}>
          {isSummaryStep ? (
            <div className="learn-step-content summary-step animate-fade-in">
              <h2 className="step-title">Lesson Completed</h2>
              <p className="step-paragraph">
                You've successfully completed <strong>{lesson.title}</strong>!
                Here is a summary of your personal reflection notes from this
                session.
              </p>

              <div className="summary-notes-container">
                {lesson.steps
                  .filter((s) => s.type === 'reflection')
                  .map((s, idx) => {
                    const noteText = reflections[s.id]?.trim();
                    return (
                      <div key={s.id} className="summary-note-card">
                        <h4 className="note-prompt-title">
                          Reflection {idx + 1}: {s.config?.title || 'Notes'}
                        </h4>
                        <p className="note-prompt-desc">"{s.config?.prompt}"</p>
                        <blockquote className="note-text-body">
                          {noteText || (
                            <span className="empty-note">
                              No response was recorded.
                            </span>
                          )}
                        </blockquote>
                      </div>
                    );
                  })}
              </div>

              <div className="step-footer-actions">
                <button className="learn-primary-btn" onClick={onClose}>
                  Finish & Return to Curriculum
                </button>
              </div>
            </div>
          ) : activeStep ? (
            <StepContainer
              step={activeStep}
              bridgeClient={bridgeClient}
              onStepComplete={handleNext}
              reflectionValue={reflections[activeStep.id] || ''}
              onChangeReflection={(val) =>
                handleReflectionChange(activeStep.id, val)
              }
            />
          ) : (
            <div className="empty-player">
              No steps registered for this lesson.
            </div>
          )}
        </main>

        {/* Step footer navigation */}
        {!isSummaryStep && (
          <footer className="player-footer">
            <button
              className="player-nav-btn back-btn"
              onClick={handleBack}
              disabled={currentStepIndex === 0}
            >
              Back
            </button>
            <div className="step-counter-text">
              Step {currentStepIndex + 1} of {stepsCount}
            </div>
            <button className="player-nav-btn next-btn" onClick={handleNext}>
              {isLastStep ? 'Complete' : 'Next'}
            </button>
          </footer>
        )}
      </div>

      {/* Right panel: Live application iframe */}
      <div
        className={`lesson-iframe-panel ${isIframeExpanded ? 'iframe-expanded' : 'iframe-collapsed'}`}
      >
        <div className="iframe-mobile-controls">
          <button
            className="iframe-toggle-btn"
            onClick={() => setIsIframeExpanded(!isIframeExpanded)}
          >
            {isIframeExpanded ? 'Minimize App' : 'Expand App'}
          </button>
        </div>
        <div className="iframe-wrapper">
          <iframe
            ref={iframeRef}
            src="/"
            title="AnnealMusic Live Synthesizer"
            className="embedded-app-iframe"
            onLoad={handleIframeLoad}
          />
        </div>
      </div>
    </div>
  );
}
