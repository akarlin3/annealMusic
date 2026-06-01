// embed-dialog.jsx — listen-only embeddable player (docs/EMBED.md). Size + theme presets, copy snippet.
const { useState: useEmState, useEffect: useEmEffect, useRef: useEmRef } = React;

const EMBED_SIZES = [
  { id: 'standard', label: 'Standard', w: 560, h: 80 },
  { id: 'compact', label: 'Compact', w: 320, h: 80 },
  { id: 'wide', label: 'Wide', w: 720, h: 120 },
];

function EmbedPreview({ theme, item, w, h }) {
  const [playing, setPlaying] = useEmState(false);
  const [pos, setPos] = useEmState(0.32);
  const rafRef = useEmRef(null);
  useEmEffect(() => {
    if (!playing) return;
    const loop = () => { setPos((p) => (p + 0.0016) % 1); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);
  return (
    <div className={'embed-preview embed-' + theme} style={{ width: Math.min(w, 560), height: h }}>
      <button className="embed-play" onClick={() => setPlaying((p) => !p)}>
        {playing
          ? <svg width="12" height="12" viewBox="0 0 16 16"><rect x="4" y="3.2" width="2.6" height="9.6" rx="0.6" fill="currentColor"/><rect x="9.4" y="3.2" width="2.6" height="9.6" rx="0.6" fill="currentColor"/></svg>
          : <svg width="12" height="12" viewBox="0 0 16 16"><path d="M5 3.2v9.6L13 8 5 3.2Z" fill="currentColor"/></svg>}
      </button>
      <div className="embed-mid">
        <div className="embed-meta"><span className="embed-title">{item?.title || 'Sculpted field'}</span><span className="embed-creator">{item?.creator || 'You'}</span></div>
        <div className="embed-scrub"><div className="embed-scrub-fill" style={{ width: (pos * 100) + '%' }} /></div>
      </div>
      <span className="embed-word font-display">Anneal</span>
    </div>
  );
}

function EmbedModal({ open, item, onClose }) {
  const app = useApp();
  const [size, setSize] = useEmState('standard');
  const [theme, setTheme] = useEmState('dark');
  const [copied, setCopied] = useEmState(false);
  useEmEffect(() => { if (open) { setCopied(false); } }, [open]);
  if (!open) return null;
  const sz = EMBED_SIZES.find((s) => s.id === size);
  const slug = (item && (item.id || (item.title || '').toLowerCase().replace(/\s+/g, '-'))) || 'my-field';
  const snippet = `<iframe\n  src="https://annealmusic.app/embed/${slug}?theme=${theme}"\n  width="${sz.w}"\n  height="${sz.h}"\n  frameborder="0"\n  loading="lazy"\n  title="${(item && item.title) || 'My Patch'} — Anneal Ambiance"\n></iframe>`;
  const copy = () => {
    try { navigator.clipboard.writeText(snippet); } catch (e) {}
    setCopied(true); setTimeout(() => setCopied(false), 1800); app.toast('Embed code copied.');
  };
  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal embed-modal">
        <div className="modal-head">
          <span className="modal-title font-mono">Get embed code</span>
          <button className="modal-x" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="ai-body">
          <label className="ai-label font-mono">Size</label>
          <div className="chip-row" style={{ marginBottom: 16 }}>{EMBED_SIZES.map((s) => <Chip key={s.id} active={size === s.id} onClick={() => setSize(s.id)}>{s.label} · {s.w}×{s.h}</Chip>)}</div>
          <label className="ai-label font-mono">Theme</label>
          <div className="chip-row" style={{ marginBottom: 18 }}>
            <Chip active={theme === 'dark'} onClick={() => setTheme('dark')}>Dark</Chip>
            <Chip active={theme === 'light'} onClick={() => setTheme('light')}>Light</Chip>
          </div>
          <label className="ai-label font-mono">Preview</label>
          <div className="embed-preview-wrap"><EmbedPreview theme={theme} item={item} w={sz.w} h={sz.h} /></div>
          <label className="ai-label font-mono">Paste into any page</label>
          <pre className="embed-snippet font-mono">{snippet}</pre>
          <p className="save-note font-body">A polite guest: listen-only, no tracking, no login, no cookies. Only public patches with a rendered preview can be embedded.</p>
          <div className="modal-actions">
            <button className="modal-cancel font-mono" onClick={onClose}>Close</button>
            <button className="modal-go font-mono" onClick={copy}>{copied ? 'Copied ✓' : 'Copy code'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EmbedModal });
