import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', className = '', children, ...props }, ref) => {
    const baseStyle = `
      inline-flex items-center justify-center rounded-full font-mono text-[11px] uppercase tracking-[0.18em]
      cursor-pointer select-none transition-all outline-none focus-visible:ring-1 focus-visible:ring-amber-500
      active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
    `;

    let variantStyle = '';
    if (variant === 'primary') {
      variantStyle = `
        bg-[var(--color-accent)] text-[var(--bg-base)] font-semibold px-4 py-2 hover:brightness-110 shadow-md
      `;
    } else if (variant === 'secondary') {
      variantStyle = `
        border border-[var(--color-border)] text-[var(--color-text)] bg-[var(--color-surf)]/20 px-4 py-2 hover:bg-[var(--color-surf)]/50
      `;
    } else if (variant === 'ghost') {
      variantStyle = `
        text-[var(--color-muted)] hover:text-[var(--color-text)] px-3 py-1.5 bg-transparent
      `;
    } else if (variant === 'destructive') {
      variantStyle = `
        bg-red-950/20 border border-red-900/40 text-red-400 px-4 py-2 hover:bg-red-900/20
      `;
    }

    return (
      <button
        ref={ref}
        className={`${baseStyle} ${variantStyle} ${className}`}
        style={{
          transitionDuration:
            'calc(150ms * var(--motion-duration-multiplier, 1))',
          transitionTimingFunction: 'var(--motion-easing, ease-in-out)',
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
