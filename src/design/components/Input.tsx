import React, { useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  multiline?: boolean;
  rows?: number;
  label?: string;
}

export const Input = React.forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  InputProps
>(
  (
    { multiline = false, rows = 3, label, className = '', id, ...props },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    const baseStyle = `
      w-full rounded bg-[var(--color-surf)]/60 px-3 py-2 font-mono text-[11px] outline-none border border-[var(--color-border)]
      text-[var(--color-text)] transition-all focus:border-[var(--color-accent)]/80 focus:ring-1 focus:ring-[var(--color-accent)]/30
      placeholder:text-[var(--color-muted)]/50 disabled:opacity-40 disabled:cursor-not-allowed
    `;

    const transitionStyles = {
      transitionDuration: 'calc(150ms * var(--motion-duration-multiplier, 1))',
      transitionTimingFunction: 'var(--motion-easing, ease-in-out)',
    };

    return (
      <div className="flex flex-col w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-[9px] uppercase tracking-wider text-[var(--color-muted)] font-mono"
          >
            {label}
          </label>
        )}
        {multiline ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            id={inputId}
            rows={rows}
            className={`${baseStyle} resize-none ${className}`}
            style={transitionStyles}
            {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            id={inputId}
            className={`${baseStyle} ${className}`}
            style={transitionStyles}
            {...props}
          />
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
