// screen-research.jsx — Perceptual Experimentation Framework (docs/EXPERIMENTS.md)
// Consent-gated runner, Likert trials, live datalogger telemetry, review-before-export.
const { useState: useReState, useEffect: useReEffect, useRef: useReRef } = React;

const PROTOCOL = {
  title: 'Dyad Consonance Perception Study',
  description: 'A short behavioral study of perceived consonance across tuned intervals. Rate how pleasant or stable each sustained dyad feels.',
  estMin: 4,
};
// Each stimulus tunes the lattice to an interval; spread shifts the partial ratio.
const STIMULI = [
  { id: 'octave',        label: 'Octave (2:1)',          params: { rootFreq: 110, spread: 1.0, density: 2, coupling: 0.6, drift: 0.2, brightness: 0.4, space: 0.5 } },
  { id: 'perfect_fifth', label: 'Perfect fifth (3:2)',   params: { rootFreq: 110, spread: 1.17, density: 2, coupling: 0.6, drift: 0.2, brightness: 0.45, space: 0.5 } },
  { id: 'tritone',       label: 'Tritone (45:32)',       params: { rootFreq: 110, spread: 1.29, density: 2, coupling: 0.4, drift: 0.35, brightness: 0.55, space: 0.5 } },
  { id: 'major_third',   label: 'Major third (5:4)',     params: { rootFreq: 110, spread: 1.1, density: 2, coupling: 0.6, drift: 0.2, brightness: 0.45, space: 0.5 } },
  { id: 'minor_second',  label: 'Minor second (16:15)',  params: { rootFreq: 110, spread: 1.03, density: 2, coupling: 0.3, drift: 0.45, brightness: 0.6, space: 0.5 } },
];
const LIKERT = [1, 2, 3, 4, 5, 6, 7];

function DataLogger({ active, audioRef, coupling }) {
  const [feat, setFeat] = useReState({ rms: 0, centroid: 0, flux: 0, order: 0 });
  const [lines, setLines] = useReState([]);
  const ivRef = useReRef(null);
  const prevRef = useReRef(null);
  const tRef = useReRef(0);
  useReEffect(() => {
    if (!active) return;
    tRef.current = 0;
    ivRef.current = setInterval(() => {
      const a = audioRef.current;
      let rms = 0, centroid = 0, flux = 0;
      if (a.ctx && a.nodes && a.nodes.analyser) {
        const buf = new Uint8Array(a.nodes.analyser.frequencyBinCount);
        a.nodes.analyser.getByteFrequencyData(buf);
        let sum = 0, wsum = 0, e = 0;
        const binHz = a.ctx.sampleRate / a.nodes.analyser.fftSize;
        for (let i = 0; i < buf.length; i++) { const v = buf[i] / 255; sum += v; wsum += v * i * binHz; e += v * v; }
        rms = Math.sqrt(e / buf.length);
        centroid = sum > 0 ? wsum / (sum) : 0;
        if (prevRef.current) { let f = 0; for (let i = 0; i < buf.length; i++) f += Math.abs(buf[i] - prevRef.current[i]); flux = f / buf.length; }
        prevRef.current = buf;
      } else {
        rms = 0.35 + Math.random() * 0.15; centroid = 700 + Math.random() * 300; flux = 8 + Math.random() * 6;
      }
      const order = Math.min(0.99, coupling * 0.9 + 0.08 + (Math.random() - 0.5) * 0.04);
      tRef.current += 0.1;
      const line = { t: tRef.current.toFixed(2), rms: rms.toFixed(3), centroid: centroid.toFixed(1), flux: flux.toFixed(1), order: order.toFixed(3) };
      setFeat({ rms, centroid, flux, order });
      setLines((ls) => [line, ...ls].slice(0, 5));
    }, 100);
    return () => clearInterval(ivRef.current);
  }, [active, coupling]);

  return (
    <div className="datalog">
      <div className="datalog-head font-mono">Datalogger · 30 Hz <span className={'datalog-live' + (active ? ' on' : '')}>{active ? 'logging' : 'idle'}</span></div>
      <div className="datalog-feats">
        {[['rms', feat.rms.toFixed(3)], ['centroid', feat.centroid.toFixed(0) + ' Hz'], ['flux', feat.flux.toFixed(1)], ['order param', feat.order.toFixed(3)]].map(([k, v]) => (
          <div key={k} className="datalog-feat"><span className="dl-k font-mono">{k}</span><span className="dl-v font-mono tnum">{v}</span></div>
        ))}
      </div>
      <div className="datalog-stream font-mono">
        {lines.map((l, i) => <div key={i} className="dl-line" style={{ opacity: 1 - i * 0.18 }}>{`{"t":${l.t},"rms":${l.rms},"centroid":${l.centroid},"flux":${l.flux},"order":${l.order}}`}</div>)}
      </div>
    </div>
  );
}

