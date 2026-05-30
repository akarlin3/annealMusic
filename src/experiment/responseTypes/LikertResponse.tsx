import React from 'react';
import type { ResponseDefinition } from '../types';

interface LikertResponseProps {
  definition: ResponseDefinition;
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export const LikertResponse: React.FC<LikertResponseProps> = ({
  definition,
  value,
  onChange,
  disabled = false,
}) => {
  const scaleSize = definition.scale || 7;
  const options = Array.from({ length: scaleSize }, (_, i) => i + 1);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto p-4">
      <h3 className="text-lg font-mono text-stone-200 text-center tracking-wide leading-relaxed">
        {definition.prompt}
      </h3>
      <div className="flex items-center justify-between w-full gap-2 mt-4">
        {options.map((opt) => {
          const isSelected = value === opt;
          return (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt)}
              className={`flex-1 h-12 rounded-lg border font-mono text-sm transition-all focus:outline-none focus:ring-1 focus:ring-amber-500/50 ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-semibold shadow-md shadow-amber-500/5'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between w-full px-2 text-[10px] font-mono tracking-widest text-stone-500 uppercase">
        <span>Strongly Disagree</span>
        <span>Strongly Agree</span>
      </div>
    </div>
  );
};
