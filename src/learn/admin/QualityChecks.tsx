import { useCallback, useEffect, useState } from 'react';
import { runCurriculumQA, type CurriculumQA } from './adminApi';

// v6.4 — automated linting over the whole curriculum. Errors block publish;
// warnings are advisory. Pure, fast, no LLM.
export function QualityChecks() {
  const [qa, setQa] = useState<CurriculumQA | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setQa(await runCurriculumQA());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QA failed');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const flagged = qa?.lessons.filter((l) => l.status !== 'pass') ?? [];

  return (
    <section className="admin-section">
      <div className="admin-row admin-row-spread">
        <h3 className="admin-h3">Quality checks</h3>
        <button
          className="learn-secondary-btn admin-btn-sm"
          disabled={busy}
          onClick={() => void run()}
        >
          {busy ? 'Running…' : 'Re-run'}
        </button>
      </div>
      {error && <p className="admin-error">{error}</p>}
      {qa && (
        <>
          <p className="admin-hint">
            Overall:{' '}
            <span className={`admin-badge admin-badge-${qa.status}`}>
              {qa.status}
            </span>{' '}
            · {flagged.length} lesson{flagged.length === 1 ? '' : 's'} flagged ·{' '}
            {qa.graph_findings.length} graph finding
            {qa.graph_findings.length === 1 ? '' : 's'}
          </p>

          {qa.graph_findings.length > 0 && (
            <div className="admin-field">
              <label className="admin-label">Prerequisite graph</label>
              <ul className="admin-findings">
                {qa.graph_findings.map((f, i) => (
                  <li
                    key={i}
                    className={`admin-finding admin-finding-${f.level}`}
                  >
                    <span className="admin-finding-rule">{f.rule}</span>{' '}
                    {f.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {flagged.map((l) => (
            <div key={l.id} className="admin-field">
              <label className="admin-label">
                <span className={`admin-badge admin-badge-${l.status}`}>
                  {l.status}
                </span>{' '}
                {l.title}{' '}
                <span className="admin-hint">
                  ({l.errors}e / {l.warnings}w)
                </span>
              </label>
              <ul className="admin-findings">
                {l.findings.map((f, i) => (
                  <li
                    key={i}
                    className={`admin-finding admin-finding-${f.level}`}
                  >
                    <span className="admin-finding-rule">{f.rule}</span>{' '}
                    {f.message}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {flagged.length === 0 && qa.graph_findings.length === 0 && (
            <p className="admin-hint">All lessons pass. 🌿</p>
          )}
        </>
      )}
    </section>
  );
}
