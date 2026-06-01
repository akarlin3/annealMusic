// screen-history.jsx — private, calm session record (v4.5). No streaks, no goals.
const { useState: useHState } = React;

function fmtDur(min) {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return m ? `${h} hr ${m} min` : `${h} hr`;
}
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function ReflectionEditor({ value, onSave }) {
  const [editing, setEditing] = useHState(false);
  const [text, setText] = useHState(value || '');
  if (!editing && !value) {
    return <button className="refl-add font-mono" onClick={() => setEditing(true)}>+ Add a private reflection</button>;
  }
  if (!editing) {
    return (
      <div className="refl-view">
        <p className="refl-text font-body">{value}</p>
        <button className="refl-edit font-mono" onClick={() => { setText(value); setEditing(true); }}>Edit</button>
      </div>
    );
  }
  return (
    <div className="refl-edit-box">
      <textarea className="refl-area font-body" maxLength={500} value={text} placeholder="Just for you — never shared."
        onChange={(e) => setText(e.target.value)} autoFocus />
      <div className="refl-controls">
        <span className="refl-count font-mono">{text.length}/500</span>
        <button className="refl-cancel font-mono" onClick={() => setEditing(false)}>Cancel</button>
        <button className="refl-save font-mono" onClick={() => { onSave(text.trim()); setEditing(false); }}>Save</button>
      </div>
    </div>
  );
}

function HistoryScreen() {
  const app = useApp();
  const { sessions, stats } = app;

  return (
    <div className="page history">
      <div className="page-inner narrow">
        <header className="page-head">
          <div className="page-eyebrow font-mono">Your sessions</div>
          <h1 className="page-title font-display">A quiet record, only for you.</h1>
          <p className="page-sub font-body">Private by default. No streaks, no goals, no comparisons — just what happened, described plainly.</p>
        </header>

        {stats.total > 0 && (
          <div className="stats-card">
            <p className="stats-main font-body">
              {stats.monthCount} {stats.monthCount === 1 ? 'session' : 'sessions'}, {fmtDur(stats.monthMinutes)} total this month.
            </p>
            <p className="stats-sub font-mono">{stats.total} all-time · average {fmtDur(stats.avgMinutes)}</p>
          </div>
        )}

        {sessions.length === 0 ? (
          <p className="empty font-body">Your sessions will appear here.</p>
        ) : (
          <ul className="sess-list">
            {sessions.map((p) => (
              <li key={p.id} className="sess-item">
                <div className="sess-top">
                  <div>
                    <div className="sess-date font-mono">{fmtDate(p.startedAt)}</div>
                    <h2 className="sess-title font-body">{p.title}</h2>
                    <div className="sess-dur font-mono">Listened {fmtDur(p.minutes)}</div>
                  </div>
                  <div className="sess-actions">
                    <button className="sess-btn" title="Replay this session" onClick={() => app.replaySession(p)}><Icon name="play" size={13} /></button>
                    <button className="sess-btn danger" title="Forget this session" onClick={() => app.forgetSession(p.id)}><Icon name="trash" size={13} /></button>
                  </div>
                </div>
                <ReflectionEditor value={p.reflection} onSave={(text) => app.saveReflection(p.id, text)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { HistoryScreen });
