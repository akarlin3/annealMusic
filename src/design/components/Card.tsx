import React, { ReactNode } from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, interactive = false, className = '', ...props }, ref) => {
    const baseStyle = `
      rounded border border-[var(--color-border)] bg-[var(--color-surf)]/40 p-4 transition-all
    `;

    const interactiveStyle = interactive
      ? 'cursor-pointer hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surf)]/60 hover:shadow-lg active:scale-[0.98]'
      : '';

    return (
      <div
        ref={ref}
        className={`${baseStyle} ${interactiveStyle} ${className}`}
        style={{
          transitionDuration:
            'calc(150ms * var(--motion-duration-multiplier, 1))',
          transitionTimingFunction: 'var(--motion-easing, ease-in-out)',
        }}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';
