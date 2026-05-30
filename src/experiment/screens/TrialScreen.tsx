import React from 'react';
import type { Trial } from '../types';
import { LikertResponse } from '../responseTypes/LikertResponse';
import { ForcedChoice } from '../responseTypes/ForcedChoice';
import { FreeText } from '../responseTypes/FreeText';
import { AdjustValue } from '../responseTypes/AdjustValue';
import { ReactionTime } from '../responseTypes/ReactionTime';
import { Continuous } from '../responseTypes/Continuous';

interface TrialScreenProps {
  trial: Trial;
  trialIndex: number;
  totalTrials: number;
  blockName: string;
  isFixation: boolean;
  responseValue: unknown;
  onResponseChange: (val: unknown) => void;
  onComplete: () => void;
  onEngineParamChange: (param: string, value: number) => void;
  onSampleContinuous: (timeMs: number, value: number) => void;
  onReactionTimeComplete: (rtMs: number, key: string) => void;
  stimulusPlaying: boolean;
}

export const TrialScreen: React.FC<TrialScreenProps> = ({
  trial,
  trialIndex,
  totalTrials,
  blockName,
  isFixation,
  responseValue,
  onResponseChange,
  onComplete,
  onEngineParamChange,
  onSampleContinuous,
  onReactionTimeComplete,
  stimulusPlaying,
}) => {
  const respType = trial.response.type;

  // Validate response to enable "Next" button
  const hasResponse = () => {
    if (respType === 'ReactionTime') return true; // managed via keydown
    if (respType === 'Continuous') return true; // collected over time
    if (respType === 'LikertResponse')
      return responseValue !== null && responseValue !== undefined;
    if (respType === 'ForcedChoice')
      return responseValue !== null && responseValue !== '';
    if (respType === 'FreeText')
      return responseValue !== null && responseValue !== '';
    if (respType === 'AdjustValue') return responseValue !== null;
    return false;
  };

  const renderResponseComponent = () => {
    switch (respType) {
      case 'LikertResponse':
        return (
          <LikertResponse
            definition={trial.response}
            value={responseValue as number | null}
            onChange={onResponseChange as (val: number) => void}
          />
        );
      case 'ForcedChoice':
        return (
          <ForcedChoice
            definition={trial.response}
            value={responseValue as string | null}
            onChange={onResponseChange as (val: string) => void}
          />
        );
      case 'FreeText':
        return (
          <FreeText
            definition={trial.response}
            value={responseValue as string | null}
            onChange={onResponseChange as (val: string) => void}
          />
        );
      case 'AdjustValue':
        return (
          <AdjustValue
            definition={trial.response}
            value={responseValue as number | null}
            onChange={onResponseChange as (val: number) => void}
            onEngineParamChange={onEngineParamChange}
          />
        );
      case 'ReactionTime':
        return (
          <ReactionTime
            definition={trial.response}
            onComplete={onReactionTimeComplete}
            disabled={!stimulusPlaying}
          />
        );
      case 'Continuous':
        return (
          <Continuous
            definition={trial.response}
            onSample={onSampleContinuous}
            disabled={!stimulusPlaying}
          />
        );
      default:
        return null;
    }
  };

  if (isFixation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] animate-fadeIn select-none">
        <div className="text-4xl font-light font-mono text-stone-600 animate-pulse">
          +
        </div>
        <p className="text-[9px] font-mono tracking-widest text-stone-650 uppercase mt-4">
          Focusing
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-6 animate-fadeIn select-none p-4">
      {/* Trial Header */}
      <div className="flex items-center justify-between border-b border-stone-900 pb-3">
        <span className="text-[10px] font-mono tracking-widest text-stone-500 uppercase">
          Block: {blockName}
        </span>
        <span className="text-[10px] font-mono tracking-widest text-amber-500 uppercase font-semibold">
          Trial {trialIndex + 1} of {totalTrials}
        </span>
      </div>

      {/* Audio Playback State Card */}
      <div className="border border-stone-900 bg-stone-900/10 rounded-2xl p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${stimulusPlaying ? 'bg-amber-500 shadow-md shadow-amber-500/50 animate-pulse' : 'bg-stone-700'}`}
          />
          <span className="text-xs font-mono text-stone-300 uppercase tracking-wider">
            {stimulusPlaying
              ? 'Stimulus playing...'
              : 'Stimulus ended. Please respond.'}
          </span>
        </div>
        {trial.stimulus.visualizer && stimulusPlaying && (
          <div className="flex gap-0.5 h-3 items-end">
            <span
              className="w-0.5 bg-amber-500 animate-bounce h-2"
              style={{ animationDelay: '0.1s' }}
            />
            <span
              className="w-0.5 bg-amber-500 animate-bounce h-3"
              style={{ animationDelay: '0.3s' }}
            />
            <span
              className="w-0.5 bg-amber-500 animate-bounce h-1.5"
              style={{ animationDelay: '0.2s' }}
            />
          </div>
        )}
      </div>

      {/* Response Box */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[30vh]">
        {renderResponseComponent()}
      </div>

      {/* Actions */}
      {respType !== 'ReactionTime' && (
        <div className="flex justify-end mt-4">
          <button
            type="button"
            disabled={
              !hasResponse() || (respType === 'Continuous' && stimulusPlaying)
            }
            onClick={onComplete}
            className="px-8 py-3 rounded-xl text-xs font-mono uppercase tracking-wider bg-amber-500 text-stone-950 font-semibold hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-amber-500/5 transition-all"
          >
            {respType === 'Continuous' && stimulusPlaying
              ? 'Listening...'
              : 'Next Trial'}
          </button>
        </div>
      )}
    </div>
  );
};
