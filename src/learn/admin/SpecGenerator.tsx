import { useState } from 'react';
import { generateSpec, type LessonSpecOut } from './adminApi';

const TRACKS = [
  'synthesis-fundamentals',
  'composition-technique',
  'ambient-history-listening',
  'production-daw',
  'music-science-crossover',
];

interface SpecGeneratorProps {
  // Hand the scaffolded spec to the spec editor for refinement + generation.
  onScaffold?: (specJson: string) => void;
}

// v6.4 — LLM-assisted spec scaffolding. Given a topic + outline, returns a
// *starting* spec the author always edits before generating. Never publishes.
export function SpecGenerator({ onScaffold }: SpecGeneratorProps) {
  const [topic, setTopic] = useState('');
  const [track, setTrack] = useState<string>('synthesis-fundamentals');
  const [outline, setOutline] = useState('');
  const [difficulty, setDifficulty] = useState<
    'intro' | 'intermediate' | 'advanced'
  >('intro');
  const [spec, setSpec] = useState<LessonSpecOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function scaffold() {
    setBusy(true);
    setError(null);
    try {
      const res = await generateSpec({
        topic: topic.trim(),
        track,
        outline: outline.trim() || undefined,
        difficulty,
      });
      setSpec(res.spec);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scaffold failed');
    } finally {
      setBusy(false);
    }
  }

  const specJson = spec ? JSON.stringify(spec, null, 2) : '';

  return (
    <section className="admin-section">
      <h3 className="admin-h3">Spec generator</h3>
      <p className="admin-hint">
        A starting point only — the draft is yours to refine before generating.
      </p>
      <div className="admin-field">
        <label className="admin-label">Topic</label>
        <input
          className="admin-input"
          value={topic}
          placeholder="e.g. The FM engine — carrier &amp; modulator"
          onChange={(e) => setTopic(e.target.value)}
        />
      </div>
      <div className="admin-row">
        <div className="admin-field admin-field-grow">
          <label className="admin-label">Track</label>
          <select
            className="admin-input"
            value={track}
            onChange={(e) => setTrack(e.target.value)}
          >
            {TRACKS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label">Difficulty</label>
          <select
            className="admin-input"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
          >
            <option value="intro">intro</option>
            <option value="intermediate">intermediate</option>
            <option value="advanced">advanced</option>
          </select>
        </div>
      </div>
      <div className="admin-field">
        <label className="admin-label">Outline (optional)</label>
        <textarea
          className="admin-textarea"
          rows={3}
          value={outline}
          placeholder="A few bullet points on what the lesson should cover…"
          onChange={(e) => setOutline(e.target.value)}
        />
      </div>
      <div className="admin-row">
        <button
          className="learn-primary-btn"
          disabled={busy || topic.trim().length < 2}
          onClick={() => void scaffold()}
        >
          {busy ? 'Scaffolding…' : 'Scaffold spec'}
        </button>
      </div>
      {error && <p className="admin-error">{error}</p>}
      {spec && (
        <div className="admin-field">
          <label className="admin-label">
            Draft spec — edit, then generate
          </label>
          <pre className="admin-code">{specJson}</pre>
          <div className="admin-row">
            <button
              className="learn-secondary-btn admin-btn-sm"
              onClick={() => void navigator.clipboard?.writeText(specJson)}
            >
              Copy JSON
            </button>
            {onScaffold && (
              <button
                className="learn-secondary-btn admin-btn-sm"
                onClick={() => onScaffold(specJson)}
              >
                Send to spec editor
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
