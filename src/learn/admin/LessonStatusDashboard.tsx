import type { GenStatus } from './adminApi';

interface LessonStatusDashboardProps {
  lessons: GenStatus[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function StatusBadge({ status }: { status: GenStatus['generation_status'] }) {
  return (
    <span className={`admin-badge admin-badge-${status}`}>
      {status.replace('generation_', '')}
    </span>
  );
}

// Status board: every lesson and its generation state (pending / generating /
// ready / failed). Selecting one opens its per-step detail.
export function LessonStatusDashboard({
  lessons,
  selectedId,
  onSelect,
}: LessonStatusDashboardProps) {
  if (lessons.length === 0) {
    return <p className="admin-hint">No lessons yet. Generate one above.</p>;
  }
  return (
    <ul className="admin-lesson-list">
      {lessons.map((lesson) => (
        <li key={lesson.id}>
          <button
            className={
              'admin-lesson-row' +
              (lesson.id === selectedId ? ' admin-lesson-row-active' : '')
            }
            onClick={() => onSelect(lesson.id)}
          >
            <span className="admin-lesson-title">{lesson.title}</span>
            <span className="admin-lesson-slug">{lesson.slug}</span>
            <StatusBadge status={lesson.generation_status} />
          </button>
          {lesson.generation_error && lesson.id === selectedId && (
            <p className="admin-error">{lesson.generation_error}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
