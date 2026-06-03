import React, { useEffect, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface HelpTooltipProps {
  /** The title or name of the parameter. */
  title: string;
  /** Detailed description of what the parameter does. */
  description: string;
  /** Optional tips or best practices. */
  tips?: string;
  /** Optional custom position style. */
  style?: React.CSSProperties;
}

export function HelpTooltip({
  title,
  description,
  tips,
  style,
}: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <span
      className="help-tooltip-wrapper"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: '6px',
        ...style,
      }}
    >
      <button
        type="button"
        className="help-tooltip-trigger-btn"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        title={`Help for ${title}`}
        aria-label={`Help for ${title}`}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'var(--color-muted, #64748b)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.2s ease',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#818cf8';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-muted, #64748b)';
        }}
      >
        <HelpCircle size={14} strokeWidth={2} />
      </button>

      {/* Sliding Sidebar Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="help-sidebar-backdrop animate-fade-in"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(4px)',
              zIndex: 999,
              cursor: 'pointer',
            }}
          />

          {/* Sidebar Drawer */}
          <div
            className="help-sidebar-drawer animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              height: '100%',
              width: '350px',
              maxWidth: '85vw',
              background: 'rgba(15, 17, 23, 0.95)',
              backdropFilter: 'blur(20px)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              padding: '2rem 1.75rem',
              boxSizing: 'border-box',
              color: '#f8fafc',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.5rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                paddingBottom: '1rem',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#818cf8',
                  flexGrow: 1,
                }}
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close help sidebar"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '50%',
                  padding: '6px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s, color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.color = '#94a3b8';
                }}
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {/* Body */}
            <div
              style={{
                flexGrow: 1,
                overflowY: 'auto',
                fontSize: '0.92rem',
                lineHeight: 1.6,
                color: '#cbd5e1',
              }}
            >
              <p style={{ marginTop: 0, marginBottom: '1.5rem' }}>
                {description}
              </p>

              {tips && (
                <div
                  style={{
                    background: 'rgba(129, 140, 248, 0.05)',
                    border: '1px solid rgba(129, 140, 248, 0.15)',
                    borderRadius: '8px',
                    padding: '1rem',
                    boxSizing: 'border-box',
                  }}
                >
                  <h4
                    style={{
                      margin: '0 0 0.5rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#a5b4fc',
                    }}
                  >
                    Tip
                  </h4>
                  <p
                    style={{ margin: 0, fontSize: '0.85rem', color: '#a5b4fc' }}
                  >
                    {tips}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                paddingTop: '1rem',
                marginTop: '1rem',
              }}
            >
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                  background: '#818cf8',
                  color: '#0b0c10',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#9fa8f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#818cf8';
                }}
              >
                Close Help
              </button>
            </div>
          </div>
        </>
      )}
    </span>
  );
}
