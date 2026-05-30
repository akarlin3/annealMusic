import type { LessonStep } from '../LearnApp';

interface TextStepProps {
  step: LessonStep;
  onComplete: () => void;
}

export function TextStep({ step, onComplete }: TextStepProps) {
  const { title, content, key_points } = step.config || {};

  // Simple paragraph parser that splits text by double newlines
  const paragraphs =
    typeof content === 'string' ? content.split('\n\n').filter(Boolean) : [];

  return (
    <div className="learn-step-content text-step animate-fade-in">
      {title && <h2 className="step-title">{title}</h2>}

      <div className="step-body-text">
        {paragraphs.map((p, idx) => (
          <p key={idx} className="step-paragraph">
            {p}
          </p>
        ))}
      </div>

      {key_points && Array.isArray(key_points) && key_points.length > 0 && (
        <div className="step-key-takeaways">
          <h4 className="key-takeaways-title">Key takeaways:</h4>
          <ul className="key-takeaways-list">
            {key_points.map((pt, idx) => (
              <li key={idx} className="key-takeaway-item">
                <span className="takeaway-bullet">•</span>
                <span className="takeaway-text">{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="step-footer-actions">
        <button className="learn-primary-btn" onClick={onComplete}>
          Understand & Continue
        </button>
      </div>
    </div>
  );
}
