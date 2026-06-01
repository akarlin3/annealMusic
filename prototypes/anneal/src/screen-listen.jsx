// screen-listen.jsx — immersive fullscreen sculpting view (the core experience)
const { useState: useLState, useEffect: useLEffect, useRef: useLRef } = React;

const SCULPT_CONTROLS = [
  { key: 'rootFreq',   label: 'Root',       group: 'Pitch',   min: 55,  max: 220, step: 1,    fmt: v => `${v.toFixed(0)} Hz` },
  { key: 'spread',     label: 'Spread',     group: 'Pitch',   min: 0.7, max: 1.3, step: 0.01, fmt: v => v.toFixed(2) },
  { key: 'density',    label: 'Density',    group: 'Pitch',   min: 2,   max: 8,   step: 1,    fmt: v => `${v.toFixed(0)}`, lockWhilePlaying: true },
  { key: 'coupling',   label: 'Coupling',   group: 'Physics', min: 0,   max: 1,   step: 0.01, fmt: v => v.toFixed(2) },
  { key: 'drift',      label: 'Drift',      group: 'Physics', min: 0,   max: 1,   step: 0.01, fmt: v => v.toFixed(2) },
  { key: 'brightness', label: 'Brightness', group: 'Tone',    min: 0,   max: 1,   step: 0.01, fmt: v => v.toFixed(2) },
  { key: 'space',      label: 'Space',      group: 'Tone',    min: 0,   max: 1,   step: 0.01, fmt: v => v.toFixed(2) },
];

function SculptDrawer({ open, params, setParam, isPlaying, onClose, highlight }) {
  return (
    <div className={'sculpt' + (open ? ' is-open' : '')} role="dialog" aria-label="Sculpt controls" aria-hidden={!open}>
      <div className="sculpt-head">
        <span className="font-mono sculpt-title">Sculpt the field</span>
        <button className="sculpt-x font-mono" onClick={onClose}>Done</button>
      </div>
      <div className="sculpt-grid">
        {['Pitch', 'Physics', 'Tone'].map(group => (
          <div key={group} className="sculpt-col">
            <div className="sculpt-group font-mono">{group}</div>
            <div className="sculpt-rows">
              {SCULPT_CONTROLS.filter(c => c.group === group).map(c => {
                const disabled = c.lockWhilePlaying && isPlaying;
                const hot = highlight === c.key;
                return (
                  <div key={c.key} className={'sculpt-row' + (hot ? ' is-hot' : '')}>
                    <div className="sculpt-row-top">
                      <label className={'sculpt-label' + (disabled ? ' is-disabled' : '')}>
                        {c.label}{disabled && <span className="font-mono locked-tag">locked</span>}
                      </label>
                      <span className={'sculpt-val font-mono tnum' + (disabled ? ' is-disabled' : '')}>{c.fmt(params[c.key])}</span>
                    </div>
                    <Range value={params[c.key]} min={c.min} max={c.max} step={c.step}
                      disabled={disabled} onChange={(v) => setParam(c.key, v)} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="sculpt-foot">
        <div className="vol-row">
          <span className="font-mono sculpt-group">Volume</span>
          <Range value={params.volume} min={0} max={0.8} step={0.01} disabled={false} onChange={(v) => setParam('volume', v)} />
          <span className="font-mono tnum vol-val">{(params.volume * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

function ListenScreen() {
  const app = useApp();
  const { mode, engine, params, setParam, reduceMotion, tweaks, nowPlaying } = app;
  const meta = MODE_META[mode];
  const [sculptOpen, setSculptOpen] = useLState(false);
  const [performOpen, setPerformOpen] = useLState(false);
  const [breathOn, setBreathOn] = useLState(false);
  const [breathPattern, setBreathPattern] = useLState('box');

  return (
    <div className={'listen' + (sculptOpen ? ' sculpting' : '')}>
      <Visualizer audioRef={engine.audioRef} paramsRef={engine.paramsRef} mode={mode}
        isPlaying={engine.isPlaying} intensity={tweaks.intensity} reduceMotion={reduceMotion} />
      <BreathOverlay tuple={BREATH_PATTERNS[breathPattern].tuple} active={breathOn} reduceMotion={reduceMotion} />

      <div className="tagline chrome font-body">
        {nowPlaying ? <span><span className="np-from font-mono">now playing</span> {nowPlaying.title}</span> : meta.tagline}
      </div>

      <footer className="bottombar chrome-host">
        <div className="status chrome font-mono">
          <span className={'sdot' + (engine.isPlaying ? ' on' : '')} />
          <span>{engine.isPlaying ? (engine.starting ? 'settling in' : 'sounding') : 'silent'}</span>
          <span className="status-sep">/</span>
          <span className="tnum">{params.density} partials · root {params.rootFreq.toFixed(0)} Hz</span>
        </div>
        <div className="controls">
          <button className={'primary' + (engine.isPlaying ? ' is-playing' : '')} onClick={engine.toggle}>
            <span className="primary-glyph">{engine.isPlaying
              ? <svg width="13" height="13" viewBox="0 0 16 16"><rect x="4" y="3.2" width="2.6" height="9.6" rx="0.6" fill="currentColor"/><rect x="9.4" y="3.2" width="2.6" height="9.6" rx="0.6" fill="currentColor"/></svg>
              : <Icon name="play" size={13} />}</span>
            <span className="font-mono primary-label">{engine.isPlaying ? meta.verb.end : meta.verb.begin}</span>
          </button>
        </div>
        <div className="actions chrome">
          <button className={'pill font-mono' + (breathOn ? ' is-on' : '')} onClick={() => setBreathOn(b => !b)}>Breath</button>
          <button className={'pill font-mono' + (performOpen ? ' is-on' : '')} onClick={() => { setPerformOpen(p => !p); setSculptOpen(false); }}>Perform</button>
          <button className={'pill font-mono' + (sculptOpen ? ' is-on' : '')} onClick={() => { setSculptOpen(s => !s); setPerformOpen(false); }}>Sculpt</button>
        </div>
      </footer>

      {breathOn && (
        <div className="breath-picker chrome font-mono">
          {Object.entries(BREATH_PATTERNS).map(([id, p]) => (
            <button key={id} className={'bp' + (id === breathPattern ? ' is-on' : '')} onClick={() => setBreathPattern(id)}>{p.label}</button>
          ))}
        </div>
      )}

      <SculptDrawer open={sculptOpen} params={params} setParam={setParam} isPlaying={engine.isPlaying} onClose={() => setSculptOpen(false)} />
      <PerformDrawer open={performOpen} onClose={() => setPerformOpen(false)} />

      <div className="disclaimer font-mono">A wellness aid for rest and attention — not a medical device, and no clinical outcome is claimed.</div>
    </div>
  );
}

Object.assign(window, { ListenScreen });
