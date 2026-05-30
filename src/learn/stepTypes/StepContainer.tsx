import type { LessonStep } from '../LearnApp';
import { TextStep } from './TextStep';
import { DemoStep } from './DemoStep';
import { PromptStep } from './PromptStep';
import { ReflectionStep } from './ReflectionStep';
import type { BridgeClient } from '../../research/bridge/BridgeClient';

interface StepContainerProps {
  step: LessonStep;
  bridgeClient: BridgeClient | null;
  onStepComplete: () => void;
  reflectionValue?: string;
  onChangeReflection?: (val: string) => void;
}

export function StepContainer({
  step,
  bridgeClient,
  onStepComplete,
  reflectionValue = '',
  onChangeReflection,
}: StepContainerProps) {
  switch (step.type) {
    case 'text':
      return <TextStep step={step} onComplete={onStepComplete} />;
    case 'demo':
      return (
        <DemoStep
          step={step}
          bridgeClient={bridgeClient}
          onComplete={onStepComplete}
        />
      );
    case 'prompt':
      return (
        <PromptStep
          step={step}
          bridgeClient={bridgeClient}
          onComplete={onStepComplete}
        />
      );
    case 'reflection':
      return (
        <ReflectionStep
          step={step}
          value={reflectionValue}
          onChange={onChangeReflection || (() => {})}
          onComplete={onStepComplete}
        />
      );
    default:
      return (
        <div className="unknown-step">
          <p>Unknown step type: {step.type}</p>
          <button className="learn-step-btn" onClick={onStepComplete}>
            Continue
          </button>
        </div>
      );
  }
}
