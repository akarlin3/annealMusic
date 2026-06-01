// data.jsx — AnnealMusic v9.1 design tokens, content & shared app state
// Tokens sourced verbatim from src/design/tokens.ts; content from src/content/presets.ts,
// docs/LIBRARY.md, docs/LEARN.md, src/history/SessionHistoryPage.tsx.

// ───────────────────────── Mode aesthetic system ─────────────────────────
const MODE_TOKENS = {
  meditation: {
    base: '#090706', surf: '#141210', border: '#1c1917',
    text: '#e7e5e4', muted: '#a8a29e',
    accentSat: 90, accentLight: 45, accentRgb: '217, 119, 6', accentGlow: 0.04,
    bodyWeight: 300, headWeight: 400, lineHeight: 1.75,
    density: 1.15, motionMult: 1.2, ornament: 0.08, chrome: 0.15,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    visSpeed: 0.45, visBright: 0.45, telemetry: false, spectrum: false,
  },
  musician: {
    base: '#0c0a09', surf: '#1c1917', border: '#292524',
    text: '#f5f5f4', muted: '#78716c',
    accentSat: 92, accentLight: 50, accentRgb: '245, 158, 11', accentGlow: 0.15,
    bodyWeight: 400, headWeight: 600, lineHeight: 1.5,
    density: 1.0, motionMult: 1.0, ornament: 0.4, chrome: 1.0,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    visSpeed: 1.0, visBright: 1.0, telemetry: false, spectrum: false,
  },
  researcher: {
    base: '#0f0d0c', surf: '#1f1c1a', border: '#3c3633',
    text: '#fafaf9', muted: '#d6d3d1',
    accentSat: 70, accentLight: 48, accentRgb: '202, 138, 4', accentGlow: 0.09,
    bodyWeight: 450, headWeight: 700, lineHeight: 1.4,
    density: 0.85, motionMult: 0.8, ornament: 0.8, chrome: 1.0,
    easing: 'cubic-bezier(0, 0, 0.2, 1)',
    visSpeed: 1.0, visBright: 1.0, telemetry: true, spectrum: true,
  },
};

const MODE_META = {
  meditation: { label: 'Meditation', tagline: 'Settle into the field. Controls recede; the breath leads.', verb: { begin: 'Begin', end: 'Settle' } },
  musician:   { label: 'Musician',   tagline: 'Sculpt the harmonic lattice. Full tactile control, fast feedback.', verb: { begin: 'Sound', end: 'Stop' } },
  researcher: { label: 'Researcher', tagline: 'Coupled oscillators over an Ornstein–Uhlenbeck drift. Telemetry on.', verb: { begin: 'Run', end: 'Halt' } },
};
const MODE_ORDER = ['meditation', 'musician', 'researcher'];

const BREATH_PATTERNS = {
  box:       { label: 'Box · 4-4-4-4',      tuple: [4, 4, 4, 4],      note: 'Equal inhale, hold, exhale, hold. Steadying for many.' },
  '4-7-8':   { label: '4-7-8',              tuple: [4, 7, 8, 0],      note: 'Popularized by Andrew Weil. Calming for many practitioners.' },
  coherent:  { label: 'Coherent · 5.5/min', tuple: [5.5, 0, 5.5, 0],  note: 'Slow even breathing, ~5.5 breaths per minute.' },
  resonance: { label: 'Resonance · 4.5/min',tuple: [6, 0, 6.5, 0],    note: 'A slightly slower paced breath used in HRV work.' },
};

function resolvePalette(mode, hueShift = 0) {
  const t = MODE_TOKENS[mode];
  const hue = 38 + hueShift;
  return {
    ...t, hue,
    accent: `hsl(${hue}, ${t.accentSat}%, ${t.accentLight}%)`,
    accentSoft: `hsl(${hue}, ${t.accentSat}%, ${Math.min(88, t.accentLight + 38)}%)`,
  };
}

