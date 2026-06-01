// screen-learn.jsx — Education surface: curriculum browser + split lesson player
const { useState: useLnState, useEffect: useLnEffect, useRef: useLnRef } = React;

const LEARN_CONTROLS = [
  { key: 'rootFreq',   label: 'Root',       min: 55,  max: 220, step: 1,    fmt: v => `${v.toFixed(0)} Hz` },
  { key: 'spread',     label: 'Spread',     min: 0.7, max: 1.3, step: 0.01, fmt: v => v.toFixed(2) },
  { key: 'coupling',   label: 'Coupling',   min: 0,   max: 1,   step: 0.01, fmt: v => v.toFixed(2) },
  { key: 'drift',      label: 'Drift',      min: 0,   max: 1,   step: 0.01, fmt: v => v.toFixed(2) },
  { key: 'brightness', label: 'Brightness', min: 0,   max: 1,   step: 0.01, fmt: v => v.toFixed(2) },
  { key: 'space',      label: 'Space',      min: 0,   max: 1,   step: 0.01, fmt: v => v.toFixed(2) },
];

const DIFF_LABEL = { intro: 'Intro', intermediate: 'Intermediate', advanced: 'Advanced' };

// ── Curriculum browser ──
function CurriculumBrowser({ onOpen }) {
  const app = useApp();
  const prog = app.lessonProgress;
  const completedCount = LESSONS.filter((l) => prog[l.id]?.completed).length;
  const tracks = [...new Set(LESSONS.map((l) => l.track))];

  // next-lesson offer: first 1-3 not-completed
  const offers = LESSONS.filter((l) => !prog[l.id]?.completed).slice(0, 3);

  return (
    <div className="page learn-browser">
      <div className="page-inner">
        <header className="page-head">
          <div className="page-eyebrow font-mono">Learn</div>
          <h1 className="page-title font-display">Understand the instrument.</h1>
          <p className="page-sub font-body">Self-paced explorations of the math and sound behind Anneal. Move at your own pace — nothing is gated, nothing is timed.</p>
        </header>

        {offers.length > 0 && (
          <section className="offer">
            <div className="section-label font-mono">{completedCount === 0 ? 'Start here' : 'Where to next'}</div>
            <div className="offer-row">
              {offers.map((l) => (
                <button key={l.id} className="offer-card" onClick={() => onOpen(l.id)}>
                  <span className="offer-track font-mono">{l.track}</span>
                  <span className="offer-title font-display">{l.title}</span>
                  <span className="offer-why font-body">{l.summary}</span>
                  <span className="offer-go font-mono">{prog[l.id]?.step > 0 ? 'Resume →' : 'Begin →'}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {tracks.map((track) => (
          <section key={track} className="track">
            <div className="section-label font-mono">{track}</div>
            <ul className="lesson-list">
              {LESSONS.filter((l) => l.track === track).map((l) => {
                const p = prog[l.id] || {};
                return (
                  <li key={l.id} className="lesson-row" onClick={() => onOpen(l.id)}>
                    <div className="lesson-meta">
                      <span className={'lesson-state' + (p.completed ? ' done' : '')}>
                        {p.completed ? <Icon name="check" size={12} /> : <Icon name="dot" size={8} />}
                      </span>
                      <div>
                        <h3 className="lesson-title font-body">{l.title}</h3>
                        <p className="lesson-summary font-body">{l.summary}</p>
                      </div>
                    </div>
                    <div className="lesson-right font-mono">
                      <span className="lesson-diff">{DIFF_LABEL[l.difficulty]}</span>
                      <span className="lesson-min">{l.minutes} min</span>
                      {p.step > 0 && !p.completed && <span className="lesson-resume">Resume</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <p className="learn-count font-mono">{completedCount} of {LESSONS.length} lessons explored</p>
      </div>
    </div>
  );
}

// ── Mini instrument panel (embedded in lesson player) ──
function LessonInstrument({ allow, highlight }) {
  const app = useApp();
  const { engine, params, setParam, mode, tweaks, reduceMotion } = app;
  const constrained = allow && allow.length > 0;
  return (
    <div className="instrument">
      <div className="instrument-vis">
        <Visualizer audioRef={engine.audioRef} paramsRef={engine.paramsRef} mode={mode}
          isPlaying={engine.isPlaying} intensity={tweaks.intensity} reduceMotion={reduceMotion} />
        <button className={'inst-play' + (engine.isPlaying ? ' is-playing' : '')} onClick={engine.toggle}>
          {engine.isPlaying
            ? <svg width="12" height="12" viewBox="0 0 16 16"><rect x="4" y="3.2" width="2.6" height="9.6" rx="0.6" fill="currentColor"/><rect x="9.4" y="3.2" width="2.6" height="9.6" rx="0.6" fill="currentColor"/></svg>
            : <Icon name="play" size={12} />}
          <span className="font-mono">{engine.isPlaying ? 'Stop' : 'Hear it'}</span>
        </button>
      </div>
      <div className="inst-controls">
        {LEARN_CONTROLS.map((c) => {
          const locked = constrained && !allow.includes(c.key);
          const hot = highlight === c.key;
          return (
            <div key={c.key} className={'inst-row' + (locked ? ' locked' : '') + (hot ? ' hot' : '')}>
              <div className="inst-row-top">
                <label className="inst-label">{c.label}{locked && <span className="font-mono inst-lock">lesson</span>}</label>
                <span className="inst-val font-mono tnum">{c.fmt(params[c.key])}</span>
              </div>
              <Range value={params[c.key]} min={c.min} max={c.max} step={c.step} disabled={locked} onChange={(v) => setParam(c.key, v)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Step body renderers ──
function StepBody({ step, reflection, onReflect }) {
  if (step.type === 'text') {
    return (
      <div className="step-body">
        <span className="step-kind font-mono">Concept</span>
        <h2 className="step-title font-display">{step.title}</h2>
        <p className="step-text font-body">{step.body}</p>
        {step.takeaways && (
          <ul className="takeaways">
            {step.takeaways.map((t, i) => <li key={i} className="font-body"><span className="tk-dot" />{t}</li>)}
          </ul>
        )}
      </div>
    );
  }
  if (step.type === 'demo') {
    return (
      <div className="step-body">
        <span className="step-kind font-mono">Demonstration</span>
        <h2 className="step-title font-display">{step.title}</h2>
        <p className="step-text font-body">{step.body}</p>
        <p className="step-hint font-mono">The instrument has been set to a starting pose →</p>
      </div>
    );
  }
  if (step.type === 'prompt') {
    return (
      <div className="step-body">
        <span className="step-kind font-mono">Try it</span>
        <h2 className="step-title font-display">{step.title}</h2>
        <p className="step-text font-body">{step.body}</p>
        {step.hint && <p className="step-hint font-mono">{step.hint}</p>}
      </div>
    );
  }
  // reflection
  return (
    <div className="step-body">
      <span className="step-kind font-mono">Reflection</span>
      <h2 className="step-title font-display">{step.title}</h2>
      <p className="step-text font-body">{step.question}</p>
      <textarea className="refl-area learn-refl font-body" placeholder="Optional, private, and saved only on this device."
        value={reflection} onChange={(e) => onReflect(e.target.value)} maxLength={500} />
      <p className="step-hint font-mono">Reflections are voluntary — you can move on whenever you like.</p>
    </div>
  );
}

// ── Lesson player ──
function LessonPlayer({ lessonId, onExit }) {
  const app = useApp();
  const lesson = LESSONS.find((l) => l.id === lessonId);
  const saved = app.lessonProgress[lessonId] || {};
  const [stepIdx, setStepIdx] = useLnState(saved.step || 0);
  const [reflections, setReflections] = useLnState(saved.reflections || {});
  const [highlight, setHighlight] = useLnState(null);
  const step = lesson.steps[stepIdx];

  // apply demo patch + highlight when entering a demo/prompt step
  useLnEffect(() => {
    if (step.type === 'demo' && step.patch) {
      app.loadParams(step.patch);
      if (step.highlight) { setHighlight(step.highlight); const t = setTimeout(() => setHighlight(null), 3000); return () => clearTimeout(t); }
    } else if (step.type === 'prompt' && step.hint) {
      if (step.allow && step.allow[0]) { setHighlight(step.allow[0]); const t = setTimeout(() => setHighlight(null), 3000); return () => clearTimeout(t); }
    }
    // eslint-disable-next-line
  }, [stepIdx, lessonId]);

  useLnEffect(() => { app.setLessonStep(lessonId, stepIdx); /* eslint-disable-next-line */ }, [stepIdx]);

  const isLast = stepIdx === lesson.steps.length - 1;
  const allow = step.type === 'prompt' ? step.allow : null;

  const next = () => {
    if (isLast) { app.completeLesson(lessonId, reflections); onExit(); }
    else setStepIdx((i) => i + 1);
  };
  const onReflect = (text) => setReflections((r) => ({ ...r, [stepIdx]: text }));

  return (
    <div className="page lesson-player">
      <div className="player-bar">
        <button className="player-back font-mono" onClick={onExit}><Icon name="arrowLeft" size={13} /> All lessons</button>
        <span className="player-lesson font-mono">{lesson.title}</span>
        <ProgressDots total={lesson.steps.length} current={stepIdx} />
      </div>
      <div className="player-split">
        <div className="player-left">
          <StepBody step={step} reflection={reflections[stepIdx] || ''} onReflect={onReflect} />
          <div className="player-nav">
            <button className="pnav-prev font-mono" disabled={stepIdx === 0} onClick={() => setStepIdx((i) => Math.max(0, i - 1))}>
              <Icon name="arrowLeft" size={13} /> Back
            </button>
            <button className="pnav-next font-mono" onClick={next}>
              {isLast ? 'Complete' : 'Next'} <Icon name={isLast ? 'check' : 'arrowRight'} size={13} />
            </button>
          </div>
        </div>
        <div className="player-right">
          <LessonInstrument allow={allow} highlight={highlight} />
        </div>
      </div>
    </div>
  );
}

function LearnScreen() {
  const [openId, setOpenId] = useLnState(null);
  if (openId) return <LessonPlayer lessonId={openId} onExit={() => setOpenId(null)} />;
  return <CurriculumBrowser onOpen={setOpenId} />;
}

Object.assign(window, { LearnScreen });
