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
import { ClipManager } from './ClipManager';
import { SpecGenerator } from './SpecGenerator';
import { BatchGenerationDashboard } from './BatchGenerationDashboard';
import { ReviewDashboard } from './ReviewDashboard';
import { PrerequisiteGraphEditor } from './PrerequisiteGraphEditor';
import { QualityChecks } from './QualityChecks';
import { AnalyticsPage } from './AnalyticsPage';

interface AdminPanelProps {
  onClose: () => void;
}

type Tab =
  | 'authoring'
  | 'scaffold'
  | 'batch'
  | 'review'
  | 'graph'
  | 'qa'
  | 'clips'
  | 'analytics';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'authoring', label: 'Authoring' },
  { id: 'scaffold', label: 'Spec generator' },
  { id: 'batch', label: 'Batch' },
  { id: 'review', label: 'Review' },
  { id: 'graph', label: 'Prerequisites' },
  { id: 'qa', label: 'Quality' },
  { id: 'clips', label: 'Clips' },
  { id: 'analytics', label: 'Analytics' },
];

// Admin curriculum console (v6.1 generation + v6.4 authoring tooling): key gate →
// tabbed dashboards. Reached at #admin.
export function AdminPanel({ onClose }: AdminPanelProps) {
  const [hasKey, setHasKey] = useState<boolean>(() => getAdminKey() !== null);
  const [keyInput, setKeyInput] = useState('');
  const [lessons, setLessons] = useState<GenStatus[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('authoring');
  const [scaffoldSpec, setScaffoldSpec] = useState<string | null>(null);

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
        <h2 className="admin-h2">Curriculum console — admin</h2>
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

  const stepEditor = selected && (
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
  );

  return (
    <div className="admin-panel">
      <header className="admin-header">
        <h2 className="admin-h2">Curriculum console — admin</h2>
        <button className="learn-secondary-btn" onClick={onClose}>
          Back to /learn
        </button>
      </header>

      <nav className="admin-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`admin-tab ${tab === t.id ? 'admin-tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {error && <p className="admin-error">{error}</p>}

      {tab === 'authoring' && (
        <>
          <LessonSpecEditor
            onGenerated={onGenerated}
            initialSpec={scaffoldSpec}
          />
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
          {stepEditor}
        </>
      )}

      {tab === 'scaffold' && (
        <SpecGenerator
          onScaffold={(json) => {
            setScaffoldSpec(json);
            setTab('authoring');
          }}
        />
      )}

      {tab === 'batch' && (
        <BatchGenerationDashboard
          lessons={lessons}
          onDone={() => void refresh()}
        />
      )}

      {tab === 'review' && (
        <>
          <ReviewDashboard
            lessons={lessons}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChanged={() => void refresh()}
          />
          {stepEditor}
        </>
      )}

      {tab === 'graph' && <PrerequisiteGraphEditor />}

      {tab === 'qa' && <QualityChecks />}

      {tab === 'clips' && <ClipManager />}

      {tab === 'analytics' && <AnalyticsPage />}
    </div>
  );
}
