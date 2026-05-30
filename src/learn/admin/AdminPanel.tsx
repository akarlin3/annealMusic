import { useCallback, useEffect, useState } from 'react';
import {
  getAdminKey,
  listLessons,
  regenerateLesson,
  setAdminKey,
  type GenStatus,
} from './adminApi';
import { LessonSpecEditor } from './LessonSpecEditor';
import { LessonStatusDashboard } from './LessonStatusDashboard';
import { StepOverrideEditor } from './StepOverrideEditor';

interface AdminPanelProps {
  onClose: () => void;
}

// Admin generation console: key gate → spec editor + status dashboard +
// per-step override editor. Reached at #admin.
export function AdminPanel({ onClose }: AdminPanelProps) {
  const [hasKey, setHasKey] = useState<boolean>(() => getAdminKey() !== null);
  const [keyInput, setKeyInput] = useState('');
  const [lessons, setLessons] = useState<GenStatus[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const rows = await listLessons();
      setLessons(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lessons');
    }
  }, []);

  useEffect(() => {
    if (hasKey) {
      void refresh();
    }
  }, [hasKey, refresh]);

  function submitKey() {
    if (keyInput.trim()) {
      setAdminKey(keyInput.trim());
      setHasKey(true);
    }
  }

  async function onGenerated(status: GenStatus) {
    await refresh();
    setSelectedId(status.id);
  }

  async function regenerate(id: string) {
    try {
      const status = await regenerateLesson(id);
      await refresh();
      setSelectedId(status.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regeneration failed');
    }
  }

  const selected = lessons.find((l) => l.id === selectedId) ?? null;

  if (!hasKey) {
    return (
      <div className="admin-panel admin-gate">
        <h2 className="admin-h2">Lesson generation — admin</h2>
        <p className="admin-hint">Enter the admin key to continue.</p>
        <input
          className="admin-input"
          type="password"
          value={keyInput}
          placeholder="x-admin-key"
          onChange={(e) => setKeyInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitKey();
          }}
        />
        <div className="admin-row">
          <button className="learn-primary-btn" onClick={submitKey}>
            Continue
          </button>
          <button className="learn-secondary-btn" onClick={onClose}>
            Back to /learn
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <header className="admin-header">
        <h2 className="admin-h2">Lesson generation — admin</h2>
        <button className="learn-secondary-btn" onClick={onClose}>
          Back to /learn
        </button>
      </header>
      {error && <p className="admin-error">{error}</p>}

      <LessonSpecEditor onGenerated={onGenerated} />

      <section className="admin-section">
        <div className="admin-row admin-row-spread">
          <h3 className="admin-h3">Lessons</h3>
          <button
            className="learn-secondary-btn admin-btn-sm"
            onClick={() => void refresh()}
          >
            Refresh
          </button>
        </div>
        <LessonStatusDashboard
          lessons={lessons}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </section>

      {selected && (
        <section className="admin-section">
          <div className="admin-row admin-row-spread">
            <h3 className="admin-h3">{selected.title} — steps</h3>
            <button
              className="learn-secondary-btn admin-btn-sm"
              onClick={() => void regenerate(selected.id)}
            >
              Regenerate
            </button>
          </div>
          {selected.steps.map((step) => (
            <StepOverrideEditor
              key={step.id}
              step={step}
              onChanged={() => void refresh()}
            />
          ))}
        </section>
      )}
    </div>
  );
}
