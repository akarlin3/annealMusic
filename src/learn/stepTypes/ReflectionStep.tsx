import type { LessonStep } from '../LearnApp';

interface ReflectionStepProps {
  step: LessonStep;
  value: string;
  onChange: (val: string) => void;
  onComplete: () => void;
}

export function ReflectionStep({
  step,
  value,
  onChange,
  onComplete,
}: ReflectionStepProps) {
  const { title, prompt, placeholder } = step.config || {};

  return (
    <div className="learn-step-content reflection-step animate-fade-in">
      {title && <h2 className="step-title">{title}</h2>}

      <div className="step-body-text">
        <p className="step-paragraph">
          {prompt ||
            'Reflect on the sound relationships and behaviors you observed in this exploration.'}
        </p>
      </div>

      <div className="reflection-textarea-container">
        <textarea
          className="reflection-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            placeholder ||
            'Type your notes or observations here... (this is optional; feel free to proceed when ready)'
          }
          rows={6}
        />
      </div>

      <div className="step-footer-actions">
        <button className="learn-primary-btn" onClick={onComplete}>
          Save Notes & Continue
        </button>
      </div>
    </div>
  );
}
