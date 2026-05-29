import React from 'react';

interface LissajousAvatarProps {
  seed: string;
  size?: number;
}

export const LissajousAvatar: React.FC<LissajousAvatarProps> = ({
  seed,
  size = 64,
}) => {
  // Generate deterministic parameters from seed string
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Get pseudo-random values from the hash
  const getVal = (idx: number, min: number, max: number) => {
    const val = Math.abs(Math.sin(hash + idx) * 10000) % 1;
    return min + val * (max - min);
  };

  const a = Math.round(getVal(1, 2, 7)); // X frequency
  const b = Math.round(getVal(2, 2, 7)); // Y frequency
  const delta = getVal(3, 0, Math.PI * 2); // Phase shift
  const opacity = getVal(4, 0.75, 0.95);
  const strokeWidth = getVal(5, 1.8, 2.8);
  const color1 = '#f59e0b'; // Amber
  const color2 = '#d97706'; // Warm dark amber

  // Generate path points
  const points: string[] = [];
  const steps = 240;
  const scale = 75;

  for (let i = 0; i <= steps; i++) {
    // Multiply by standard step ratio
    const theta = (i / steps) * Math.PI * 2 * (a === b ? 1 : Math.min(a, b));
    const x = scale * Math.sin(a * theta + delta);
    const y = scale * Math.sin(b * theta);
    points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  const d = points.join(' ');

  return (
    <svg
      width={size}
      height={size}
      viewBox="-100 -100 200 200"
      aria-hidden="true"
      style={{
        background: '#1c1917',
        borderRadius: '50%',
        border: '1px solid #44403c',
        display: 'inline-block',
      }}
    >
      <defs>
        <linearGradient id={`grad-${seed}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color1} stopOpacity={opacity} />
          <stop offset="100%" stopColor={color2} stopOpacity={opacity * 0.6} />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Background polar concentric circles */}
      <circle
        r="85"
        fill="none"
        stroke="#292524"
        strokeWidth="0.5"
        strokeDasharray="3 3"
      />
      <circle
        r="55"
        fill="none"
        stroke="#292524"
        strokeWidth="0.5"
        strokeDasharray="3 3"
      />
      <circle
        r="25"
        fill="none"
        stroke="#292524"
        strokeWidth="0.5"
        strokeDasharray="3 3"
      />
      <line
        x1="-90"
        y1="0"
        x2="90"
        y2="0"
        stroke="#292524"
        strokeWidth="0.5"
        strokeDasharray="3 3"
      />
      <line
        x1="0"
        y1="-90"
        x2="0"
        y2="90"
        stroke="#292524"
        strokeWidth="0.5"
        strokeDasharray="3 3"
      />

      {/* Lissajous resonant path */}
      <path
        d={d}
        fill="none"
        stroke={`url(#grad-${seed})`}
        strokeWidth={strokeWidth.toFixed(1)}
        filter="url(#glow)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
