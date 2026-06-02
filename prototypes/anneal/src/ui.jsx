// ui.jsx — shared primitives: line icons, range, chips, nav, breath overlay
const { useState: useUState, useEffect: useUEffect, useRef: useURef } = React;

// ── Line icons (calm, 1.5 stroke; stroke-width adapts via getIconProps idea) ──
const ICON_PATHS = {
  play: <path d="M5 3.2v9.6L13 8 5 3.2Z" />,
  listen: <g><circle cx="8" cy="8" r="2.1" /><path d="M3.2 8a4.8 4.8 0 0 1 9.6 0M1.3 8a6.7 6.7 0 0 1 13.4 0" /></g>,
  breathe: <g><circle cx="8" cy="8" r="5.4" /><circle cx="8" cy="8" r="2" /></g>,
  library: <g><rect x="2.4" y="2.4" width="4.4" height="4.4" rx="0.6" /><rect x="9.2" y="2.4" width="4.4" height="4.4" rx="0.6" /><rect x="2.4" y="9.2" width="4.4" height="4.4" rx="0.6" /><rect x="9.2" y="9.2" width="4.4" height="4.4" rx="0.6" /></g>,
  history: <g><circle cx="8" cy="8" r="5.6" /><path d="M8 4.6V8l2.4 1.6" /></g>,
  learn: <g><path d="M2.6 4.2A1.4 1.4 0 0 1 4 2.8h3.2A1 1 0 0 1 8 3.6v9a1 1 0 0 0-.8-.4H4a1.4 1.4 0 0 1-1.4-1.4Z" /><path d="M13.4 4.2A1.4 1.4 0 0 0 12 2.8H8.8A1 1 0 0 0 8 3.6v9a1 1 0 0 1 .8-.4H12a1.4 1.4 0 0 0 1.4-1.4Z" /></g>,
  sliders: <g><path d="M3 4.5h6M11 4.5h2M3 11.5h2M7 11.5h6" /><circle cx="10" cy="4.5" r="1.4" /><circle cx="5.5" cy="11.5" r="1.4" /></g>,
  arrowLeft: <path d="M9.5 3.5 5 8l4.5 4.5" />,
  arrowRight: <path d="M6.5 3.5 11 8l-4.5 4.5" />,
  check: <path d="M3.2 8.4 6.4 11.6 12.8 4.4" />,
  x: <path d="M4 4l8 8M12 4l-8 8" />,
  trash: <g><path d="M3.5 4.5h9M6 4.5V3.2h4v1.3M5 4.5l.6 8h4.8l.6-8" /></g>,
  morning: <g><circle cx="8" cy="8.4" r="2.6" /><path d="M8 2.4v1.4M13 8.4h-1.4M4.4 8.4H3M11.5 4.9l-1 1M5.5 5.9l-1-1" /></g>,
  evening: <path d="M11.6 9.4A4.4 4.4 0 1 1 6.6 4.4 3.6 3.6 0 0 0 11.6 9.4Z" />,
  focus: <g><circle cx="8" cy="8" r="5.4" /><circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" /></g>,
  sounds: <g><path d="M2 8h1.6M12.4 8H14" /><path d="M4.6 5v6M7.2 2.6v10.8M9.8 4v8M12.4 6.2v3.6" /></g>,
  attune: <path d="M1.6 8h3l1.4-3.4 2.4 6L11 8h3.4" />,
  gallery: <g><circle cx="6" cy="6" r="3.4" /><circle cx="10.4" cy="10" r="3.4" /></g>,
  research: <g><path d="M2.5 13.5h11" /><path d="M4 13.5V8M7 13.5V5M10 13.5V9.5M13 13.5V3.5" /></g>,
  gear: <g><circle cx="8" cy="8" r="2.3" /><path d="M8 1.6v2.1M8 12.3v2.1M1.6 8h2.1M12.3 8h2.1M3.5 3.5l1.5 1.5M11 11l1.5 1.5M12.5 3.5 11 5M5 11l-1.5 1.5" /></g>,
  dot: <circle cx="8" cy="8" r="2.4" fill="currentColor" stroke="none" />,
};

function Icon({ name, size = 16, sw = 1.5, style, className }) {
  const p = ICON_PATHS[name] || ICON_PATHS.dot;
  const fillName = name === 'play';
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={fillName ? 'currentColor' : 'none'}
      stroke={fillName ? 'none' : 'currentColor'} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={style} className={className} aria-hidden="true">{p}</svg>
  );
}

// ── Range slider ──
function Range({ value, min, max, step, disabled, onChange }) {
  return (
    <input type="range" className="am-range" min={min} max={max} step={step}
      value={value} disabled={disabled}
      onChange={(e) => onChange(parseFloat(e.target.value))} />
  );
}

// ── Chip ──
function Chip({ children, active, onClick, as = 'button' }) {
  const cls = 'chip font-mono' + (active ? ' is-active' : '');
  if (as === 'span') return <span className={cls}>{children}</span>;
  return <button className={cls} onClick={onClick}>{children}</button>;
}

// ── Progress dots (• • ◦ ◦) ──
function ProgressDots({ total, current }) {
  return (
    <div className="dots" aria-label={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={'dot' + (i <= current ? ' filled' : '')} />
      ))}
    </div>
  );
}

