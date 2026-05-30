import React, { useEffect, useState, useRef } from 'react';
import type { ResponseDefinition } from '../types';

interface ContinuousProps {
  definition: ResponseDefinition;
  onSample: (timeMs: number, value: number) => void;
  disabled?: boolean;
}

export const Continuous: React.FC<ContinuousProps> = ({
  definition,
  onSample,
  disabled = false,
}) => {
  const scaleMax = definition.scale || 100;
  const [sliderVal, setSliderVal] = useState<number>(scaleMax / 2);
  const sliderValRef = useRef<number>(scaleMax / 2);

  // Update ref to avoid stale closure in interval
  useEffect(() => {
    sliderValRef.current = sliderVal;
  }, [sliderVal]);

  useEffect(() => {
    if (disabled) return;

    const mountTime = performance.now();
    const intervalMs = 1000 / 30; // 30Hz (~33.3ms)

    const timer = setInterval(() => {
      const elapsedMs = Math.round(performance.now() - mountTime);
      onSample(elapsedMs, sliderValRef.current);
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [disabled, onSample]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderVal(Number(e.target.value));
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto p-4 text-center">
      <h3 className="text-lg font-mono text-stone-200 tracking-wide leading-relaxed">
        {definition.prompt}
      </h3>
      <div className="w-full flex flex-col gap-3 mt-4">
        <input
          type="range"
          disabled={disabled}
          min="0"
          max={scaleMax}
          step="1"
          value={sliderVal}
          onChange={handleSliderChange}
          className="w-full h-1 bg-stone-900 border border-stone-850 rounded appearance-none cursor-pointer accent-amber-500 disabled:opacity-50"
        />
        <div className="flex justify-between w-full text-[10px] font-mono tracking-widest text-stone-500 uppercase">
          <span>Low Perception</span>
          <span className="text-amber-500 font-semibold font-mono text-[11px]">
            Realtime: {sliderVal}
          </span>
          <span>High Perception</span>
        </div>
      </div>
    </div>
  );
};
