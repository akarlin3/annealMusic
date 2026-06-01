// screen-settings.jsx — Account, Health & Integrations, privacy (opt-in only; docs/HEALTH, CALM_BY_DESIGN)
const { useState: useStState, useEffect: useStEffect } = React;

function Switch({ on, onChange, id }) {
  return (
    <button role="switch" aria-checked={on} id={id} className={'switch' + (on ? ' on' : '')} onClick={() => onChange(!on)}>
      <span className="switch-knob" />
    </button>
  );
}

function SettingRow({ title, desc, on, onChange, badge }) {
  return (
    <div className="set-row">
      <div className="set-row-text">
        <div className="set-row-title font-body">{title}{badge && <span className="set-badge font-mono">{badge}</span>}</div>
        <div className="set-row-desc font-body">{desc}</div>
      </div>
      <Switch on={on} onChange={onChange} />
    </div>
  );
}

function SettingsScreen() {
  const app = useApp();
  const [appleHealth, setAppleHealth] = useStState(() => localStorage.getItem('am_apple_health') === '1');
  const [googleHealth, setGoogleHealth] = useStState(() => localStorage.getItem('am_google_health') === '1');
  const [includeTimer, setIncludeTimer] = useStState(() => localStorage.getItem('am_include_timer') === '1');
  const [hints, setHints] = useStState(() => localStorage.getItem('am_hints') !== '0');

  useStEffect(() => { localStorage.setItem('am_apple_health', appleHealth ? '1' : '0'); }, [appleHealth]);
  useStEffect(() => { localStorage.setItem('am_google_health', googleHealth ? '1' : '0'); }, [googleHealth]);
  useStEffect(() => { localStorage.setItem('am_include_timer', includeTimer ? '1' : '0'); }, [includeTimer]);
  useStEffect(() => { localStorage.setItem('am_hints', hints ? '1' : '0'); }, [hints]);

  const exportCsv = () => {
    const rows = [['started_at', 'title', 'minutes_listened', 'has_reflection']];
    app.sessions.forEach((s) => rows.push([s.startedAt, '"' + s.title.replace(/"/g, '""') + '"', (s.minutes).toFixed(2), s.reflection ? 'yes' : 'no']));
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'annealmusic_history.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    app.toast('History exported as CSV.');
  };

  return (
    <div className="page settings">
      <div className="page-inner narrow">
        <header className="page-head">
          <div className="page-eyebrow font-mono">Settings</div>
          <h1 className="page-title font-display">Your account, your data.</h1>
          <p className="page-sub font-body">Everything here is opt-in. Nothing syncs, notifies, or leaves your device unless you switch it on.</p>
        </header>

        <section className="set-card">
          <div className="set-card-head font-mono">Account</div>
          <div className="set-account">
            <div className="set-account-text font-body">You're using Anneal anonymously. Sign in to keep your history and lesson progress across devices.</div>
            <button className="set-signin font-mono" onClick={() => app.toast('Sign-in is stubbed in this prototype.')}>Sign in</button>
          </div>
          <p className="set-fine font-body">No account is required to use any core feature.</p>
        </section>

        <section className="set-card">
          <div className="set-card-head font-mono">Health &amp; Integrations <span className="set-prem font-mono">Premium</span></div>
          <SettingRow title="Sync Mindful Minutes with Apple Health" desc="Writes completed and partial listening sessions to the iOS Health app under Mindful Minutes." on={appleHealth} onChange={(v) => { setAppleHealth(v); app.toast(v ? 'Apple Health enabled' : 'Apple Health disabled'); }} />
          <SettingRow title="Sync with Google Health Connect" desc="Writes your mindfulness sessions to Android Health Connect." on={googleHealth} onChange={(v) => { setGoogleHealth(v); app.toast(v ? 'Health Connect enabled' : 'Health Connect disabled'); }} />
          <SettingRow title="Include bell-timer sessions" desc="Include silent focus-timer sessions punctuated by chimes in synced records." on={includeTimer} onChange={setIncludeTimer} />
          <p className="set-fine font-body">Health sync is 100% voluntary and easily turned off. It never blocks any synthesis feature.</p>
        </section>

        <section className="set-card">
          <div className="set-card-head font-mono">Learning</div>
          <SettingRow title="Show learning hints" desc="Quiet “learn more” links next to engines and controls that open the matching lesson in a new tab. Never a nag." on={hints} onChange={setHints} />
        </section>

        <section className="set-card">
          <div className="set-card-head font-mono">Your data</div>
          <div className="set-account">
            <div className="set-account-text font-body">Download your complete listening history — dates, durations and tags — as a CSV. Free, no account needed.</div>
            <button className="set-signin font-mono" onClick={exportCsv}>Export CSV</button>
          </div>
          <p className="set-fine font-body">Your practice data is yours. It is never public, never shared, and never used to nudge you back.</p>
        </section>

        <button className="set-replay font-mono" onClick={() => { try { localStorage.removeItem('am_onboarded'); } catch (e) {} app.navigate('onboarding'); }}>Replay first-run experience</button>
      </div>
    </div>
  );
}

Object.assign(window, { SettingsScreen });