// ── Mode toggle (three voices) ──
function ModeToggle({ mode, onChange, compact }) {
  return (
    <div className={'mode-toggle font-mono' + (compact ? ' compact' : '')} role="tablist" aria-label="Voice">
      {MODE_ORDER.map((m) => (
        <button key={m} role="tab" aria-selected={m === mode}
          className={'mode-tab' + (m === mode ? ' is-active' : '')}
          onClick={() => onChange(m)}>{compact ? MODE_META[m].label[0] : MODE_META[m].label}</button>
      ))}
    </div>
  );
}

// ── Top navigation: 5 intent-based groups + Settings ──
// Each group owns one or more routes; grouped routes get a calm sub-nav.
const NAV_GROUPS = [
  { id: 'listen',  label: 'Listen',  icon: 'listen',  children: [{ route: 'listen', label: 'Listen' }] },
  { id: 'sounds',  label: 'Sounds',  icon: 'sounds',  children: [
      { route: 'sounds',  label: 'Presets' },
      { route: 'library', label: 'Curated' },
      { route: 'gallery', label: 'Community' },
  ] },
  { id: 'breathe', label: 'Breathe', icon: 'breathe', children: [
      { route: 'breathe', label: 'Paced' },
      { route: 'attune',  label: 'Biofeedback' },
  ] },
  { id: 'learn',   label: 'Learn',   icon: 'learn',   children: [
      { route: 'learn',    label: 'Lessons' },
      { route: 'research', label: 'Studies' },
  ] },
  { id: 'history', label: 'History', icon: 'history', children: [{ route: 'history', label: 'History' }] },
];

function groupForRoute(route) {
  return NAV_GROUPS.find((g) => g.children.some((c) => c.route === route));
}

function TopNav({ route, navigate, mode, setMode, immersive }) {
  const active = groupForRoute(route);
  return (
    <header className={'topnav' + (immersive ? ' immersive chrome' : '')}>
      <button className="brand" onClick={() => navigate('listen')}>
        <span className="wordmark font-display">Anneal</span>
      </button>
      <nav className="nav-links font-mono">
        {NAV_GROUPS.map((g) => (
          <button key={g.id} className={'nav-link' + (active && active.id === g.id ? ' is-active' : '')}
            onClick={() => navigate(g.children[0].route)} title={g.label}>
            <Icon name={g.icon} size={14} />
            <span>{g.label}</span>
          </button>
        ))}
      </nav>
      <div className="topnav-right">
        <button className={'gear-btn' + (route === 'settings' ? ' is-active' : '')} onClick={() => navigate('settings')} aria-label="Settings" title="Settings"><Icon name="gear" size={16} /></button>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>
    </header>
  );
}

// ── Sub-nav: segmented pill for grouped destinations (recedes on immersive routes) ──
function SubNav({ route, navigate }) {
  const group = groupForRoute(route);
  if (!group || group.children.length < 2) return null;
  return (
    <div className="subnav chrome font-mono">
      <div className="subnav-pill">
        {group.children.map((c) => (
          <button key={c.route} className={'subnav-tab' + (c.route === route ? ' is-active' : '')}
            onClick={() => navigate(c.route)}>{c.label}</button>
        ))}
      </div>
    </div>
  );
}

// ── Breath pacing overlay (visual-only) ──
function BreathOverlay({ tuple, active, reduceMotion, big }) {
  const [phase, setPhase] = useUState({ name: 'Inhale', scale: 0.42 });
  const rafRef = useURef(null), startRef = useURef(0);
  useUEffect(() => {
    if (!active) return;
    const [inhale, holdF, exhale, holdE] = tuple;
    const cycle = inhale + holdF + exhale + holdE;
    startRef.current = performance.now();
    if (reduceMotion) { setPhase({ name: 'Breathe gently', scale: 0.62 }); return; }
    const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
    const loop = (now) => {
      const tt = ((now - startRef.current) / 1000) % cycle;
      let name, scale;
      if (tt < inhale) { name = 'Inhale'; scale = 0.42 + 0.46 * ease(tt / inhale); }
      else if (tt < inhale + holdF) { name = 'Hold'; scale = 0.88; }
      else if (tt < inhale + holdF + exhale) { name = 'Exhale'; scale = 0.88 - 0.46 * ease((tt - inhale - holdF) / exhale); }
      else { name = holdE > 0.05 ? 'Hold' : 'Rest'; scale = 0.42; }
      setPhase({ name, scale });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active, tuple, reduceMotion]);

  if (!active) return null;
  const dim = Math.min(window.innerWidth, window.innerHeight);
  const size = dim * (big ? 0.52 : 0.44);
  return (
    <div className="breath-layer" aria-hidden="true">
      <div className="breath-ring" style={{ width: size, height: size, transform: `translate(-50%,-50%) scale(${phase.scale})`, transition: reduceMotion ? 'none' : 'transform 0.4s linear' }} />
      <div className="breath-core" style={{ width: size * 0.84, height: size * 0.84, transform: `translate(-50%,-50%) scale(${phase.scale})`, transition: reduceMotion ? 'none' : 'transform 0.4s linear' }} />
      <div className="breath-label font-mono">{phase.name}</div>
    </div>
  );
}

Object.assign(window, { Icon, Range, Chip, ProgressDots, ModeToggle, TopNav, SubNav, BreathOverlay, NAV_GROUPS, groupForRoute });