function applyModeVars(el, mode, tweaks) {
  const t = resolvePalette(mode, tweaks.hueShift);
  const scale = tweaks.typeScale ?? 1;
  const dens = (tweaks.densityScale ?? 1) * t.density;
  const set = (k, v) => el.style.setProperty(k, v);
  set('--bg', t.base); set('--surf', t.surf); set('--border', t.border);
  set('--text', t.text); set('--muted', t.muted);
  set('--accent', t.accent); set('--accent-soft', t.accentSoft); set('--accent-rgb', t.accentRgb);
  set('--hue', String(t.hue));
  set('--body-weight', String(t.bodyWeight)); set('--head-weight', String(t.headWeight));
  set('--line-height', String(t.lineHeight)); set('--space', String(dens));
  set('--ornament', String(t.ornament));
  set('--chrome', String(tweaks.alwaysShowChrome ? 1 : t.chrome));
  set('--motion', String(t.motionMult)); set('--easing', t.easing);
  set('--type-scale', String(scale));
}

// ───────────────────────── Engine defaults ─────────────────────────
const HARMONICS = [1, 1.5, 2, 2.5, 3, 4, 5, 6];
const ENGINE_DEFAULTS = {
  rootFreq: 110, spread: 1.0, density: 6,
  coupling: 0.3, drift: 0.5, brightness: 0.5, space: 0.4, volume: 0.35,
};

// ───────────────────────── Library (curated sessions) ─────────────────────────
// Each wraps a source patch; params map straight into the live sine engine.
const LIBRARY = [
  { id: 'cosmic-hum', title: 'Cosmic Hum', intention: 'Sleep', lengthMin: 30, character: ['Drone', 'No spoken word'], pick: true,
    note: 'Deep, slow-breathing waves for comforting rest.',
    params: { rootFreq: 55, spread: 0.75, density: 4, coupling: 0.8, drift: 0.3, brightness: 0.2, space: 0.6 } },
  { id: 'aurora-glow', title: 'Aurora Glow', intention: 'Evening', lengthMin: 25, character: ['Drone', 'With tunings'], pick: true,
    note: 'Warm sweeping waves that shift across the night sky.',
    params: { rootFreq: 82, spread: 0.9, density: 5, coupling: 0.85, drift: 0.5, brightness: 0.35, space: 0.75 } },
  { id: 'zen-garden', title: 'Zen Garden', intention: 'Focus', lengthMin: 15, character: ['Drone', 'No spoken word'], pick: true,
    note: 'Absolute simplicity. Deep quiet breaths, maximum clarity.',
    params: { rootFreq: 98, spread: 1.0, density: 3, coupling: 0.5, drift: 0.2, brightness: 0.3, space: 0.65 } },
  { id: 'stellar-nursery', title: 'Stellar Nursery', intention: 'Morning', lengthMin: 12, character: ['Drone', 'With tunings'],
    note: 'Gentle high newborn stars drifting in deep space.',
    params: { rootFreq: 220, spread: 1.25, density: 5, coupling: 0.7, drift: 0.4, brightness: 0.6, space: 0.9 } },
  { id: 'tibetan-bowls', title: 'Tibetan Bowls', intention: 'Open practice', lengthMin: 20, character: ['With bells', 'Drone'], pick: true,
    note: 'Rich metallic vibrations of singing bowls in a quiet sanctuary.',
    params: { rootFreq: 87, spread: 1.15, density: 5, coupling: 0.25, drift: 0.7, brightness: 0.6, space: 0.75 } },
  { id: 'forest-whispers', title: 'Forest Whispers', intention: 'Difficult day', lengthMin: 22, character: ['Drone', 'No spoken word'],
    note: 'Rustling leaves and soft wind through pine branches.',
    params: { rootFreq: 110, spread: 1.3, density: 6, coupling: 0.5, drift: 0.7, brightness: 0.4, space: 0.65 } },
  { id: 'warm-hearth', title: 'Warm Hearth', intention: 'Evening', lengthMin: 40, character: ['Drone'],
    note: 'Crackling embers glowing on a winter night.',
    params: { rootFreq: 65, spread: 0.9, density: 5, coupling: 0.6, drift: 0.5, brightness: 0.45, space: 0.5 } },
  { id: 'monastery-drone', title: 'Monastery Drone', intention: 'Open practice', lengthMin: 35, character: ['Drone', 'With tunings'],
    note: 'Resonant throat-singing-like pipes vibrating in unison.',
    params: { rootFreq: 65, spread: 0.96, density: 6, coupling: 0.85, drift: 0.4, brightness: 0.4, space: 0.8 } },
  { id: 'ocean-froth', title: 'Ocean Froth', intention: 'Sleep', lengthMin: 45, character: ['Drone', 'No spoken word'],
    note: 'Waves washing over pebbles, fading into white foam.',
    params: { rootFreq: 73, spread: 1.15, density: 4, coupling: 0.8, drift: 0.8, brightness: 0.3, space: 0.8 } },
  { id: 'string-quartet', title: 'String Quartet', intention: 'Focus', lengthMin: 16, character: ['Composed'],
    note: 'Rich resonant bowed strings playing in unison.',
    params: { rootFreq: 73, spread: 0.92, density: 6, coupling: 0.65, drift: 0.5, brightness: 0.4, space: 0.8 } },
  { id: 'lunar-cradle', title: 'Lunar Cradle', intention: 'Sleep', lengthMin: 50, character: ['Drone', 'No spoken word'],
    note: 'A soft protective envelope that feels like weightless sleep.',
    params: { rootFreq: 65, spread: 0.8, density: 4, coupling: 0.95, drift: 0.25, brightness: 0.25, space: 0.8 } },
  { id: 'sacred-temple-bell', title: 'Sacred Temple Bell', intention: 'Closing the week', lengthMin: 18, character: ['With bells'],
    note: 'A single deep strike blooming into harmonic metallic layers.',
    params: { rootFreq: 60, spread: 1.5, density: 6, coupling: 0.3, drift: 0.4, brightness: 0.55, space: 0.85 } },
];