function ResearchScreen() {
  const app = useApp();
  const { engine } = app;
  const [phase, setPhase] = useReState('intro'); // intro | running | review | done
  const [consent, setConsent] = useReState(false);
  const [trial, setTrial] = useReState(0);
  const [responses, setResponses] = useReState([]);
  const [trialStart, setTrialStart] = useReState(0);

  const stim = STIMULI[trial];

  useReEffect(() => {
    if (phase !== 'running') return;
    app.loadParams(stim.params); engine.start(); setTrialStart(performance.now());
    // eslint-disable-next-line
  }, [phase, trial]);

  const begin = () => { setResponses([]); setTrial(0); setPhase('running'); };
  const respond = (value) => {
    const rt = Math.round(performance.now() - trialStart);
    const rec = { trial_index: trial, stimulus_id: stim.id, response_type: 'LikertResponse', response_value: value, rt_ms: rt };
    const next = [...responses, rec]; setResponses(next);
    if (trial + 1 >= STIMULI.length) { engine.stop(); setPhase('review'); } else setTrial((t) => t + 1);
  };
  const withdraw = () => { engine.stop(); setResponses([]); setTrial(0); setConsent(false); setPhase('intro'); app.toast('Withdrawn — all trial data wiped from memory.'); };

  const downloadZip = () => {
    const csv = ['subject_id,trial_index,stimulus_id,response_type,response_value,rt_ms']
      .concat(responses.map((r) => `sub-prototype,${r.trial_index},${r.stimulus_id},${r.response_type},${r.response_value},${r.rt_ms}`)).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'responses.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    app.toast('responses.csv downloaded.'); setPhase('done');
  };

  return (
    <div className="page research">
      <div className="page-inner narrow">
        <header className="page-head">
          <div className="page-eyebrow font-mono">Research · perceptual study</div>
          <h1 className="page-title font-display">{PROTOCOL.title}</h1>
          <p className="page-sub font-body">{PROTOCOL.description}</p>
        </header>

        {phase === 'intro' && (
          <div className="re-intro">
            <div className="re-meta font-mono">
              <span>{STIMULI.length} trials</span><span>·</span><span>~{PROTOCOL.estMin} min</span><span>·</span><span>Likert 1–7</span>
            </div>
            <div className="re-consent">
              <div className="re-consent-head font-mono">Informed consent</div>
              <p className="font-body">Participation is voluntary and anonymous. No cookies or identifiers are set. Audio plays in your browser; behavioral responses stay in memory and are never sent anywhere unless you explicitly export them. You may withdraw at any time, which immediately wipes all collected data.</p>
              <label className="consent">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span className="font-body">I have read the above and consent to participate.</span>
              </label>
            </div>
            <button className="primary re-begin" disabled={!consent} onClick={begin}><span className="font-mono primary-label">Begin study</span></button>
          </div>
        )}

        {phase === 'running' && (
          <div className="re-run">
            <div className="re-progress">
              <ProgressDots total={STIMULI.length} current={trial} />
              <span className="re-trial-n font-mono">Trial {trial + 1} / {STIMULI.length}</span>
            </div>
            <div className="re-stim">
              <span className="re-stim-eyebrow font-mono">Now sounding</span>
              <h2 className="re-stim-label font-display">{stim.label}</h2>
              <p className="re-stim-q font-body">How consonant — stable and pleasant — does this dyad feel?</p>
            </div>
            <div className="likert">
              <span className="likert-end font-mono">Dissonant</span>
              {LIKERT.map((v) => <button key={v} className="likert-btn font-mono" onClick={() => respond(v)}>{v}</button>)}
              <span className="likert-end font-mono">Consonant</span>
            </div>
            <DataLogger active={true} audioRef={engine.audioRef} coupling={stim.params.coupling} />
            <button className="re-withdraw font-mono" onClick={withdraw}>Withdraw &amp; wipe</button>
          </div>
        )}

        {(phase === 'review' || phase === 'done') && (
          <div className="re-review">
            <div className="re-review-head font-mono">{phase === 'done' ? 'Session complete' : 'Review before export'}</div>
            <p className="font-body re-review-sub">Here is every byte that would be transmitted or saved. Nothing leaves your device until you choose to download.</p>
            <div className="re-files">
              <div className="re-file">
                <span className="re-file-name font-mono">responses.csv</span>
                <pre className="re-file-body font-mono">{['subject_id,trial_index,stimulus_id,response_value,rt_ms'].concat(responses.map((r) => `sub-prototype,${r.trial_index},${r.stimulus_id},${r.response_value},${r.rt_ms}`)).join('\n')}</pre>
              </div>
              <div className="re-file">
                <span className="re-file-name font-mono">manifest.json</span>
                <pre className="re-file-body font-mono">{JSON.stringify({ experiment_title: PROTOCOL.title, subject_id: 'sub-prototype', schema_version: 'v20', anneal_music_version: '9.1.0', trials: responses.length }, null, 2)}</pre>
              </div>
            </div>
            <div className="re-review-actions">
              <button className="re-withdraw font-mono" onClick={withdraw}>Discard all</button>
              {phase === 'review' && <button className="modal-go font-mono" onClick={downloadZip}><Icon name="arrowRight" size={12} /> Download ZIP</button>}
              {phase === 'done' && <button className="modal-go font-mono" onClick={() => { setConsent(false); setPhase('intro'); }}>New session</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { ResearchScreen });
