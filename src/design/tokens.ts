// tokens.ts
export const tokens = {
  color: {
    base: {
      meditation: '#090706', // deeper dark
      musician: '#0c0a09', // standard dark
      researcher: '#0f0d0c', // slightly lighter dark for contrast
    },
    surface: {
      meditation: '#141210',
      musician: '#1c1917',
      researcher: '#1f1c1a',
    },
    border: {
      meditation: '#1c1917',
      musician: '#292524',
      researcher: '#3c3633',
    },
    text: {
      meditation: '#e7e5e4',
      musician: '#f5f5f4',
      researcher: '#fafaf9',
    },
    muted: {
      meditation: '#a8a29e',
      musician: '#78716c',
      researcher: '#d6d3d1',
    },
    accent: {
      meditation: 'hsl(38, 90%, 45%)',
      musician: 'hsl(38, 92%, 50%)',
      researcher: 'hsl(38, 70%, 48%)',
    },
    accentRgb: {
      meditation: '217, 119, 6',
      musician: '245, 158, 11',
      researcher: '202, 138, 4',
    },
    accentGlow: {
      meditation: 'rgba(217, 119, 6, 0.04)',
      musician: 'rgba(245, 158, 11, 0.15)',
      researcher: 'rgba(202, 138, 4, 0.09)',
    },
  },
  type: {
    family: {
      display: "'Instrument Serif', Georgia, serif",
      body: "'Geist', system-ui, sans-serif",
      mono: "'Geist Mono', ui-monospace, monospace",
    },
    weight: {
      meditation: {
        body: '300',
        head: '400',
      },
      musician: {
        body: '400',
        head: '600',
      },
      researcher: {
        body: '450',
        head: '700',
      },
    },
    lineHeight: {
      meditation: '1.75',
      musician: '1.5',
      researcher: '1.4',
    },
  },
  motion: {
    duration: {
      meditation: '1.2',
      musician: '1.0',
      researcher: '0.8',
    },
    easing: {
      meditation: 'cubic-bezier(0.4, 0, 0.2, 1)',
      musician: 'cubic-bezier(0.4, 0, 0.2, 1)',
      researcher: 'cubic-bezier(0, 0, 0.2, 1)',
    },
  },
  spacing: {
    density: {
      meditation: '1.15',
      musician: '1.0',
      researcher: '0.85',
    },
  },
  ornament: {
    opacity: {
      meditation: '0.08',
      musician: '0.4',
      researcher: '0.8',
    },
  },
};

export function getIconProps(
  mode: 'meditation' | 'musician' | 'researcher' | null,
) {
  const active = mode || 'musician';
  return {
    strokeWidth:
      active === 'meditation' ? 1.2 : active === 'researcher' ? 2.2 : 1.8,
  };
}
