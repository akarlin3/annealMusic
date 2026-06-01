// screen-gallery.jsx — creator-side discovery of published patches (docs/API.md, gallery/types.ts)
const { useState: useGState, useMemo: useGMemo } = React;

const SORTS = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'most_loaded', label: 'Most loaded' },
  { id: 'most_liked', label: 'Most liked' },
];

// Generative field thumbnail derived from a patch's params (static, no rAF).
function CardVisual({ params, mode }) {
  const t = MODE_TOKENS[mode] || MODE_TOKENS.musician;
  const n = params.density;
  const dots = Array.from({ length: n }).map((_, i) => {
    const ang = (i / n) * Math.PI * 2 + params.drift * 3;
    const orbit = 18 + 26 * (i / Math.max(1, n - 1));
    const x = 50 + Math.cos(ang) * orbit;
    const y = 50 + Math.sin(ang) * orbit * 0.8;
    const r = 3 + params.brightness * 6;
    return { x, y, r, key: i };
  });
  return (
    <div className="gcard-vis" data-mode={mode} style={{ background: t.base }}>
      <div className="gcard-halo" style={{ opacity: 0.3 + params.space * 0.5 }} />
      {dots.map((d) => (
        <span key={d.key} className="gcard-dot" style={{ left: d.x + '%', top: d.y + '%', width: d.r * 2, height: d.r * 2, opacity: 0.4 + params.brightness * 0.5 }} />
      ))}
      <span className="gcard-eng font-mono">{ENGINES[params._engine] ? '' : ''}</span>
    </div>
  );
}

