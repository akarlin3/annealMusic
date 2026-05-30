import React, { useState } from 'react';
import type { ExperimentDefinition } from '../types';
import { Shield } from 'lucide-react';

interface ConsentScreenProps {
  definition: ExperimentDefinition;
  onAccept: () => void;
  onWithdraw: () => void;
}

export const ConsentScreen: React.FC<ConsentScreenProps> = ({
  definition,
  onAccept,
  onWithdraw,
}) => {
  const [checked, setChecked] = useState(false);

  return (
    <div className="w-full max-w-2xl mx-auto p-6 md:p-8 border border-stone-900 bg-stone-900/10 rounded-2xl shadow-xl flex flex-col gap-6 select-none animate-fadeIn">
      <div className="flex items-center gap-3 border-b border-stone-900 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
          <Shield size={20} strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-base font-mono uppercase tracking-wider font-semibold text-stone-200">
            {definition.title || 'Music Cognition Experiment'}
          </h1>
          <p className="text-[10px] text-stone-500 font-mono uppercase tracking-widest mt-0.5">
            Subject Consent & Briefing
          </p>
        </div>
      </div>

      {definition.description && (
        <div className="text-sm font-sans text-stone-400 leading-relaxed">
          {definition.description}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[10px] uppercase font-mono tracking-widest text-stone-500">
          Statement of Consent
        </span>
        <div className="w-full h-40 p-4 rounded-xl border border-stone-850 bg-stone-900/50 text-stone-300 font-sans text-xs leading-relaxed overflow-y-auto scrollbar-thin">
          {definition.consent_text ||
            'By checking the box below, you consent to participate in this perceptual research. You retain the right to withdraw at any moment without penalty.'}
        </div>
      </div>

      <label className="flex items-start gap-3 p-3 rounded-lg border border-stone-900 bg-stone-900/10 cursor-pointer hover:border-stone-800 transition-all select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-stone-800 bg-stone-900 text-amber-500 focus:ring-amber-500/30 accent-amber-500"
        />
        <span className="text-xs font-mono text-stone-400 leading-relaxed">
          I have read the statement of consent, understand my rights, and agree
          to participate in this study.
        </span>
      </label>

      <div className="flex items-center gap-4 mt-2">
        <button
          type="button"
          onClick={onWithdraw}
          className="px-5 py-2.5 rounded-lg text-xs font-mono uppercase tracking-wider text-stone-500 hover:text-stone-300 border border-transparent hover:border-stone-800 transition-all"
        >
          Withdraw
        </button>
        <button
          type="button"
          disabled={!checked}
          onClick={onAccept}
          className="flex-1 py-3 rounded-xl text-xs font-mono uppercase tracking-wider bg-amber-500 text-stone-950 font-semibold hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-amber-500/5 transition-all"
        >
          Begin Study
        </button>
      </div>
    </div>
  );
};
