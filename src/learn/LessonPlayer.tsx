import { useRef, useState, useEffect } from 'react';
import type { Track, Lesson } from './LearnApp';
import { StepContainer } from './stepTypes/StepContainer';
import { BridgeClient } from '../research/bridge/BridgeClient';
import { PostMessageTransport } from '../research/bridge/transport/postmessage';

interface LessonPlayerProps {
  track: Track;
  lesson: Lesson;
  onClose: () => void;
}

export function LessonPlayer({ track, lesson, onClose }: LessonPlayerProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [reflections, setReflections] = useState<Record<string, string>>({});

  // Bridge client and iframe reference
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [bridgeClient, setBridgeClient] = useState<BridgeClient | null>(null);

  // Mobile layout state
  const [isIframeExpanded, setIsIframeExpanded] = useState(false);

  const stepsCount = lesson.steps?.length || 0;
  const isLastStep = currentStepIndex === stepsCount - 1;
  const isSummaryStep = currentStepIndex === stepsCount;

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
      setCurrentStepIndex(currentStepIndex + 1);
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
      setCurrentStepIndex(currentStepIndex - 1);
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

        <main className="player-step-body">
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
