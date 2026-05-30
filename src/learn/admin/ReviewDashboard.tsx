import { useCallback, useEffect, useState } from 'react';
import {
  regenerateLesson,
  runCurriculumQA,
  type CurriculumQA,
  type GenStatus,
  type LessonQA,
} from './adminApi';

interface ReviewProps {
  lessons: GenStatus[];
  onSelect: (id: string) => void;
  selectedId: string | null;
  onChanged: () => void;
}

// v6.4 — review queue: every lesson with its generation status + QA badge, side
// by side with the spec. Approve = leave ready; Regenerate = force fresh. The
// per-step spec↔output side-by-side lives in the existing override editor, which
// AdminPanel renders for the selected lesson.
export function ReviewDashboard({
  lessons,
  onSelect,
  selectedId,
  onChanged,
}: ReviewProps) {
  const [qa, setQa] = useState<Record<string, LessonQA>>({});
  const [busy, setBusy] = useState(false);

  const loadQA = useCallback(async () => {
    setBusy(true);
    try {
      const res: CurriculumQA = await runCurriculumQA();
      const map: Record<string, LessonQA> = {};
      for (const l of res.lessons) map[l.id] = l;
      setQa(map);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadQA();
  }, [loadQA, lessons.length]);

  async function regen(id: string) {
    await regenerateLesson(id);
    onChanged();
    await loadQA();
  }

  return (
    <section className="admin-section">
      <div className="admin-row admin-row-spread">
        <h3 className="admin-h3">Review</h3>
        <button
          className="learn-secondary-btn admin-btn-sm"
          disabled={busy}
          onClick={() => void loadQA()}
        >
          {busy ? 'Checking…' : 'Refresh QA'}
        </button>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Lesson</th>
            <th>Difficulty</th>
            <th>Generation</th>
            <th>QA</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lessons.map((l) => {
            const q = qa[l.id];
            return (
              <tr
                key={l.id}
                className={l.id === selectedId ? 'admin-row-selected' : ''}
                onClick={() => onSelect(l.id)}
              >
                <td>{l.title}</td>
                <td>{l.difficulty}</td>
                <td>
                  <span
                    className={`admin-badge admin-badge-${genClass(l.generation_status)}`}
                  >
                    {l.generation_status}
                  </span>
                </td>
                <td>
                  {q ? (
                    <span
                      className={`admin-badge admin-badge-${q.status}`}
                      title={`${q.errors}e / ${q.warnings}w`}
                    >
                      {q.status}
                    </span>
                  ) : (
                    <span className="admin-hint">—</span>
                  )}
                </td>
                <td>
                  <button
                    className="learn-secondary-btn admin-btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      void regen(l.id);
                    }}
                  >
                    Regenerate
                  </button>
                </td>
              </tr>
            );
          })}
          {lessons.length === 0 && (
            <tr>
              <td colSpan={5} className="admin-hint">
                No lessons yet — author a spec to begin.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function genClass(status: string): string {
  if (status === 'ready') return 'pass';
  if (status === 'generation_failed') return 'fail';
  return 'warn';
}