const INTENTIONS = ['Morning', 'Evening', 'Sleep', 'Difficult day', 'Focus', 'Open practice', 'Closing the week'];
const LENGTHS = [
  { id: 'short', label: 'Short', test: (m) => m <= 10 },
  { id: 'medium', label: 'Medium', test: (m) => m > 10 && m <= 25 },
  { id: 'long', label: 'Long', test: (m) => m > 25 && m <= 45 },
  { id: 'extended', label: 'Extended', test: (m) => m > 45 },
];
const CHARACTERS = ['Drone', 'Composed', 'No spoken word', 'With bells', 'With tunings'];

// ───────────────────────── Learn (curriculum) ─────────────────────────
const LESSONS = [
  {
    id: 'what-is-drift', track: 'Phase-coupled synthesis', difficulty: 'intro', minutes: 6,
    title: 'What is drift?', summary: 'How slow random walks keep a drone alive and breathing.',
    steps: [
      { type: 'text', title: 'A drone that never sits still', body: 'Pure sine tones held forever sound dead. Anneal keeps each partial gently wandering — a slow random walk on its detune, in cents. This is an Ornstein–Uhlenbeck process: noise pushes the pitch around, while a weak spring pulls it home.', takeaways: ['Drift = controlled randomness on pitch', 'It is what makes a sustained tone feel alive', 'Measured in cents (1/100th of a semitone)'] },
      { type: 'demo', title: 'Hear it move', body: 'This patch sets drift high. Listen for the slow beating between partials as their pitches wander apart and back.', patch: { rootFreq: 110, spread: 1.0, density: 5, coupling: 0.2, drift: 0.85, brightness: 0.45, space: 0.6 }, highlight: 'drift' },
      { type: 'prompt', title: 'Find the stillness', body: 'Pull Drift down toward zero. Notice how the field freezes into a static, glassy chord. Then bring it back up.', allow: ['drift'], hint: 'Lower drift = stiller pitch; higher = more wander.' },
      { type: 'reflection', title: 'What did you notice?', question: 'How did the sound change as you moved drift? Did one setting feel more restful than another?' },
    ],
  },
  {
    id: 'coupling-sync', track: 'Phase-coupled synthesis', difficulty: 'intermediate', minutes: 8,
    title: 'Coupling & synchronization', summary: 'Why partials pull toward each other — the Kuramoto model.',
    steps: [
      { type: 'text', title: 'Oscillators that listen', body: 'Each partial drifts on its own, but coupling makes them pull toward the group average — the Kuramoto model of synchronization. High coupling locks the field into a tight, unified pitch; low coupling lets it scatter.', takeaways: ['Coupling pulls partials toward consensus', 'High coupling → unified, locked drone', 'Low coupling → scattered, shimmering field'] },
      { type: 'demo', title: 'A locked field', body: 'Coupling is near maximum here. The partials hold together almost as one voice.', patch: { rootFreq: 98, spread: 1.0, density: 6, coupling: 0.95, drift: 0.6, brightness: 0.4, space: 0.7 }, highlight: 'coupling' },
      { type: 'prompt', title: 'Break the lock', body: 'Lower Coupling until the unified tone breaks apart into separate wandering voices. Where does it stop sounding like one instrument?', allow: ['coupling', 'drift'], hint: 'Try coupling below 0.2 with drift around 0.6.' },
      { type: 'reflection', title: 'Consensus vs. chaos', question: 'At what point did the single voice become a crowd? Which did you prefer?' },
    ],
  },
  {
    id: 'harmonic-lattice', track: 'Physical acoustics', difficulty: 'intro', minutes: 5,
    title: 'The harmonic lattice', summary: 'Spread stretches the overtones — from pure to bell-like.',
    steps: [
      { type: 'text', title: 'Stacking overtones', body: 'Partials sit on a harmonic lattice: ratios 1, 1.5, 2, 2.5, 3… of the root. Spread raises each ratio to a power, stretching or compressing the stack. Stretched overtones sound metallic and bell-like; compressed ones sound hollow.', takeaways: ['Partials follow harmonic ratios of the root', 'Spread stretches or compresses the overtone stack', 'Stretched = bell-like; compressed = hollow'] },
      { type: 'demo', title: 'A bell from sine waves', body: 'High spread here pushes the overtones inharmonic — a glassy, bell-like timbre from pure sines.', patch: { rootFreq: 120, spread: 1.5, density: 6, coupling: 0.3, drift: 0.5, brightness: 0.65, space: 0.85 }, highlight: 'spread' },
      { type: 'prompt', title: 'Tune the timbre', body: 'Sweep Spread from 0.7 to 1.3 and listen to the timbre move from hollow to harmonic to bell-like.', allow: ['spread', 'rootFreq'], hint: 'Spread = 1.0 is the natural harmonic series.' },
      { type: 'reflection', title: 'Timbre & feeling', question: 'Which spread setting felt warmest to you? Which felt coldest?' },
    ],
  },
];

