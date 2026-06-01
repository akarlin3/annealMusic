// input-loop.jsx — Live input + Loop pedal, shown as the Listen "Perform" drawer.
// (docs/INPUT_GUIDE.md, docs/LOOP_GUIDE.md). Input meter is real when mic is granted.
const { useState: useIlState, useEffect: useIlEffect, useRef: useIlRef } = React;

const MOCK_DEVICES = ['Default — System microphone', 'Scarlett 2i2 USB', 'BlackHole 2ch (loopback)'];
const SLOT_IDS = ['A', 'B', 'C'];

// Real mic level when permission granted; otherwise a believable simulated signal.
function InputMeter({ active }) {
  const [level, setLevel] = useIlState(0);
  const [clip, setClip] = useIlState(false);
  const [src, setSrc] = useIlState('sim');
  const rafRef = useIlRef(null), ctxRef = useIlRef(null), anRef = useIlRef(null), streamRef = useIlRef(null);
  useIlEffect(() => {
    if (!active) { setLevel(0); return; }
    let cancelled = false, buf = null, t = 0, frame = 0;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        if (cancelled) { stream.getTracks().forEach((x) => x.stop()); return; }
        streamRef.current = stream;
        const ctx = new (window.AudioContext || window.webkitAudioContext)(); ctxRef.current = ctx;
        const s = ctx.createMediaStreamSource(stream); const an = ctx.createAnalyser(); an.fftSize = 512; s.connect(an);
        anRef.current = an; buf = new Uint8Array(an.fftSize); setSrc('mic');
      } catch (e) { setSrc('sim'); }
      const loop = () => {
        frame++;
        if (frame % 2 === 0) {
          if (anRef.current && buf) {
            anRef.current.getByteTimeDomainData(buf);
            let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
            const rms = Math.min(1, Math.sqrt(sum / buf.length) * 2.2); setLevel(rms); setClip(rms > 0.92);
          } else {
            t += 0.08; const v = 0.32 + 0.26 * Math.sin(t * 1.7) + 0.12 * Math.sin(t * 5.3) + (Math.random() - 0.5) * 0.12;
            const lv = Math.max(0, Math.min(1, v)); setLevel(lv); setClip(lv > 0.92);
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    })();
    return () => { cancelled = true; if (rafRef.current) cancelAnimationFrame(rafRef.current); if (streamRef.current) streamRef.current.getTracks().forEach((x) => x.stop()); if (ctxRef.current) { try { ctxRef.current.close(); } catch (e) {} } };
  }, [active]);

  const seg = 24;
  return (
    <div className="meter">
      <div className="meter-bars">
        {Array.from({ length: seg }).map((_, i) => {
          const on = level * seg > i;
          const hot = i > seg * 0.82;
          return <span key={i} className={'meter-seg' + (on ? (hot ? ' on hot' : ' on') : '')} />;
        })}
        <span className={'meter-clip font-mono' + (clip ? ' flash' : '')}>clip</span>
      </div>
      <div className="meter-src font-mono">{src === 'mic' ? 'live mic' : 'simulated signal'}</div>
    </div>
  );
}

function makeWave() { return Array.from({ length: 40 }).map(() => 0.15 + Math.random() * 0.85); }

