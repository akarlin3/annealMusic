import { useState } from 'react';
import { batchGenerate, type BatchResult, type GenStatus } from './adminApi';

interface BatchProps {
  lessons: GenStatus[];
  onDone: () => void;
}

// v6.4 — kick off generation for all pending/failed specs at once; results queue
// for review. Re-running an unchanged spec is a free cache hit, so this is safe
// to press repeatedly.
export function BatchGenerationDashboard({ lessons, onDone }: BatchProps) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = lessons.filter(
    (l) =>
      l.spec &&
      (l.generation_status === 'pending' ||
        l.generation_status === 'generation_failed'),
  );

  async function runAll() {
    setBusy(true);
    setError(null);
    try {
      const res = await batchGenerate([]); // empty → all pending/failed
      setResult(res);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-section">
      <h3 className="admin-h3">Batch generation</h3>
      <p className="admin-hint">
        {pending.length} spec{pending.length === 1 ? '' : 's'} pending or
        failed.
      </p>
      <div className="admin-row">
        <button
          className="learn-primary-btn"
          disabled={busy || pending.length === 0}
          onClick={() => void runAll()}
        >
          {busy ? 'Generating…' : 'Generate all pending'}
        </button>
      </div>
      {error && <p className="admin-error">{error}</p>}
      {result && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Lesson</th>
              <th>Status</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {result.results.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>
                  <span
                    className={`admin-badge admin-badge-${statusClass(r.generation_status)}`}
                  >
                    {r.generation_status}
                  </span>
                </td>
                <td className="admin-cell-error">{r.generation_error ?? ''}</td>
              </tr>
            ))}
            {result.results.length === 0 && (
              <tr>
                <td colSpan={3} className="admin-hint">
                  Nothing to generate — all specs are already up to date.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}

function statusClass(status: string): string {
  if (status === 'ready') return 'pass';
  if (status === 'generation_failed') return 'fail';
  return 'warn';
}
