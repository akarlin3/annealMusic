import React from 'react';
import type { ResponseDefinition } from '../types';

interface FreeTextProps {
  definition: ResponseDefinition;
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const FreeText: React.FC<FreeTextProps> = ({
  definition,
  value,
  onChange,
  disabled = false,
}) => {
  const maxChars = definition.max_chars || 500;
  const currentText = value || '';

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const txt = e.target.value;
    if (txt.length <= maxChars) {
      onChange(txt);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-lg mx-auto p-4">
      <h3 className="text-lg font-mono text-stone-200 text-center tracking-wide leading-relaxed">
        {definition.prompt}
      </h3>
      <div className="w-full relative mt-4">
        <textarea
          disabled={disabled}
          value={currentText}
          onChange={handleTextChange}
          placeholder="Type your response here..."
          className="w-full h-32 p-4 rounded-xl border border-stone-850 bg-stone-900 text-stone-200 font-sans text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="absolute bottom-3 right-4 text-[10px] font-mono tracking-wider text-stone-500">
          {currentText.length} / {maxChars}
        </div>
      </div>
    </div>
  );
};
