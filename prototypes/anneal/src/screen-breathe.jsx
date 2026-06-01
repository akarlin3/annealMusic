// screen-breathe.jsx — dedicated breathing / meditation session view
const { useState: useBrState, useEffect: useBrEffect, useRef: useBrRef } = React;

const SESSION_LENGTHS = [5, 10, 15, 20];

function fmtClock(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function BreatheScreen() {
  const app = useApp();
  const { mode, engine, tweaks, reduceMotion } = app;
  const [pattern, setPattern] = useBrState('box');
  const [lengthMin, setLengthMin] = useBrState(10);
  const [running, setRunning] = useBrState(false);
  const [elapsed, setElapsed] = useBrState(0);
  const timerRef = useBrRef(null);

  useBrEffect(() => {
    if (!running) return;
    timerRef.current = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        if (next >= lengthMin * 60) { end(); return lengthMin * 60; }
        return next;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line
  }, [running, lengthMin]);

  const begin = () => { setElapsed(0); setRunning(true); engine.start(); };
  const end = () => { setRunning(false); engine.stop(); if (timerRef.current) clearInterval(timerRef.current); };

  const remaining = Math.max(0, lengthMin * 60 - elapsed);
  const pat = BREATH_PATTERNS[pattern];

  return (
    <div className="breathe">
      <Visualizer audioRef={engine.audioRef} paramsRef={engine.paramsRef} mode={mode}
        isPlaying={engine.isPlaying} intensity={tweaks.intensity * 0.7} reduceMotion={reduceMotion} />
      <BreathOverlay tuple={pat.tuple} active={running} reduceMotion={reduceMotion} big />

      {!running ? (
        <div className="breathe-setup">
          <div className="breathe-eyebrow font-mono">Breathing session</div>
          <h1 className="breathe-title font-display">Pace the breath, settle the field.</h1>
          <p className="breathe-note font-body">{pat.note}</p>

          <div className="breathe-group">
            <div className="breathe-label font-mono">Pattern</div>
            <div className="chip-row">
              {Object.entries(BREATH_PATTERNS).map(([id, p]) => (
                <Chip key={id} active={id === pattern} onClick={() => setPattern(id)}>{p.label}</Chip>
              ))}
            </div>
          </div>

          <div className="breathe-group">
            <div className="breathe-label font-mono">Length</div>
            <div className="chip-row">
              {SESSION_LENGTHS.map((m) => (
                <Chip key={m} active={m === lengthMin} onClick={() => setLengthMin(m)}>{m} min</Chip>
              ))}
            </div>
          </div>

          <button className="primary breathe-begin" onClick={begin}>
            <Icon name="play" size={13} />
            <span className="font-mono primary-label">Begin</span>
          </button>
        </div>
      ) : (
        <div className="breathe-running">
          <div className="breathe-timer font-mono tnum">{fmtClock(remaining)}</div>
          <div className="breathe-pattern-name font-mono">{pat.label}</div>
          <button className="pill font-mono breathe-end" onClick={end}>End session</button>
        </div>
      )}

      <div className="disclaimer font-mono">Breath pacing is a visual guide only — find a rhythm that feels comfortable.</div>
    </div>
  );
}

Object.assign(window, { BreatheScreen });
