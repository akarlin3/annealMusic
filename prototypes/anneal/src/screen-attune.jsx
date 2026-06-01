// screen-attune.jsx — Biofeedback: connect a sensor, calibrate a baseline, couple it to the field.
// (docs/BIOFEEDBACK.md). No hardware here — uses the built-in mock simulator stream.
const { useState: useAtState, useEffect: useAtEffect, useRef: useAtRef } = React;

const DEVICES = [
  { id: 'sim', name: 'Built-in simulator', metric: 'Simulated HR & HRV', transport: 'mock', cap: 'hrv', recommended: true },
  { id: 'polar-h10', name: 'Polar H10', metric: 'Heart rate & R-R (HRV)', transport: 'Bluetooth', cap: 'hrv' },
  { id: 'verity', name: 'Polar Verity Sense', metric: 'Optical PPG / heart rate', transport: 'Bluetooth', cap: 'hrv' },
  { id: 'muse', name: 'Muse 2', metric: 'EEG delta band power', transport: 'Bluetooth', cap: 'eeg' },
  { id: 'openbci', name: 'OpenBCI Cyton', metric: '8-channel raw EEG', transport: 'WebSerial', cap: 'eeg' },
  { id: 'e4', name: 'Empatica E4', metric: 'GSR / skin conductance', transport: 'WebHID', cap: 'gsr' },
];

const MAPPINGS = [
  { id: 'hrv-coupling', label: 'HRV → Coupling', target: 'coupling', desc: 'A calmer, more coherent heart pulls the partials into unison.' },
  { id: 'hr-brightness', label: 'Heart rate → Brightness', target: 'brightness', desc: 'A quicker pulse opens the filter; rest darkens it.' },
  { id: 'hr-drift', label: 'Heart rate → Drift', target: 'drift', desc: 'Faster beats let the pitches wander; rest stills them.' },
];

const clamp01 = (x) => Math.max(0, Math.min(1, x));

