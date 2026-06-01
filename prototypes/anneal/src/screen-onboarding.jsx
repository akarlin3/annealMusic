// screen-onboarding.jsx — calm first-run flow
const { useState: useOnbState } = React;

const VOICE_CARDS = [
  { mode: 'meditation', blurb: 'The interface recedes. The breath leads. For rest and presence.' },
  { mode: 'musician', blurb: 'Full tactile control of the harmonic lattice, with fast feedback. For shaping sound.' },
  { mode: 'researcher', blurb: 'Telemetry, spectrum traces, and exact frequencies. For understanding the physics.' },
];

const PROMISES = [
  'No streaks, points, levels, or badges.',
  'No notifications, emails, or reminders to come back.',
  'No public profile. Your practice is yours alone.',
  'The sound fades to silence when you leave — never autoplay.',
];

function OnboardingScreen() {
  const app = useApp();
  const { mode, setMode, engine, tweaks, reduceMotion } = app;
  const [step, setStep] = useOnbState(0);

  return (
    <div className="onboard">
      <div className="onboard-vis">
        <Visualizer audioRef={engine.audioRef} paramsRef={engine.paramsRef} mode={mode}
          isPlaying={engine.isPlaying} intensity={tweaks.intensity * 0.8} reduceMotion={reduceMotion} />
      </div>

      <div className="onboard-content">
        {step === 0 && (
          <div className="onboard-panel">
            <div className="onboard-eyebrow font-mono">Welcome</div>
            <h1 className="onboard-word font-display">Anneal</h1>
            <p className="onboard-lede font-body">A generative ambient instrument. Coupled oscillators drift over a harmonic lattice — a sound that is never quite the same twice, and asks nothing of you.</p>
            <button className="primary onboard-cta" onClick={() => setStep(1)}>
              <span className="font-mono primary-label">Continue</span><Icon name="arrowRight" size={13} />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="onboard-panel wide">
            <div className="onboard-eyebrow font-mono">Choose a voice</div>
            <h2 className="onboard-h2 font-display">How would you like to begin?</h2>
            <p className="onboard-sub font-body">The same instrument, three temperaments. You can change this anytime.</p>
            <div className="voice-cards">
              {VOICE_CARDS.map((v) => (
                <button key={v.mode} className={'voice-card' + (mode === v.mode ? ' is-active' : '')} onClick={() => setMode(v.mode)} data-mode={v.mode}>
                  <span className="voice-name font-display">{MODE_META[v.mode].label}</span>
                  <span className="voice-blurb font-body">{v.blurb}</span>
                  <span className={'voice-check' + (mode === v.mode ? ' on' : '')}>{mode === v.mode && <Icon name="check" size={12} />}</span>
                </button>
              ))}
            </div>
            <button className="primary onboard-cta" onClick={() => setStep(2)}>
              <span className="font-mono primary-label">Continue</span><Icon name="arrowRight" size={13} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="onboard-panel">
            <div className="onboard-eyebrow font-mono">Calm by design</div>
            <h2 className="onboard-h2 font-display">A few things this will never do.</h2>
            <ul className="promises">
              {PROMISES.map((p, i) => <li key={i} className="font-body"><span className="promise-x"><Icon name="x" size={11} /></span>{p}</li>)}
            </ul>
            <p className="onboard-fine font-body">Anneal is a meditation tool, not an engagement product. It exists to support a practice — never to maximize your time here.</p>
            <button className="primary onboard-cta" onClick={() => { app.finishOnboarding(); app.navigate('listen'); }}>
              <Icon name="play" size={13} /><span className="font-mono primary-label">Enter</span>
            </button>
          </div>
        )}

        <div className="onboard-dots">
          {[0, 1, 2].map((i) => <span key={i} className={'dot' + (i <= step ? ' filled' : '')} onClick={() => setStep(i)} />)}
          <button className="onboard-skip font-mono" onClick={() => { app.finishOnboarding(); app.navigate('listen'); }}>Skip</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { OnboardingScreen });
