import React, { useEffect, useState } from 'react';
import type { ResponseDefinition } from '../types';

interface ReactionTimeProps {
  definition: ResponseDefinition;
  onComplete: (rtMs: number, key: string) => void;
  disabled?: boolean;
}

export const ReactionTime: React.FC<ReactionTimeProps> = ({
  definition,
  onComplete,
  disabled = false,
}) => {
  const targetKey = definition.target_key || 'Space';
  const displayKeyName =
    targetKey === ' ' || targetKey === 'Space'
      ? 'SPACEBAR'
      : targetKey.toUpperCase();

  const [pressed, setPressed] = useState(false);
  const [mountTime] = useState(() => performance.now());

  useEffect(() => {
    if (disabled || pressed) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Treat e.code === 'Space' or e.key === ' ' as 'Space'
      const matchesSpace =
        targetKey.toLowerCase() === 'space' &&
        (e.code === 'Space' || e.key === ' ');
      const matchesKey =
        e.key.toLowerCase() === targetKey.toLowerCase() ||
        e.code.toLowerCase() === targetKey.toLowerCase();

      if (matchesSpace || matchesKey) {
        e.preventDefault();
        const endTime = performance.now();
        const rtMs = Math.round(endTime - mountTime);
        setPressed(true);
        onComplete(rtMs, e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [disabled, pressed, mountTime, targetKey, onComplete]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto p-4 text-center">
      <h3 className="text-lg font-mono text-stone-200 tracking-wide leading-relaxed">
        {definition.prompt}
      </h3>
      <div className="flex flex-col items-center gap-3 mt-4">
        <div
          className={`w-20 h-20 rounded-2xl flex items-center justify-center border font-mono text-lg transition-all ${
            pressed
              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/5 animate-pulse'
              : 'bg-stone-900 border-stone-800 text-stone-500 animate-pulse'
          }`}
        >
          {pressed ? '✓' : '●'}
        </div>
        <p className="text-xs font-mono tracking-widest text-stone-500 uppercase mt-2">
          {pressed
            ? 'Response registered!'
            : `Press [ ${displayKeyName} ] immediately when you detect the change`}
        </p>
      </div>
    </div>
  );
};