function AttuneScreen() {
  const app = useApp();
  const { engine } = app;
  const [phase, setPhase] = useAtState('idle'); // idle | connecting | connected | calibrating | live
  const [device, setDevice] = useAtState(null);
  const [consent, setConsent] = useAtState(true);
  const [calProgress, setCalProgress] = useAtState(0);
  const [mapping, setMapping] = useAtState('hrv-coupling');
  const [coupled, setCoupled] = useAtState(true);
  const [tele, setTele] = useAtState({ bpm: 62, rr: 968, sdnn: 0, coherence: 0.5, target: 0.4 });
  const [baseline, setBaseline] = useAtState(null);

  const tickRef = useAtRef(null);
  const rrWinRef = useAtRef([]);
  const t0Ref = useAtRef(0);
  const mappingRef = useAtRef(mapping);
  const coupledRef = useAtRef(coupled);
  useAtEffect(() => { mappingRef.current = mapping; }, [mapping]);
  useAtEffect(() => { coupledRef.current = coupled; }, [coupled]);

  const startStream = () => {
    t0Ref.current = performance.now();
    rrWinRef.current = [];
    tickRef.current = setInterval(() => {
      const t = (performance.now() - t0Ref.current) / 1000;
      // simulated heart: slow autonomic wave + respiratory sinus arrhythmia + noise
      const bpm = 61 + 4.2 * Math.sin(t / 7.5) + 1.8 * Math.sin(t / 2.6) + (Math.random() - 0.5) * 1.4;
      const rr = 60000 / bpm;
      const win = rrWinRef.current; win.push(rr); if (win.length > 16) win.shift();
      const mean = win.reduce((a, b) => a + b, 0) / win.length;
      const sdnn = Math.sqrt(win.reduce((a, b) => a + (b - mean) ** 2, 0) / win.length);
      const coherence = clamp01(1 - (bpm - 56) / 16);
      const map = MAPPINGS.find((m) => m.id === mappingRef.current);
      let target;
      if (map.target === 'coupling') target = clamp01(0.2 + coherence * 0.7);
      else target = clamp01((bpm - 52) / 24);
      setTele({ bpm, rr, sdnn, coherence, target });
      if (coupledRef.current) app.setParam(map.target, target);
    }, 180);
  };
  const stopStream = () => { if (tickRef.current) clearInterval(tickRef.current); tickRef.current = null; };

  useAtEffect(() => () => { stopStream(); }, []);

  const connect = (d) => { setDevice(d); setPhase('connecting'); setTimeout(() => { setPhase('connected'); startStream(); }, 1500); };
  const calibrate = () => {
    setPhase('calibrating'); setCalProgress(0);
    const dur = 6000, t0 = performance.now();
    const iv = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / dur);
      setCalProgress(p);
      if (p >= 1) { clearInterval(iv); setBaseline({ bpm: tele.bpm, sdnn: Math.max(18, tele.sdnn) }); setPhase('live'); engine.start(); }
    }, 80);
  };
  const disconnect = () => { stopStream(); engine.stop(); setPhase('idle'); setDevice(null); setBaseline(null); };

  const map = MAPPINGS.find((m) => m.id === mapping);

  return (
    <div className="page attune">
      <div className="page-inner narrow">
        <header className="page-head">
          <div className="page-eyebrow font-mono">Attune · biofeedback</div>
          <h1 className="page-title font-display">Let your body shape the field.</h1>
          <p className="page-sub font-body">Pair a heart or breath sensor and the sound responds to your physiology in real time — coupling, brightness and drift follow your nervous system. Opt-in, per channel, and never stored without consent.</p>
        </header>

        {phase === 'idle' && (
          <div className="attune-connect">
            <div className="section-label font-mono">Choose a sensor</div>
            <ul className="device-list">
              {DEVICES.map((d) => (
                <li key={d.id} className="device-row" onClick={() => connect(d)}>
                  <div className="device-meta">
                    <span className={'device-led cap-' + d.cap} />
                    <div>
                      <div className="device-name font-body">{d.name}{d.recommended && <span className="device-rec font-mono">no hardware needed</span>}</div>
                      <div className="device-sub font-mono">{d.metric} · {d.transport}</div>
                    </div>
                  </div>
                  <span className="device-go font-mono">Connect <Icon name="arrowRight" size={12} /></span>
                </li>
              ))}
            </ul>
            <label className="consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="font-body">I consent to processing this physiological channel for live sonification. Nothing is uploaded or stored; the stream stays on this device and stops when I disconnect.</span>
            </label>
          </div>
        )}

        {phase === 'connecting' && (
          <div className="attune-status">
            <div className="connect-spinner" />
            <p className="font-mono attune-status-main">Pairing with {device.name}…</p>
            <p className="font-body attune-status-sub">Establishing the {device.transport === 'mock' ? 'simulated' : device.transport} telemetry stream.</p>
          </div>
        )}

        {phase === 'connected' && (
          <div className="attune-status">
            <div className="connect-ok"><Icon name="check" size={20} /></div>
            <p className="font-mono attune-status-main">{device.name} connected</p>
            <p className="font-body attune-status-sub">Before we couple it to the sound, sit comfortably for a short baseline so your resting rhythm sets the scale.</p>
            <button className="primary attune-cal" onClick={calibrate}><span className="font-mono primary-label">Begin 60-second baseline</span></button>
            <button className="attune-skip font-mono" onClick={() => { setBaseline({ bpm: 62, sdnn: 38 }); setPhase('live'); engine.start(); }}>Skip baseline</button>
          </div>
        )}

        {phase === 'calibrating' && (
          <div className="attune-status">
            <div className="cal-ring" style={{ '--p': calProgress }}>
              <span className="cal-pct font-mono tnum">{Math.round(calProgress * 100)}%</span>
            </div>
            <p className="font-mono attune-status-main">Measuring resting baseline</p>
            <p className="font-body attune-status-sub">Breathe naturally. Computing average R-R interval and SDNN.</p>
            <div className="cal-live font-mono tnum">{Math.round(tele.bpm)} <span className="cal-unit">bpm</span></div>
          </div>
        )}

        {phase === 'live' && (
          <div className="attune-live">
            <div className="live-pulse-wrap">
              <span className="live-pulse" style={{ animationDuration: (tele.rr / 1000).toFixed(2) + 's' }} />
              <span className="live-bpm font-mono tnum">{Math.round(tele.bpm)}</span>
              <span className="live-bpm-unit font-mono">bpm</span>
            </div>

            <div className="tele-grid">
              <div className="tele"><span className="tele-k font-mono">R-R interval</span><span className="tele-v font-mono tnum">{Math.round(tele.rr)} ms</span></div>
              <div className="tele"><span className="tele-k font-mono">SDNN</span><span className="tele-v font-mono tnum">{tele.sdnn.toFixed(1)} ms</span></div>
              <div className="tele"><span className="tele-k font-mono">Coherence</span><span className="tele-v font-mono tnum">{Math.round(tele.coherence * 100)}%</span></div>
              <div className="tele"><span className="tele-k font-mono">Baseline</span><span className="tele-v font-mono tnum">{baseline ? Math.round(baseline.bpm) : '—'} bpm</span></div>
            </div>

            <div className="map-section">
              <div className="section-label font-mono">Mapping</div>
              <div className="chip-row">
                {MAPPINGS.map((m) => <Chip key={m.id} active={m.id === mapping} onClick={() => setMapping(m.id)}>{m.label}</Chip>)}
              </div>
              <p className="map-desc font-body">{map.desc}</p>
              <div className="map-meter">
                <span className="map-meter-label font-mono">{map.target}</span>
                <div className="map-bar"><div className="map-fill" style={{ width: (tele.target * 100) + '%' }} /></div>
                <span className="map-meter-val font-mono tnum">{tele.target.toFixed(2)}</span>
              </div>
            </div>

            <div className="live-controls">
              <button className={'pill font-mono' + (coupled ? ' is-on' : '')} onClick={() => setCoupled((c) => !c)}>{coupled ? 'Coupled to field' : 'Coupling paused'}</button>
              <button className="pill font-mono" onClick={() => app.navigate('listen')}>Open in Listen</button>
              <button className="pill font-mono danger-pill" onClick={disconnect}>Disconnect</button>
            </div>

            <p className="disclaimer-inline font-mono">Live telemetry is processed on-device and discarded on disconnect. Not a medical device.</p>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { AttuneScreen });
