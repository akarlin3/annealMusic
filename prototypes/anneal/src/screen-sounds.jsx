// screen-sounds.jsx — the patch bank: presets, engine selector, AI generation, My Patches
const { useState: useSnState } = React;

function EngineBadge({ engineId }) {
  const e = ENGINES[engineId] || ENGINES.sine;
  return <span className={'eng-badge font-mono eng-' + engineId}>{e.label}</span>;
}

function PatchCard({ p, onOpen, onAudition, auditioning, onDelete }) {
  return (
    <article className="patch-card">
      <div className="patch-top">
        <EngineBadge engineId={p.engineId} />
        {onDelete && <button className="patch-del" title="Forget patch" onClick={() => onDelete(p)}><Icon name="x" size={11} /></button>}
      </div>
      <h3 className="patch-name font-display">{p.name}</h3>
      <p className="patch-desc font-body">{p.description}</p>
      <div className="patch-actions">
        <button className="patch-aud font-mono" onClick={() => onAudition(p)}>{auditioning ? 'Auditioning…' : 'Audition'}</button>
        <button className="patch-open font-mono" onClick={() => onOpen(p)}><Icon name="play" size={11} /> Open</button>
      </div>
    </article>
  );
}

function AIDialog({ open, onClose }) {
  const app = useApp();
  const [prompt, setPrompt] = useSnState('');
  const [loading, setLoading] = useSnState(false);
  const SUGGESTIONS = [
    'A slow dawn over a frozen lake, glass bells in the distance',
    'Anxious granular wind, fast shifting sand and dust',
    'Warm glowing embers, slow pulsing analog synth',
    'Deep ocean trench, distant massive echoes and currents',
  ];
  if (!open) return null;
  const submit = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    await app.generatePatch(prompt.trim());
    setLoading(false);
    setPrompt('');
    onClose();
  };
  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      <div className="modal ai-modal">
        <div className="modal-head">
          <span className="modal-title font-mono"><span className="ai-spark" /> Generate a patch</span>
          {!loading && <button className="modal-x" onClick={onClose}><Icon name="x" size={14} /></button>}
        </div>
        {loading ? (
          <div className="ai-loading">
            <div className="ai-spinner" />
            <p className="ai-load-main font-mono">Designing the field…</p>
            <p className="ai-load-sub font-body">Choosing an engine, setting coupling and drift, tuning the harmonic lattice.</p>
          </div>
        ) : (
          <div className="ai-body">
            <label className="ai-label font-mono">Describe the sound you want</label>
            <textarea className="refl-area ai-input font-body" rows={3} autoFocus value={prompt}
              placeholder="A deep foggy fjord, low humming drone in the background…"
              onChange={(e) => setPrompt(e.target.value)} />
            <span className="ai-sug-label font-mono">Try one of these</span>
            <div className="ai-sugs">
              {SUGGESTIONS.map((s, i) => <button key={i} className="ai-sug font-body" onClick={() => setPrompt(s)}>“{s}”</button>)}
            </div>
            <div className="ai-quota font-mono"><span>Synthesis credits</span><span className="ai-quota-n">3 / 8 hr · 12 / 40 day</span></div>
            <div className="modal-actions">
              <button className="modal-cancel font-mono" onClick={onClose}>Cancel</button>
              <button className="modal-go font-mono" disabled={!prompt.trim()} onClick={submit}><span className="ai-spark sm" /> Generate</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SaveDialog({ open, onClose }) {
  const app = useApp();
  const [name, setName] = useSnState('');
  if (!open) return null;
  const save = () => { app.savePatch(name.trim() || 'Untitled field'); setName(''); onClose(); };
  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal save-modal">
        <div className="modal-head">
          <span className="modal-title font-mono">Save this field</span>
          <button className="modal-x" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="ai-body">
          <label className="ai-label font-mono">Name your patch</label>
          <input className="save-input font-body" autoFocus value={name} placeholder="e.g. Slow tide"
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
          <p className="save-note font-body">Saved privately on this device, alongside the current root, spread, drift and tone.</p>
          <div className="modal-actions">
            <button className="modal-cancel font-mono" onClick={onClose}>Cancel</button>
            <button className="modal-go font-mono" onClick={save}>Save patch</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SoundsScreen() {
  const app = useApp();
  const [engine, setEngine] = useSnState(null);
  const [aiOpen, setAiOpen] = useSnState(false);
  const [saveOpen, setSaveOpen] = useSnState(false);
  const [auditionId, setAuditionId] = useSnState(null);

  const onOpen = (p) => { app.loadSession({ title: p.name, params: p.params }); app.navigate('listen'); };
  const onAudition = (p) => { app.loadSession({ title: p.name, params: p.params }, true); setAuditionId(p.id); setTimeout(() => setAuditionId((c) => c === p.id ? null : c), 7000); };

  const cats = engine
    ? PRESET_CATEGORIES.map((c) => ({ ...c, presets: c.presets.filter((p) => p.engineId === engine) })).filter((c) => c.presets.length)
    : PRESET_CATEGORIES;

  return (
    <div className="page sounds">
      <div className="page-inner">
        <header className="page-head sounds-head">
          <div>
            <div className="page-eyebrow font-mono">Sounds</div>
            <h1 className="page-title font-display">A bank of fields to begin from.</h1>
            <p className="page-sub font-body">Load a starting point, then sculpt it your own way. Four engines, fifty-some patches — or describe a feeling and let the instrument design one.</p>
          </div>
          <div className="sounds-actions">
            <button className="sounds-ai font-mono" onClick={() => setAiOpen(true)}><span className="ai-spark sm" /> Generate with AI</button>
            <button className="sounds-save font-mono" onClick={() => setSaveOpen(true)}>Save current field</button>
            <button className="sounds-export font-mono" onClick={() => app.openExport()}>Export…</button>
          </div>
        </header>

        <div className="engine-row">
          <Chip active={!engine} onClick={() => setEngine(null)}>All engines</Chip>
          {ENGINE_ORDER.map((id) => <Chip key={id} active={engine === id} onClick={() => setEngine(engine === id ? null : id)}>{ENGINES[id].label}</Chip>)}
          {engine && <span className="engine-blurb font-body">{ENGINES[engine].blurb}</span>}
        </div>

        {app.patches.length > 0 && (
          <section className="patch-section">
            <div className="section-label font-mono">My patches</div>
            <div className="patch-grid">
              {app.patches.map((p) => <PatchCard key={p.id} p={p} onOpen={onOpen} onAudition={onAudition} auditioning={auditionId === p.id} onDelete={app.deletePatch} />)}
            </div>
          </section>
        )}

        {cats.map((c) => (
          <section key={c.id} className="patch-section">
            <div className="section-label font-mono">{c.name}<span className="section-desc font-body">{c.description}</span></div>
            <div className="patch-grid">
              {c.presets.map((p) => <PatchCard key={p.id} p={p} onOpen={onOpen} onAudition={onAudition} auditioning={auditionId === p.id} />)}
            </div>
          </section>
        ))}
      </div>

      <AIDialog open={aiOpen} onClose={() => setAiOpen(false)} />
      <SaveDialog open={saveOpen} onClose={() => setSaveOpen(false)} />
    </div>
  );
}

Object.assign(window, { SoundsScreen });
