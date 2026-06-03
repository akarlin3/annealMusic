import React, { useId } from 'react';

export interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  valueDisplay?: string | number;
}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ label, valueDisplay, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className={`flex flex-col w-full select-none ${className}`}>
        {label && (
          <div className="flex items-center justify-between mb-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-muted)]">
            <label htmlFor={inputId}>{label}</label>
            {valueDisplay !== undefined && (
              <span className="text-[var(--color-text)] font-semibold font-mono tabular-nums">
                {valueDisplay}
              </span>
            )}
          </div>
        )}
        <div className="relative flex items-center h-11 w-full">
          {/* Touch-safe overlay wrapper ensures a 44px min hit zone */}
          <input
            ref={ref}
            id={inputId}
            type="range"
            className="
              am-range w-full appearance-none h-[2px] rounded-full outline-none cursor-pointer bg-[var(--color-border)]
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-accent)]
              [&::-webkit-slider-thumb]:hover:scale-125 [&::-webkit-slider-thumb]:transition-transform
              [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_var(--accent-glow)]
              [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-[var(--color-accent)]
              [&::-moz-range-thumb]:hover:scale-125 [&::-moz-range-thumb]:transition-transform
              disabled:opacity-40 disabled:cursor-not-allowed
            "
            style={{
              accentColor: 'var(--color-accent)',
            }}
            {...props}
          />
        </div>
      </div>
    );
  },
);

Slider.displayName = 'Slider';