function ReportModal({ open, item, onClose, onSubmit }) {
  const [reason, setReason] = useGState('inappropriate');
  const [detail, setDetail] = useGState('');
  if (!open) return null;
  const REASONS = [{ id: 'spam', label: 'Spam' }, { id: 'inappropriate', label: 'Inappropriate' }, { id: 'other', label: 'Other' }];
  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal report-modal">
        <div className="modal-head">
          <span className="modal-title font-mono">Report “{item?.title}”</span>
          <button className="modal-x" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="ai-body">
          <label className="ai-label font-mono">Reason</label>
          <div className="chip-row" style={{ marginBottom: 16 }}>
            {REASONS.map((r) => <Chip key={r.id} active={reason === r.id} onClick={() => setReason(r.id)}>{r.label}</Chip>)}
          </div>
          <label className="ai-label font-mono">Anything else? (optional)</label>
          <textarea className="refl-area font-body" rows={3} value={detail} maxLength={400}
            placeholder="Context helps our editors review fairly." onChange={(e) => setDetail(e.target.value)} />
          <p className="save-note font-body">Reports are private and reviewed by the AnnealMusic editors. Thank you for keeping the gallery calm.</p>
          <div className="modal-actions">
            <button className="modal-cancel font-mono" onClick={onClose}>Cancel</button>
            <button className="modal-go font-mono" onClick={() => onSubmit(reason)}>Submit report</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GalleryCard({ item, onRemix, onPreview, previewing, onMenu, menuOpen, onEmbed, onReport }) {
  const showPreview = item.preview === 'ready';
  return (
    <article className="gcard">
      <CardVisual params={{ ...item.params, _engine: item.engine }} mode={item.mode} />
      <div className="gcard-body">
        <div className="gcard-badges">
          <span className="eng-badge font-mono">{ENGINES[item.engine].label}</span>
          <span className="gcard-mode font-mono">{MODE_META[item.mode].label}</span>
          {item.captures && <span className="gcard-cap font-mono" title="Includes captured loops">loops</span>}
        </div>
        <h3 className="gcard-title font-display">{item.title}</h3>
        <p className="gcard-desc font-body">{item.description}</p>
        <div className="gcard-foot">
          <span className="gcard-loads font-mono">{item.loads.toLocaleString()} loads · {item.creator}</span>
          <div className="gcard-actions">
            {showPreview
              ? <button className="gcard-prev font-mono" onClick={() => onPreview(item)}>{previewing ? '▮▮' : '▶'}</button>
              : <span className="gcard-prev-na font-mono" title={item.preview === 'rendering' ? 'Preview rendering' : 'No preview'}>{item.preview === 'rendering' ? '···' : '—'}</span>}
            <button className="gcard-remix font-mono" onClick={() => onRemix(item)}>Remix</button>
            <div className="gcard-menu-wrap">
              <button className="gcard-more" onClick={() => onMenu(item.id)} aria-label="More">···</button>
              {menuOpen && (
                <div className="gcard-menu font-mono">
                  <button onClick={() => onEmbed(item)}>Get embed code</button>
                  <button className="gcard-menu-report" onClick={() => onReport(item)}>Report</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function GalleryScreen() {
  const app = useApp();
  const [q, setQ] = useGState('');
  const [sort, setSort] = useGState('newest');
  const [engine, setEngine] = useGState(null);
  const [fmode, setFmode] = useGState(null);
  const [capturesOnly, setCapturesOnly] = useGState(false);
  const [previewId, setPreviewId] = useGState(null);
  const [menuId, setMenuId] = useGState(null);
  const [reportItem, setReportItem] = useGState(null);

  const items = useGMemo(() => {
    let list = GALLERY_ITEMS.filter((it) => {
      if (engine && it.engine !== engine) return false;
      if (fmode && it.mode !== fmode) return false;
      if (capturesOnly && !it.captures) return false;
      if (q && !(it.title + ' ' + it.description).toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    list = [...list];
    if (sort === 'newest') list.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    else if (sort === 'oldest') list.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
    else if (sort === 'most_loaded') list.sort((a, b) => b.loads - a.loads);
    else if (sort === 'most_liked') list.sort((a, b) => b.loads * 0.7 - a.loads * 0.7); // proxy
    return list;
  }, [q, sort, engine, fmode, capturesOnly]);

  const onRemix = (it) => { app.loadSession({ title: it.title, params: it.params }); app.navigate('listen'); };
  const onPreview = (it) => { app.loadSession({ title: it.title, params: it.params }, true); setPreviewId(it.id); setTimeout(() => setPreviewId((c) => c === it.id ? null : c), 7000); };

  return (
    <div className="page gallery" onClick={() => menuId && setMenuId(null)}>
      <div className="page-inner">
        <header className="page-head">
          <div className="page-eyebrow font-mono">Gallery</div>
          <h1 className="page-title font-display">What others have published.</h1>
          <p className="page-sub font-body">The creator-side shelf: patches and pieces shared by the community. Load one as your own starting point, or remix it. Editorial picks live in the Library.</p>
        </header>

        <div className="gallery-controls">
          <div className="search-wrap">
            <Icon name="listen" size={14} />
            <input className="search-input font-body" value={q} placeholder="Search patches…" onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="chip-row sort-chips">{SORTS.map((s) => <Chip key={s.id} active={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</Chip>)}</div>
        </div>
        <div className="gallery-filters">
          <span className="filter-label font-mono">Engine</span>
          <div className="chip-row">{ENGINE_ORDER.map((id) => <Chip key={id} active={engine === id} onClick={() => setEngine(engine === id ? null : id)}>{ENGINES[id].label}</Chip>)}</div>
          <span className="filter-label font-mono filter-label-2">Voice</span>
          <div className="chip-row">{MODE_ORDER.map((m) => <Chip key={m} active={fmode === m} onClick={() => setFmode(fmode === m ? null : m)}>{MODE_META[m].label}</Chip>)}
            <Chip active={capturesOnly} onClick={() => setCapturesOnly((c) => !c)}>With loops</Chip>
          </div>
        </div>

        <div className="section-label font-mono">{items.length} {items.length === 1 ? 'patch' : 'patches'}</div>
        {items.length === 0 ? <p className="empty font-body">No patches match. Try clearing a filter.</p> : (
          <div className="gallery-grid">
            {items.map((it) => (
              <GalleryCard key={it.id} item={it} onRemix={onRemix} onPreview={onPreview} previewing={previewId === it.id}
                onMenu={(id) => setMenuId((c) => c === id ? null : id)} menuOpen={menuId === it.id}
                onEmbed={(i) => { setMenuId(null); app.openEmbed(i); }} onReport={(i) => { setMenuId(null); setReportItem(i); }} />
            ))}
          </div>
        )}
      </div>
      <ReportModal open={!!reportItem} item={reportItem} onClose={() => setReportItem(null)} onSubmit={() => { setReportItem(null); app.toast('Report submitted — thank you.'); }} />
    </div>
  );
}

Object.assign(window, { GalleryScreen });
