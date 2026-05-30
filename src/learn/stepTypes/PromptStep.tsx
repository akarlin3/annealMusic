import { useEffect } from 'react';
import type { LessonStep } from '../LearnApp';
import type { BridgeClient } from '../../research/bridge/BridgeClient';

interface PromptStepProps {
  step: LessonStep;
  bridgeClient: BridgeClient | null;
  onComplete: () => void;
}

export function PromptStep({
  step,
  bridgeClient,
  onComplete,
}: PromptStepProps) {
  const { title, prompt, constraints, hint } = step.config || {};

  useEffect(() => {
    if (bridgeClient && constraints && Array.isArray(constraints)) {
      bridgeClient.constrain(constraints);

      // Pulse glows to direct focus to the newly unlocked sliders
      for (const key of constraints) {
        bridgeClient.highlight(key);
      }
    }

    return () => {
      if (bridgeClient) {
        bridgeClient.releaseConstraints();
      }
    };
  }, [bridgeClient, step.id, constraints]);

  return (
    <div className="learn-step-content prompt-step animate-fade-in">
      {title && <h2 className="step-title">{title}</h2>}

      <div className="prompt-challenge-card">
        <div className="challenge-header">
          <span className="challenge-badge">ACTIVE EXPERIMENT</span>
          <span className="challenge-lock-icon">
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ marginRight: '4px', verticalAlign: 'middle' }}
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Controls Sandboxed
          </span>
        </div>
        <p className="challenge-prompt">{prompt}</p>
      </div>

      {constraints && Array.isArray(constraints) && (
        <div className="unlocked-params-info">
          <span className="info-title">Sandboxed Parameters:</span>
          <div className="unlocked-pills">
            {constraints.map((key) => (
              <span key={key} className="unlocked-pill">
                {key}
              </span>
            ))}
          </div>
          <p className="unlocked-hint">
            All other controls are locked to isolate this specific sound
            relationship.
          </p>
        </div>
      )}

      {hint && (
        <div className="prompt-hint-card">
          <p className="hint-text">
            <strong>Hint:</strong> {hint}
          </p>
        </div>
      )}

      <div className="step-footer-actions">
        <button
          className="learn-primary-btn"
          onClick={() => {
            onComplete();
          }}
        >
          I've Tried This
        </button>
      </div>
    </div>
  );
}
