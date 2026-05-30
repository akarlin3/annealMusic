import type { LessonStep } from '../LearnApp';

interface TextStepProps {
  step: LessonStep;
  onComplete: () => void;
}

export function TextStep({ step, onComplete }: TextStepProps) {
  const { title, content, key_points, diagram } = step.config || {};

  // Simple paragraph parser that splits text by double newlines
  const paragraphs =
    typeof content === 'string' ? content.split('\n\n').filter(Boolean) : [];

  // v6.1: an optional generated diagram. SVG is server-sanitized (allowlist) so
  // it can be injected directly; mermaid source renders as a labelled block (the
  // player does not bundle the mermaid runtime).
  const diagramSource =
    diagram && typeof diagram.source === 'string' ? diagram.source : null;

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

      {diagramSource && diagram.kind === 'svg' && (
        <div
          className="step-diagram"
          dangerouslySetInnerHTML={{ __html: diagramSource }}
        />
      )}
      {diagramSource && diagram.kind === 'mermaid' && (
        <pre className="step-diagram step-diagram-mermaid">{diagramSource}</pre>
      )}

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
