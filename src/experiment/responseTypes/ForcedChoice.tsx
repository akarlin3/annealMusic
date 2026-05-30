import React from 'react';
import type { ResponseDefinition } from '../types';

interface ForcedChoiceProps {
  definition: ResponseDefinition;
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const ForcedChoice: React.FC<ForcedChoiceProps> = ({
  definition,
  value,
  onChange,
  disabled = false,
}) => {
  const options = definition.options || [];

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto p-4">
      <h3 className="text-lg font-mono text-stone-200 text-center tracking-wide leading-relaxed">
        {definition.prompt}
      </h3>
      <div className="flex flex-col w-full gap-3 mt-4">
        {options.map((opt) => {
          const isSelected = value === opt;
          return (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt)}
              className={`w-full py-3.5 px-5 rounded-xl border text-left font-mono text-xs uppercase tracking-wider transition-all focus:outline-none focus:ring-1 focus:ring-amber-500/50 ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-semibold shadow-md shadow-amber-500/5'
                  : 'bg-stone-900 border-stone-850 text-stone-300 hover:border-stone-700 hover:text-stone-100'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
};
