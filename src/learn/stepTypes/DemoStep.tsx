import { useEffect, useState } from 'react';
import type { LessonStep } from '../LearnApp';
import type { BridgeClient } from '../../research/bridge/BridgeClient';

interface DemoStepProps {
  step: LessonStep;
  bridgeClient: BridgeClient | null;
  onComplete: () => void;
}

export function DemoStep({ step, bridgeClient, onComplete }: DemoStepProps) {
  const { title, description, patch, highlights } = step.config || {};
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadDemoPatch = async () => {
    if (!bridgeClient || !patch) return;
    try {
      setLoading(true);
      await bridgeClient.loadPatch(patch);
      setLoaded(true);

      // Pulse highlights on specified controls
      if (highlights && Array.isArray(highlights)) {
        for (const key of highlights) {
          await bridgeClient.highlight(key);
        }
      }
    } catch (err) {
      console.error('Failed to load demo patch:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bridgeClient) {
      loadDemoPatch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgeClient, step.id]);

  return (
    <div className="learn-step-content demo-step animate-fade-in">
      {title && <h2 className="step-title">{title}</h2>}

      <div className="step-body-text">
        <p className="step-paragraph">{description}</p>
      </div>

      <div className="demo-patch-card">
        <div className="demo-patch-status">
          <span
            className={`status-indicator ${loaded ? 'status-active' : 'status-inactive'}`}
          />
          <span className="status-label">
            {loading
              ? 'Configuring synthesizer...'
              : loaded
                ? 'Demo Patch Loaded'
                : 'Patch Ready'}
          </span>
        </div>
        <button
          className="demo-reset-btn"
          onClick={loadDemoPatch}
          disabled={loading || !bridgeClient}
        >
          {loaded ? 'Reset to Demo State' : 'Load Demo Patch'}
        </button>
      </div>

      {highlights && Array.isArray(highlights) && highlights.length > 0 && (
        <div className="demo-highlights-info">
          <p className="highlight-hint">
            <span className="sparkle">✦</span> Look at the glowing controls in
            the right panel! We have highlighted{' '}
            <strong>{highlights.join(', ')}</strong> to guide your attention.
          </p>
        </div>
      )}

      <div className="step-footer-actions">
        <button
          className="learn-primary-btn"
          onClick={onComplete}
          disabled={loading}
        >
          I've Listened & Continue
        </button>
      </div>
    </div>
  );
}
