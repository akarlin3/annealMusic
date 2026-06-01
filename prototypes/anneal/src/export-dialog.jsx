// export-dialog.jsx — render the current field to audio (docs/EXPORT.md). Deterministic seed.
const { useState: useExState, useEffect: useExEffect } = React;

const EX_FORMATS = [
  { id: 'wav', label: 'WAV', sub: '24-bit · 48 kHz stereo' },
  { id: 'flac', label: 'FLAC', sub: 'lossless, smaller' },
  { id: 'stems', label: 'Stems', sub: 'per-partial + reverb bus, zipped' },
];
const EX_DURATIONS = [1, 3, 5, 10];

function ExportModal({ open, onClose }) {
  const app = useApp();
  const [format, setFormat] = useExState('wav');
  const [minutes, setMinutes] = useExState(5);
  const [seed, setSeed] = useExState(48271);
  const [manifest, setManifest] = useExState(true);
  const [stage, setStage] = useExState('setup'); // setup | rendering | done
  const [prog, setProg] = useExState(0);

  useExEffect(() => { if (open) { setStage('setup'); setProg(0); } }, [open]);
  if (!open) return null;

  const sizeMb = (minutes * (format === 'stems' ? 9.1 : format === 'flac' ? 3.6 : 8.3)).toFixed(1);

  const render = () => {
    setStage('rendering'); setProg(0);
    const t0 = performance.now(), dur = 2600;
    const iv = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / dur);
      setProg(p);
      if (p >= 1) { clearInterval(iv); setStage('done'); }
    }, 60);
  };

  const download = () => {
    const data = {
      app: 'AnnealMusic', schema: 7, exported_at: new Date().toISOString(),
      format, duration_s: minutes * 60, seed,
      patch: { name: app.nowPlaying?.title || 'Sculpted field', engine: 'sine', params: app.params },
      reproducible: true,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `anneal-${seed}.manifest.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget && stage !== 'rendering') onClose(); }}>
      <div className="modal export-modal">
        <div className="modal-head">
          <span className="modal-title font-mono">Export the field</span>
          {stage !== 'rendering' && <button className="modal-x" onClick={onClose}><Icon name="x" size={14} /></button>}
        </div>

        {stage === 'setup' && (
          <div className="ai-body">
            <label className="ai-label font-mono">Format</label>
            <div className="ex-formats">
              {EX_FORMATS.map((f) => (
                <button key={f.id} className={'ex-format' + (format === f.id ? ' is-active' : '')} onClick={() => setFormat(f.id)}>
                  <span className="ex-format-label font-mono">{f.label}</span>
                  <span className="ex-format-sub font-body">{f.sub}</span>
                </button>
              ))}
            </div>

            <label className="ai-label font-mono">Duration</label>
            <div className="chip-row">{EX_DURATIONS.map((m) => <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)}>{m} min</Chip>)}</div>

            <label className="ai-label font-mono ex-seed-label">Seed <span className="ex-seed-note">— same seed renders an identical field</span></label>
            <div className="ex-seed-row">
              <input className="save-input ex-seed font-mono tnum" type="number" value={seed} onChange={(e) => setSeed(parseInt(e.target.value) || 0)} />
              <button className="ex-reseed font-mono" onClick={() => setSeed(Math.floor(Math.random() * 999999))}>Randomize</button>
            </div>

            <label className="ex-check">
              <input type="checkbox" checked={manifest} onChange={(e) => setManifest(e.target.checked)} />
              <span className="font-body">Include reproducibility manifest (patch, seed, engine version)</span>
            </label>

            <div className="ex-summary font-mono">
              <span>{app.nowPlaying?.title || 'Sculpted field'} · {minutes}:00</span>
              <span className="ex-size">≈ {sizeMb} MB</span>
            </div>
            <div className="modal-actions">
              <button className="modal-cancel font-mono" onClick={onClose}>Cancel</button>
              <button className="modal-go font-mono" onClick={render}>Render</button>
            </div>
          </div>
        )}

        {stage === 'rendering' && (
          <div className="ex-rendering">
            <p className="ex-render-main font-mono">Rendering offline — faster than real time</p>
            <div className="ex-prog"><div className="ex-prog-fill" style={{ width: (prog * 100) + '%' }} /></div>
            <p className="ex-render-sub font-mono tnum">{Math.round(prog * 100)}% · {(minutes * prog).toFixed(1)} of {minutes}:00 min</p>
          </div>
        )}

        {stage === 'done' && (
          <div className="ai-body ex-done">
            <div className="ex-done-ic"><Icon name="check" size={22} /></div>
            <p className="ex-done-main font-display">Your field is ready.</p>
            <p className="ex-done-sub font-body">{app.nowPlaying?.title || 'Sculpted field'} · {format.toUpperCase()} · {minutes}:00 · {sizeMb} MB · seed {seed}</p>
            <div className="modal-actions center">
              <button className="modal-cancel font-mono" onClick={() => setStage('setup')}>Render again</button>
              <button className="modal-go font-mono" onClick={download}><Icon name="arrowRight" size={12} /> Download</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { ExportModal });
