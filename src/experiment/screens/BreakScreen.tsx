import React from 'react';
import { Coffee } from 'lucide-react';

interface BreakScreenProps {
  message: string;
  onContinue: () => void;
}

export const BreakScreen: React.FC<BreakScreenProps> = ({
  message,
  onContinue,
}) => {
  return (
    <div className="w-full max-w-md mx-auto p-6 md:p-8 border border-stone-900 bg-stone-900/10 rounded-2xl shadow-xl flex flex-col gap-6 text-center select-none animate-fadeIn">
      <div className="flex justify-center mt-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
          <Coffee size={24} strokeWidth={1.5} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-base font-mono uppercase tracking-wider font-semibold text-stone-200">
          Scheduled Break
        </h1>
        <p className="text-[10px] text-stone-500 font-mono uppercase tracking-widest mt-0.5">
          Take a moment if you need
        </p>
      </div>

      <div className="text-sm font-sans text-stone-400 leading-relaxed px-2">
        {message ||
          'Halfway through the experiment. Take a moment if you need, then click below to continue.'}
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="w-full py-3 rounded-xl text-xs font-mono uppercase tracking-wider bg-amber-500 text-stone-950 font-semibold hover:bg-amber-400 shadow-md shadow-amber-500/5 transition-all mt-4"
      >
        Resume Experiment
      </button>
    </div>
  );
};
