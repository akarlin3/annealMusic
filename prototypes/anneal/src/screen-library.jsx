// screen-library.jsx — curated Listening Library (editorial grid, composable filters)
const { useState: useLibState, useMemo: useLibMemo } = React;

function intentionIcon(intention) {
  if (intention === 'Morning') return 'morning';
  if (intention === 'Evening' || intention === 'Sleep') return 'evening';
  if (intention === 'Focus') return 'focus';
  return 'breathe';
}

function LibraryCard({ s, onListen, onPreview, previewing }) {
  return (
    <article className="lib-card">
      <div className="lib-card-top">
        <div className="lib-chips">
          <span className="lib-intent font-mono"><Icon name={intentionIcon(s.intention)} size={12} />{s.intention}</span>
          <span className="lib-len font-mono">{s.lengthMin} min</span>
        </div>
        {s.pick && <span className="lib-pick font-mono">Editor's pick</span>}
      </div>
      <h3 className="lib-title font-display">{s.title}</h3>
      <p className="lib-note font-body">{s.note}</p>
      <div className="lib-character">
        {s.character.map((c) => <span key={c} className="lib-char font-mono">{c}</span>)}
      </div>
      <div className="lib-actions">
        <button className="lib-preview font-mono" onClick={() => onPreview(s)}>
          {previewing ? 'Previewing…' : 'Preview'}
        </button>
        <button className="lib-listen font-mono" onClick={() => onListen(s)}>
          <Icon name="play" size={12} /> Listen
        </button>
      </div>
    </article>
  );
}

function LibraryScreen() {
  const app = useApp();
  const [fIntention, setFIntention] = useLibState(null);
  const [fLength, setFLength] = useLibState(null);
  const [fChar, setFChar] = useLibState(null);
  const [previewId, setPreviewId] = useLibState(null);

  const anyFilter = fIntention || fLength || fChar;

  const filtered = useLibMemo(() => LIBRARY.filter((s) => {
    if (fIntention && s.intention !== fIntention) return false;
    if (fLength) { const L = LENGTHS.find(l => l.id === fLength); if (L && !L.test(s.lengthMin)) return false; }
    if (fChar && !s.character.includes(fChar)) return false;
    return true;
  }), [fIntention, fLength, fChar]);

  const picks = LIBRARY.filter((s) => s.pick);

  const onListen = (s) => { app.loadSession(s); app.navigate('listen'); };
  const onPreview = (s) => {
    app.loadSession(s, true);
    setPreviewId(s.id);
    setTimeout(() => setPreviewId((cur) => cur === s.id ? null : cur), 7000);
  };

  const toggle = (cur, val, set) => set(cur === val ? null : val);

  return (
    <div className="page library">
      <div className="page-inner">
        <header className="page-head">
          <div className="page-eyebrow font-mono">The Listening Library</div>
          <h1 className="page-title font-display">Find something to settle into.</h1>
          <p className="page-sub font-body">A hand-picked catalog of listening sessions — editorial only, no feeds, no trending. Just a calm shelf.</p>
        </header>

        <div className="filters">
          <div className="filter-group">
            <span className="filter-label font-mono">Intention</span>
            <div className="chip-row">{INTENTIONS.map((i) => <Chip key={i} active={fIntention === i} onClick={() => toggle(fIntention, i, setFIntention)}>{i}</Chip>)}</div>
          </div>
          <div className="filter-group">
            <span className="filter-label font-mono">Length</span>
            <div className="chip-row">{LENGTHS.map((l) => <Chip key={l.id} active={fLength === l.id} onClick={() => toggle(fLength, l.id, setFLength)}>{l.label}</Chip>)}</div>
          </div>
          <div className="filter-group">
            <span className="filter-label font-mono">Character</span>
            <div className="chip-row">{CHARACTERS.map((c) => <Chip key={c} active={fChar === c} onClick={() => toggle(fChar, c, setFChar)}>{c}</Chip>)}</div>
          </div>
        </div>

        {!anyFilter && (
          <section className="picks">
            <div className="section-label font-mono">Editor's recent picks</div>
            <div className="lib-grid">
              {picks.map((s) => <LibraryCard key={s.id} s={s} onListen={onListen} onPreview={onPreview} previewing={previewId === s.id} />)}
            </div>
          </section>
        )}

        <section>
          <div className="section-label font-mono">{anyFilter ? `${filtered.length} ${filtered.length === 1 ? 'session' : 'sessions'}` : 'All sessions'}</div>
          {filtered.length === 0 ? (
            <p className="empty font-body">No sessions match those filters. Try widening one.</p>
          ) : (
            <div className="lib-grid">
              {filtered.map((s) => <LibraryCard key={s.id} s={s} onListen={onListen} onPreview={onPreview} previewing={previewId === s.id} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

Object.assign(window, { LibraryScreen });
