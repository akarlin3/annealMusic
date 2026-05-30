import React, { useEffect } from 'react';
import type { ResponseDefinition } from '../types';

interface AdjustValueProps {
  definition: ResponseDefinition;
  value: number | null;
  onChange: (value: number) => void;
  onEngineParamChange: (param: string, value: number) => void;
  disabled?: boolean;
}

export const AdjustValue: React.FC<AdjustValueProps> = ({
  definition,
  value,
  onChange,
  onEngineParamChange,
  disabled = false,
}) => {
  const [min, max] = definition.range || [0, 1];
  const step = definition.step || 0.01;
  const paramName = definition.target_param || 'drift';

  // Default to midpoint of range if null
  const currentValue = value !== null ? value : (min + max) / 2;

  // Initialize value in state and update engine
  useEffect(() => {
    if (value === null) {
      onChange(currentValue);
    }
    onEngineParamChange(paramName, currentValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    onChange(val);
    onEngineParamChange(paramName, val);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto p-4">
      <h3 className="text-lg font-mono text-stone-200 text-center tracking-wide leading-relaxed">
        {definition.prompt}
      </h3>
      <div className="w-full flex flex-col gap-3 mt-4">
        <input
          type="range"
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={handleSliderChange}
          className="w-full h-1 bg-stone-900 border border-stone-850 rounded appearance-none cursor-pointer accent-amber-500 disabled:opacity-50"
        />
        <div className="flex justify-between w-full text-[10px] font-mono tracking-widest text-stone-500 uppercase">
          <span>Min: {min}</span>
          <span className="text-amber-500 font-semibold font-mono text-[11px]">
            Value: {currentValue.toFixed(3)}
          </span>
          <span>Max: {max}</span>
        </div>
      </div>
    </div>
  );
};
