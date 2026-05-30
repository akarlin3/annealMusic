import { useState } from 'react';
import { clearStepOverride, setStepOverride, type GenStep } from './adminApi';

interface StepOverrideEditorProps {
  step: GenStep;
  onChanged: () => void;
}

// Per-step override editor: the generated content is shown read-only beside an
// editable JSON override. A saved override wins over the generated config
// everywhere the step is served, and is never regenerated.
export function StepOverrideEditor({
  step,
  onChanged,
}: StepOverrideEditorProps) {
  const hasOverride = step.manual_override_content !== null;
  const [draft, setDraft] = useState<string>(() =>
    JSON.stringify(step.manual_override_content ?? step.config, null, 2),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const parsed = JSON.parse(draft) as Record<string, unknown>;
      await setStepOverride(step.id, parsed);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save override');
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError(null);
    try {
      await clearStepOverride(step.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear override');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-step-card">
      <div className="admin-step-head">
        <span className="admin-step-pos">#{step.position}</span>
        <span className="admin-step-type">{step.type}</span>
        {hasOverride && (
          <span className="admin-badge admin-badge-override">override</span>
        )}
        {step.prompt_version && (
          <span className="admin-step-meta">{step.prompt_version}</span>
        )}
      </div>

      <details className="admin-step-generated">
        <summary>Generated content</summary>
        <pre className="admin-pre">{JSON.stringify(step.config, null, 2)}</pre>
      </details>

      <label className="admin-label">Manual override (JSON)</label>
      <textarea
        className="admin-textarea admin-textarea-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
      />
      {error && <p className="admin-error">{error}</p>}
      <div className="admin-row">
        <button
          className="learn-primary-btn admin-btn-sm"
          onClick={save}
          disabled={busy}
        >
          Save override
        </button>
        <button
          className="learn-secondary-btn admin-btn-sm"
          onClick={clear}
          disabled={busy || !hasOverride}
        >
          Clear override
        </button>
      </div>
    </div>
  );
}
