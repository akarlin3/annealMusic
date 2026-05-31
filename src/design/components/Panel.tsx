import React, { ReactNode } from 'react';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'modal' | 'drawer' | 'popover' | 'tooltip';
  isOpen?: boolean;
  onClose?: () => void;
  children: ReactNode;
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  (
    {
      variant = 'default',
      isOpen = true,
      onClose,
      children,
      className = '',
      ...props
    },
    ref,
  ) => {
    if (!isOpen) return null;

    let styleClass = '';

    if (variant === 'default') {
      styleClass = `
        rounded-sm border border-[var(--color-border)] bg-[var(--color-surf)]/65 backdrop-blur-md p-4 shadow-xl
      `;
    } else if (variant === 'modal') {
      styleClass = `
        fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4
      `;
    } else if (variant === 'drawer') {
      styleClass = `
        fixed top-0 right-0 bottom-0 z-40 w-80 max-w-[90vw] border-l border-[var(--color-border)]
        bg-[var(--color-surf)]/90 backdrop-blur-md p-6 shadow-2xl overflow-y-auto
      `;
    } else if (variant === 'popover') {
      styleClass = `
        absolute z-30 rounded border border-[var(--color-border)] bg-[var(--color-surf)]/95 backdrop-blur-md p-4 shadow-2xl
      `;
    } else if (variant === 'tooltip') {
      styleClass = `
        absolute z-50 rounded bg-stone-900 border border-stone-850 px-2 py-1 text-[9px] uppercase tracking-wider text-stone-300 shadow-md pointer-events-none
      `;
    }

    const transitionStyles = {
      transitionProperty: 'all',
      transitionDuration: 'calc(200ms * var(--motion-duration-multiplier, 1))',
      transitionTimingFunction: 'var(--motion-easing, ease-in-out)',
    };

    if (variant === 'modal') {
      return (
        <div
          ref={ref}
          className={styleClass}
          onClick={onClose}
          style={transitionStyles}
          {...props}
        >
          <div
            className="w-full max-w-md rounded-sm border border-[var(--color-border)] bg-[var(--color-surf)]/95 backdrop-blur-md p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={`${styleClass} ${className}`}
        style={transitionStyles}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Panel.displayName = 'Panel';
