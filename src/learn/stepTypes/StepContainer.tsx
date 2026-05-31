import type { LessonStep } from '../LearnApp';
import { TextStep } from './TextStep';
import { DemoStep } from './DemoStep';
import { PromptStep } from './PromptStep';
import { ReflectionStep } from './ReflectionStep';
import { AudioClipStep } from './AudioClipStep';
import type { BridgeClient } from '../../research/bridge/BridgeClient';
import type { StepActionType } from '../progress/ProgressClient';

interface StepContainerProps {
  step: LessonStep;
  bridgeClient: BridgeClient | null;
  onStepComplete: () => void;
  reflectionValue?: string;
  onChangeReflection?: (val: string) => void;
  /** Additive v6.5 engagement signals (clip play/replay, prompt tried). */
  onStepAction?: (action: StepActionType) => void;
}

export function StepContainer({
  step,
  bridgeClient,
  onStepComplete,
  reflectionValue = '',
  onChangeReflection,
  onStepAction,
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
          onStepAction={onStepAction}
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
    case 'audio-clip':
      return (
        <AudioClipStep
          step={step}
          bridgeClient={bridgeClient}
          onComplete={onStepComplete}
          onStepAction={onStepAction}
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
