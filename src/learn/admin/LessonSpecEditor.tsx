import { useState } from 'react';
import { EXAMPLE_SPEC, generateLesson, type GenStatus } from './adminApi';

interface LessonSpecEditorProps {
  onGenerated: (status: GenStatus) => void;
}

// Authoring surface: paste/edit a lesson spec, then "Generate now" runs the
// LLM pipeline server-side and returns the per-step result.
export function LessonSpecEditor({ onGenerated }: LessonSpecEditorProps) {
  const [spec, setSpec] = useState<string>(EXAMPLE_SPEC);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const parsed = JSON.parse(spec) as unknown;
      const status = await generateLesson(parsed);
      onGenerated(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-section">
      <h3 className="admin-h3">Author a lesson spec</h3>
      <p className="admin-hint">
        A spec describes what the lesson covers; the LLM fills in the content.
        Generation is cached, so re-running the same spec is free.
      </p>
      <textarea
        className="admin-textarea"
        value={spec}
        onChange={(e) => setSpec(e.target.value)}
        spellCheck={false}
        rows={18}
      />
      {error && <p className="admin-error">{error}</p>}
      <div className="admin-row">
        <button
          className="learn-primary-btn"
          onClick={generate}
          disabled={busy}
        >
          {busy ? 'Generating…' : 'Generate now'}
        </button>
        <button
          className="learn-secondary-btn"
          onClick={() => setSpec(EXAMPLE_SPEC)}
          disabled={busy}
        >
          Reset to example
        </button>
      </div>
    </section>
  );
}
