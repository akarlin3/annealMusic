import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getPrereqs,
  putPrereqs,
  type PrereqEdge,
  type PrereqGraph,
} from './adminApi';

// v6.4 — visual prerequisite editor. Pick a prerequisite + a lesson, add the
// edge; the server validates the DAG and rejects cycles, so the editor can never
// persist a cycle. Edges are grouped under their lessons for a calm read.
export function PrerequisiteGraphEditor() {
  const [graph, setGraph] = useState<PrereqGraph | null>(null);
  const [pre, setPre] = useState('');
  const [lesson, setLesson] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setGraph(await getPrereqs());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graph');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nodesByTrack = useMemo(() => {
    const out: Record<string, PrereqGraph['nodes']> = {};
    for (const n of graph?.nodes ?? []) (out[n.track] ??= []).push(n);
    return out;
  }, [graph]);

  async function commit(edges: PrereqEdge[]) {
    setBusy(true);
    setError(null);
    try {
      setGraph(await putPrereqs(edges));
    } catch (err) {
      // A cycle / unknown id comes back as a 400 — surface it, keep the graph.
      setError(err instanceof Error ? err.message : 'Edge rejected');
    } finally {
      setBusy(false);
    }
  }

  function addEdge() {
    if (!pre || !lesson || pre === lesson || !graph) return;
    const exists = graph.edges.some(
      (e) => e.prerequisite === pre && e.lesson === lesson,
    );
    if (exists) return;
    void commit([...graph.edges, { prerequisite: pre, lesson }]);
  }

  function removeEdge(edge: PrereqEdge) {
    if (!graph) return;
    void commit(
      graph.edges.filter(
        (e) =>
          !(e.prerequisite === edge.prerequisite && e.lesson === edge.lesson),
      ),
    );
  }

  const edgesByLesson = useMemo(() => {
    const out: Record<string, PrereqEdge[]> = {};
    for (const e of graph?.edges ?? []) (out[e.lesson] ??= []).push(e);
    return out;
  }, [graph]);

  const titleFor = useCallback(
    (id: string) => graph?.nodes.find((n) => n.id === id)?.title ?? id,
    [graph],
  );

  return (
    <section className="admin-section">
      <h3 className="admin-h3">Prerequisite graph</h3>
      <p className="admin-hint">
        Cycles are rejected by the server — the graph stays a DAG.
      </p>
      <div className="admin-row">
        <div className="admin-field admin-field-grow">
          <label className="admin-label">Prerequisite</label>
          <select
            className="admin-input"
            value={pre}
            onChange={(e) => setPre(e.target.value)}
          >
            <option value="">—</option>
            {Object.entries(nodesByTrack).map(([track, ns]) => (
              <optgroup key={track} label={track}>
                {ns.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="admin-field admin-field-grow">
          <label className="admin-label">Lesson (depends on it)</label>
          <select
            className="admin-input"
            value={lesson}
            onChange={(e) => setLesson(e.target.value)}
          >
            <option value="">—</option>
            {Object.entries(nodesByTrack).map(([track, ns]) => (
              <optgroup key={track} label={track}>
                {ns.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <button
          className="learn-primary-btn admin-btn-sm"
          disabled={busy || !pre || !lesson || pre === lesson}
          onClick={addEdge}
        >
          Add edge
        </button>
      </div>
      {error && <p className="admin-error">{error}</p>}

      <div className="admin-graph-list">
        {(graph?.nodes ?? []).map((n) => {
          const deps = edgesByLesson[n.id] ?? [];
          if (deps.length === 0) return null;
          return (
            <div key={n.id} className="admin-graph-node">
              <div className="admin-graph-title">
                {n.title} <span className="admin-hint">({n.difficulty})</span>
              </div>
              <ul className="admin-graph-edges">
                {deps.map((e) => (
                  <li key={e.prerequisite}>
                    ← {titleFor(e.prerequisite)}
                    <button
                      className="admin-edge-remove"
                      title="Remove"
                      onClick={() => removeEdge(e)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {(graph?.edges.length ?? 0) === 0 && (
          <p className="admin-hint">
            No prerequisites yet — every lesson is a root.
          </p>
        )}
      </div>
    </section>
  );
}