// ───────────────────────── History seed ─────────────────────────
const SEED_SESSIONS = [
  { id: 's1', title: 'Zen Garden', startedAt: '2026-05-30T21:14:00', minutes: 18, reflection: 'Came in scattered, left settled. The stillness around minute 10 was the point.' },
  { id: 's2', title: 'Open practice', startedAt: '2026-05-29T07:02:00', minutes: 12, reflection: '' },
  { id: 's3', title: 'Cosmic Hum', startedAt: '2026-05-27T22:48:00', minutes: 31, reflection: 'Fell asleep before it faded. No notes, just rest.' },
  { id: 's4', title: 'Aurora Glow', startedAt: '2026-05-25T20:30:00', minutes: 24, reflection: '' },
  { id: 's5', title: 'Tibetan Bowls', startedAt: '2026-05-22T18:05:00', minutes: 20, reflection: 'The bell character is just high spread + drift. Knowing that did not make it less calming.' },
];

// ───────────────────────── Gallery (creator-published patches) ─────────────────────────
const GALLERY_ITEMS = [
  { id: 'g1', title: 'Slow Tide at Dusk', creator: 'Anonymous', engine: 'granular', mode: 'meditation', loads: 1284, publishedAt: '2026-05-28', captures: true, preview: 'ready',
    description: 'Wide grains over a low swell. Best at low volume, eyes closed.',
    params: { rootFreq: 60, spread: 0.95, density: 5, coupling: 0.78, drift: 0.62, brightness: 0.32, space: 0.86 } },
  { id: 'g2', title: 'Iron Cathedral', creator: 'Anonymous', engine: 'fm', mode: 'musician', loads: 942, publishedAt: '2026-05-27', captures: true, preview: 'ready',
    description: 'A bowed-metal drone with long inharmonic tails. Two frozen loops underneath.',
    params: { rootFreq: 73, spread: 1.42, density: 6, coupling: 0.3, drift: 0.55, brightness: 0.62, space: 0.88 } },
  { id: 'g3', title: 'Resting Heart', creator: 'Anonymous', engine: 'sine', mode: 'meditation', loads: 2107, publishedAt: '2026-05-26', captures: false, preview: 'ready',
    description: 'Five partials, tight coupling, almost no drift. A held breath.',
    params: { rootFreq: 98, spread: 1.0, density: 5, coupling: 0.9, drift: 0.18, brightness: 0.35, space: 0.6 } },
  { id: 'g4', title: 'Telemetry 220', creator: 'Anonymous', engine: 'sine', mode: 'researcher', loads: 388, publishedAt: '2026-05-25', captures: false, preview: 'ready',
    description: 'Exactly tuned partials at 220·n for spectral inspection. Telemetry on.',
    params: { rootFreq: 110, spread: 1.0, density: 7, coupling: 0.5, drift: 0.4, brightness: 0.55, space: 0.5 } },
  { id: 'g5', title: 'Glass Rain', creator: 'Anonymous', engine: 'fm', mode: 'musician', loads: 1561, publishedAt: '2026-05-23', captures: true, preview: 'ready',
    description: 'High delicate bells scattered by low coupling and heavy drift.',
    params: { rootFreq: 261, spread: 1.55, density: 7, coupling: 0.2, drift: 0.82, brightness: 0.78, space: 0.9 } },
  { id: 'g6', title: 'Warp Lullaby', creator: 'Anonymous', engine: 'fm', mode: 'meditation', loads: 673, publishedAt: '2026-05-21', captures: false, preview: 'rendering',
    description: 'The starship core, slowed and softened into something to sleep to.',
    params: { rootFreq: 45, spread: 0.7, density: 5, coupling: 0.85, drift: 0.28, brightness: 0.24, space: 0.72 } },
  { id: 'g7', title: 'Pine Wind Study', creator: 'Anonymous', engine: 'granular', mode: 'researcher', loads: 254, publishedAt: '2026-05-19', captures: true, preview: 'ready',
    description: 'Grain density swept across a recorded pine canopy. Logged at 30 Hz.',
    params: { rootFreq: 110, spread: 1.3, density: 6, coupling: 0.45, drift: 0.7, brightness: 0.42, space: 0.66 } },
  { id: 'g8', title: 'Monastery, 3am', creator: 'Anonymous', engine: 'physical', mode: 'meditation', loads: 1893, publishedAt: '2026-05-17', captures: false, preview: 'ready',
    description: 'Continuously-excited tube model, throat-singing-like, deeply still.',
    params: { rootFreq: 65, spread: 0.96, density: 6, coupling: 0.85, drift: 0.4, brightness: 0.4, space: 0.82 } },
  { id: 'g9', title: 'Restless', creator: 'Anonymous', engine: 'fm', mode: 'musician', loads: 421, publishedAt: '2026-05-15', captures: true, preview: 'failed',
    description: 'Self-modulating nodes, almost no coupling. Not calm — on purpose.',
    params: { rootFreq: 98, spread: 1.45, density: 5, coupling: 0.18, drift: 0.9, brightness: 0.7, space: 0.6 } },
  { id: 'g10', title: 'Aurora (remix)', creator: 'Anonymous', engine: 'sine', mode: 'meditation', loads: 1102, publishedAt: '2026-05-12', captures: false, preview: 'ready',
    description: 'A warmer take on the library Aurora — slower drift, more space.',
    params: { rootFreq: 82, spread: 0.9, density: 5, coupling: 0.88, drift: 0.42, brightness: 0.35, space: 0.85 } },
];

Object.assign(window, {
  MODE_TOKENS, MODE_META, MODE_ORDER, BREATH_PATTERNS, resolvePalette, applyModeVars,
  HARMONICS, ENGINE_DEFAULTS,
  LIBRARY, INTENTIONS, LENGTHS, CHARACTERS, LESSONS, SEED_SESSIONS, GALLERY_ITEMS,
});
