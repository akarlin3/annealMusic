import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, children, className = '', ...props }, ref) => {
    const baseStyle = `
      w-full rounded bg-[var(--color-surf)]/60 px-3 py-2 font-mono text-[11px] outline-none border border-[var(--color-border)]
      text-[var(--color-text)] transition-all focus:border-[var(--color-accent)]/80 focus:ring-1 focus:ring-[var(--color-accent)]/30
      disabled:opacity-40 disabled:cursor-not-allowed appearance-none cursor-pointer
    `;

    const wrapperStyle = 'relative flex flex-col w-full';

    const arrowSvg = (
      <div className="absolute right-3 bottom-2.5 pointer-events-none text-[var(--color-muted)] flex items-center justify-center">
        <svg
          width="8"
          height="8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    );

    const transitionStyles = {
      transitionDuration: 'calc(150ms * var(--motion-duration-multiplier, 1))',
      transitionTimingFunction: 'var(--motion-easing, ease-in-out)',
    };

    return (
      <div className={wrapperStyle}>
        {label && (
          <span className="mb-1.5 block text-[9px] uppercase tracking-wider text-[var(--color-muted)] font-mono">
            {label}
          </span>
        )}
        <div className="relative w-full">
          <select
            ref={ref}
            className={`${baseStyle} ${className}`}
            style={transitionStyles}
            {...props}
          >
            {children}
          </select>
          {arrowSvg}
        </div>
      </div>
    );
  },
);

Select.displayName = 'Select';
