import { useCallback, useEffect, useState } from 'react';
import {
  getClipAnalytics,
  getLessonAnalytics,
  getLessonAnalyticsDetail,
  getTrackAnalytics,
  refreshAnalytics,
  type ClipStatsRow,
  type LessonAnalyticsDetail,
  type LessonAnalyticsRow,
  type TrackAnalyticsRow,
} from './adminApi';

// v6.5 — admin-only lesson analytics. Aggregate-only by construction: the server
// never returns per-user data (see docs/PRIVACY.md), so nothing here can show an
// individual's progress. This is a curriculum-iteration tool, not a user-facing
// surface — it lives behind the admin key gate and is never linked from /learn.

type View = 'lessons' | 'tracks' | 'clips';

function pct(x: number): string {
  return `${Math.round(x * 1000) / 10}%`;
}

function ms(x: number): string {
  if (!x) return '—';
  const secs = Math.round(x / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function downloadCsv<T extends object>(filename: string, rows: T[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => escape((r as Record<string, unknown>)[h])).join(','),
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AnalyticsPage() {
  const [view, setView] = useState<View>('lessons');
  const [lessons, setLessons] = useState<LessonAnalyticsRow[]>([]);
  const [tracks, setTracks] = useState<TrackAnalyticsRow[]>([]);
  const [clips, setClips] = useState<ClipStatsRow[]>([]);
  const [detail, setDetail] = useState<LessonAnalyticsDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [l, t, c] = await Promise.all([
        getLessonAnalytics(),
        getTrackAnalytics(),
        getClipAnalytics(),
      ]);
      setLessons(l.items);
      setTracks(t.items);
      setClips(c.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openLesson(id: string) {
    setSelectedId(id);
    setDetail(null);
    try {
      setDetail(await getLessonAnalyticsDetail(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load detail');
    }
  }

  async function doRefresh() {
    try {
      const r = await refreshAnalytics();
      setRefreshedAt(r.refreshed_at);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    }
  }

  const selected = lessons.find((l) => l.lesson_id === selectedId) ?? null;

  return (
    <section className="admin-section analytics-page">
      <div className="admin-row admin-row-spread">
        <h3 className="admin-h3">Lesson analytics</h3>
        <div className="admin-row">
          <button
            className="learn-secondary-btn admin-btn-sm"
            disabled={busy}
            onClick={() => void load()}
          >
            {busy ? 'Loading…' : 'Reload'}
          </button>
          <button
            className="learn-secondary-btn admin-btn-sm"
            onClick={() => void doRefresh()}
            title="Refresh the nightly materialized rollup (Postgres only)"
          >
            Refresh rollup
          </button>
        </div>
      </div>

      <p className="admin-hint">
        Aggregate, anonymized — no individual learner's progress is shown.
        {refreshedAt && ` Rollup refreshed ${refreshedAt}.`}
      </p>

      {error && <p className="admin-error">{error}</p>}

      <nav className="admin-tabs" role="tablist">
        {(['lessons', 'tracks', 'clips'] as View[]).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            className={`admin-tab ${view === v ? 'admin-tab-active' : ''}`}
            onClick={() => setView(v)}
          >
            {v[0]!.toUpperCase() + v.slice(1)}
          </button>
        ))}
      </nav>

      {view === 'lessons' && (
        <>
          <div className="admin-row admin-row-spread">
            <span className="admin-hint">
              {lessons.length} lesson{lessons.length === 1 ? '' : 's'} with
              activity
            </span>
            <button
              className="learn-secondary-btn admin-btn-sm"
              disabled={lessons.length === 0}
              onClick={() => downloadCsv('lesson-analytics.csv', lessons)}
            >
              Export CSV
            </button>
          </div>
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Lesson</th>
                <th>Views</th>
                <th>Completed</th>
                <th>Rate</th>
                <th>Avg time</th>
                <th>Abandoned</th>
                <th>Reflections</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((l) => (
                <tr
                  key={l.lesson_id}
                  className={selectedId === l.lesson_id ? 'row-selected' : ''}
                  onClick={() => void openLesson(l.lesson_id)}
                >
                  <td>{l.title ?? l.slug ?? l.lesson_id}</td>
                  <td>{l.views}</td>
                  <td>{l.completions}</td>
                  <td>{pct(l.completion_rate)}</td>
                  <td>{ms(l.avg_completion_ms)}</td>
                  <td>{l.abandonments}</td>
                  <td>{pct(l.reflection_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {selected && detail && (
            <div className="analytics-detail">
              <h4 className="admin-h3">
                {selected.title ?? selected.slug} — drop-off
              </h4>
              <div className="dropoff-chart" role="img" aria-label="drop-off">
                {detail.dropoff.map((frac, i) => (
                  <div
                    className="dropoff-bar-wrap"
                    key={i}
                    title={`step ${i}: ${pct(frac)}`}
                  >
                    <div
                      className="dropoff-bar"
                      style={{ height: `${Math.max(2, frac * 100)}%` }}
                    />
                    <span className="dropoff-label">{i}</span>
                  </div>
                ))}
              </div>
              <p className="admin-hint">
                Prompt steps: {detail.prompt_stats.tried} tried ·{' '}
                {detail.prompt_stats.skipped} skipped (
                {pct(detail.prompt_stats.tried_ratio)} tried)
              </p>
              {detail.clip_stats.length > 0 && (
                <ul className="admin-findings">
                  {detail.clip_stats.map((c) => (
                    <li key={c.clip_slug} className="admin-finding">
                      <span className="admin-finding-rule">{c.clip_slug}</span>{' '}
                      {c.plays} plays · {c.replays} replays · {c.skips} skips (
                      {pct(c.skip_rate)} skip)
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {view === 'tracks' && (
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Track</th>
              <th>Lessons</th>
              <th>Starts</th>
              <th>Completed</th>
              <th>Rate</th>
              <th>Off-graph paths</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((t) => (
              <tr key={t.track_id}>
                <td>{t.title}</td>
                <td>{t.lessons}</td>
                <td>{t.starts}</td>
                <td>{t.completions}</td>
                <td>{pct(t.completion_rate)}</td>
                <td>{t.off_graph_paths.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {view === 'clips' && (
        <>
          <div className="admin-row admin-row-spread">
            <span className="admin-hint">
              {clips.length} clip{clips.length === 1 ? '' : 's'} referenced
            </span>
            <button
              className="learn-secondary-btn admin-btn-sm"
              disabled={clips.length === 0}
              onClick={() => downloadCsv('clip-analytics.csv', clips)}
            >
              Export CSV
            </button>
          </div>
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Clip</th>
                <th>Exposures</th>
                <th>Plays</th>
                <th>Replays</th>
                <th>Skips</th>
                <th>Skip rate</th>
              </tr>
            </thead>
            <tbody>
              {clips.map((c) => (
                <tr key={c.clip_slug}>
                  <td>{c.clip_slug}</td>
                  <td>{c.exposures}</td>
                  <td>{c.plays}</td>
                  <td>{c.replays}</td>
                  <td>{c.skips}</td>
                  <td>{pct(c.skip_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