function LoopSlot({ slot, onArm, onStop, onFreeze, onMute, onClear }) {
  const { id, state, secs, muted, frozen, wave, grain } = slot;
  return (
    <div className={'slot' + (state !== 'empty' ? ' active' : '') + (frozen ? ' frozen' : '') + (muted ? ' muted' : '')}>
      <div className="slot-top">
        <span className="slot-id font-display">{id}</span>
        <span className="slot-state font-mono">
          {state === 'empty' && 'empty'}
          {state === 'armed' && 'armed · play to start'}
          {state === 'recording' && <span className="rec"><span className="rec-dot" /> rec {secs.toFixed(1)}s</span>}
          {state === 'playing' && (frozen ? 'frozen' : 'looping')}
        </span>
      </div>
      {(state === 'playing') && (
        <div className="slot-wave">{wave.map((h, i) => <span key={i} style={{ height: (h * 100) + '%' }} />)}</div>
      )}
      {state === 'frozen-controls' ? null : null}
      <div className="slot-controls font-mono">
        {state === 'empty' && <button onClick={() => onArm(id)}>Arm</button>}
        {state === 'armed' && <button onClick={() => onStop(id)}>Cancel</button>}
        {state === 'recording' && <button className="slot-stop" onClick={() => onStop(id)}>Stop</button>}
        {state === 'playing' && <>
          <button className={frozen ? 'on' : ''} onClick={() => onFreeze(id)} title="Freeze (granular)">❄</button>
          <button className={muted ? 'on' : ''} onClick={() => onMute(id)} title="Mute">{muted ? 'muted' : 'mute'}</button>
          <button onClick={() => onClear(id)} title="Clear"><Icon name="trash" size={12} /></button>
        </>}
      </div>
      {state === 'playing' && frozen && (
        <div className="grain-controls">
          {[['size', 'Grain', 30, 300, 'ms'], ['density', 'Density', 4, 40, '/s'], ['pos', 'Pos jitter', 0, 100, '%'], ['pitch', 'Pitch jitter', 0, 100, '¢']].map(([k, label, mn, mx, unit]) => (
            <div key={k} className="grain-row">
              <span className="grain-label font-mono">{label}</span>
              <Range value={grain[k]} min={mn} max={mx} step={1} disabled={false} onChange={() => {}} />
              <span className="grain-val font-mono tnum">{grain[k]}{unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PerformDrawer({ open, onClose }) {
  const [conn, setConn] = useIlState('off'); // off | connecting | on
  const [device, setDevice] = useIlState(MOCK_DEVICES[0]);
  const [inputLevel, setInputLevel] = useIlState(0.7);
  const [monitoring, setMonitoring] = useIlState(false);
  const [slots, setSlots] = useIlState(SLOT_IDS.map((id) => ({ id, state: 'empty', secs: 0, muted: false, frozen: false, wave: [], grain: { size: 120, density: 18, pos: 35, pitch: 0 } })));
  const recRef = useIlRef(null);

  const connect = () => { setConn('connecting'); setTimeout(() => setConn('on'), 1400); };
  const disconnect = () => { setConn('off'); };

  const upd = (id, patch) => setSlots((ss) => ss.map((s) => s.id === id ? { ...s, ...patch } : s));
  const arm = (id) => { upd(id, { state: 'recording', secs: 0 }); startRec(id); };
  const startRec = (id) => {
    const t0 = performance.now();
    recRef.current = setInterval(() => {
      const secs = (performance.now() - t0) / 1000;
      setSlots((ss) => ss.map((s) => s.id === id ? { ...s, secs } : s));
      if (secs >= 60) stop(id);
    }, 100);
  };
  const stop = (id) => {
    if (recRef.current) { clearInterval(recRef.current); recRef.current = null; }
    setSlots((ss) => ss.map((s) => s.id === id ? (s.state === 'recording' && s.secs > 0.25 ? { ...s, state: 'playing', wave: makeWave() } : { ...s, state: 'empty', secs: 0 }) : s));
  };
  const freeze = (id) => upd(id, { frozen: !slots.find((s) => s.id === id).frozen });
  const mute = (id) => upd(id, { muted: !slots.find((s) => s.id === id).muted });
  const clear = (id) => upd(id, { state: 'empty', secs: 0, wave: [], frozen: false, muted: false });

  useIlEffect(() => () => { if (recRef.current) clearInterval(recRef.current); }, []);

  return (
    <div className={'perform' + (open ? ' is-open' : '')} role="dialog" aria-label="Perform" aria-hidden={!open}>
      <div className="perform-head">
        <span className="font-mono sculpt-title">Perform · live input &amp; loops</span>
        <button className="sculpt-x font-mono" onClick={onClose}>Done</button>
      </div>
      <div className="perform-grid">
        <div className="perform-input">
          <div className="sculpt-group font-mono">Live input</div>
          {conn === 'off' && (
            <div className="input-off">
              <p className="input-note font-body">Plug in an instrument or mic to blend it into the field. <strong>Use headphones</strong> — monitoring is off by default to avoid feedback.</p>
              <button className="pill font-mono input-connect" onClick={connect}>Connect input</button>
            </div>
          )}
          {conn === 'connecting' && <div className="input-connecting"><span className="ai-spinner" /><span className="font-mono">Requesting input…</span></div>}
          {conn === 'on' && (
            <div className="input-on">
              <label className="in-field"><span className="in-label font-mono">Device</span>
                <select className="in-select font-body" value={device} onChange={(e) => setDevice(e.target.value)}>
                  {MOCK_DEVICES.map((d) => <option key={d}>{d}</option>)}
                </select>
              </label>
              <InputMeter active={true} />
              <div className="in-row">
                <span className="in-label font-mono">Input level</span>
                <Range value={inputLevel} min={0} max={1} step={0.01} disabled={false} onChange={setInputLevel} />
                <span className="in-val font-mono tnum">{Math.round(inputLevel * 100)}</span>
              </div>
              <div className="in-toggle-row">
                <button className={'pill font-mono' + (monitoring ? ' is-on' : '')} onClick={() => setMonitoring((m) => !m)}>{monitoring ? 'Monitoring on' : 'Monitoring off'}</button>
                <span className="in-latency font-mono">~12 ms out</span>
                <button className="pill font-mono" onClick={disconnect}>Disconnect</button>
              </div>
              <p className="input-note font-body small">Input is processed locally and never uploaded, saved, or shared.</p>
            </div>
          )}
        </div>

        <div className="perform-loop">
          <div className="sculpt-group font-mono">Loop pedal {conn !== 'on' && <span className="loop-need">connect input to capture</span>}</div>
          <div className={'slots' + (conn !== 'on' ? ' disabled' : '')}>
            {slots.map((s) => <LoopSlot key={s.id} slot={s} onArm={arm} onStop={stop} onFreeze={freeze} onMute={mute} onClear={clear} />)}
          </div>
          <p className="input-note font-body small">Arm a slot, play, and it loops on the first sound (60 s cap). Freeze (❄) sprays it into a granular drone.</p>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PerformDrawer });
