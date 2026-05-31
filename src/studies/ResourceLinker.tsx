import { useEffect, useState } from 'react';
import { Link2, Trash2, Plus } from 'lucide-react';
import { studiesApi, ApiError } from './api';
import type {
  ResourceKind,
  ResourceRole,
  Study,
  StudyResourceLink,
} from './types';
import { ROLE_RANK } from './types';

// Resource kinds that expose a `/me` listing for the current user, used to
// populate the picker. The server enforces the broader "owned by any
// investigator" rule (docs/v7.0-PLAN.md §11).
const PICKABLE: { kind: ResourceKind; endpoint: string; label: string }[] = [
  { kind: 'patch', endpoint: '/api/v1/patches/me', label: 'Patch' },
  { kind: 'piece', endpoint: '/api/v1/pieces/me', label: 'Piece' },
  {
    kind: 'experiment',
    endpoint: '/api/v1/experiments/me',
    label: 'Experiment',
  },
  { kind: 'user_script', endpoint: '/api/v1/scripts/me', label: 'Script' },
  {
    kind: 'listening_session',
    endpoint: '/api/v1/listening-sessions/me',
    label: 'Listening session',
  },
];

const ROLES: ResourceRole[] = ['stimulus', 'protocol', 'data', 'analysis'];

interface PickItem {
  id: string;
  label: string;
}

export function ResourceLinker({
  study,
  links,
  onChange,
}: {
  study: Study;
  links: StudyResourceLink[];
  onChange: () => void;
}) {
  const role = study.my_role;
  const canWrite = role !== null && ROLE_RANK[role] >= ROLE_RANK['analyst'];
  const isAnalyst = role === 'analyst';

  const [kind, setKind] = useState<ResourceKind>('patch');
  const [resourceRole, setResourceRole] = useState<ResourceRole>(
    isAnalyst ? 'analysis' : 'stimulus',
  );
  const [items, setItems] = useState<PickItem[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ep = PICKABLE.find((p) => p.kind === kind)?.endpoint;
    if (!ep) {
      setItems([]);
      return;
    }
    fetch(ep, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        const raw: { id: string; title?: string; name?: string }[] =
          Array.isArray(d) ? d : d.items || [];
        setItems(
          raw.map((x) => ({
            id: x.id,
            label: x.title || x.name || x.id.substring(0, 8),
          })),
        );
      })
      .catch(() => setItems([]));
  }, [kind]);

  const link = async () => {
    if (!selected) return;
    setError(null);
    try {
      await studiesApi.linkResource(study.id, {
        resource_kind: kind,
        resource_id: selected,
        role: resourceRole,
      });
      setSelected('');
      onChange();
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'error');
    }
  };

  const unlink = async (linkId: string) => {
    setError(null);
    try {
      await studiesApi.unlinkResource(study.id, linkId);
      onChange();
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'error');
    }
  };

  const canUnlink =
    role !== null && ROLE_RANK[role] >= ROLE_RANK['co-investigator'];
  const grouped = links.reduce<Record<string, StudyResourceLink[]>>(
    (acc, l) => {
      (acc[l.resource_kind] ||= []).push(l);
      return acc;
    },
    {},
  );

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-mono uppercase tracking-wider text-stone-400 flex items-center gap-2">
        <Link2 size={14} className="text-amber-500" />
        Linked resources ({links.length})
      </span>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-[11px] font-mono text-stone-600">
          No resources linked yet.
        </p>
      ) : (
        Object.entries(grouped).map(([k, list]) => (
          <div key={k} className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-stone-600">
              {k}
            </span>
            {list.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-2 rounded border border-stone-900 bg-stone-900/20 px-2.5 py-1.5"
              >
                <span className="text-[11px] font-mono text-stone-300">
                  {l.resource_id.substring(0, 8)}
                  {l.role && (
                    <span className="ml-2 text-amber-400/70">[{l.role}]</span>
                  )}
                </span>
                {canUnlink && (
                  <button
                    onClick={() => unlink(l.id)}
                    className="p-1 rounded text-stone-500 hover:text-rose-400"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ))
      )}

      {canWrite && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex flex-wrap gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ResourceKind)}
              className="bg-stone-900 border border-stone-800 rounded text-[10px] font-mono text-stone-300 px-1.5 py-1"
            >
              {PICKABLE.map((p) => (
                <option key={p.kind} value={p.kind}>
                  {p.label}
                </option>
              ))}
            </select>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="flex-1 min-w-[8rem] bg-stone-900 border border-stone-800 rounded text-[10px] font-mono text-stone-300 px-1.5 py-1"
            >
              <option value="">— select —</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.label}
                </option>
              ))}
            </select>
            <select
              value={resourceRole}
              onChange={(e) => setResourceRole(e.target.value as ResourceRole)}
              className="bg-stone-900 border border-stone-800 rounded text-[10px] font-mono text-stone-300 px-1.5 py-1"
            >
              {(isAnalyst ? (['analysis'] as ResourceRole[]) : ROLES).map(
                (r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ),
              )}
            </select>
            <button
              onClick={link}
              disabled={!selected}
              className="flex items-center gap-1 px-3 py-1 rounded bg-amber-500 text-stone-950 text-[10px] font-mono font-semibold hover:bg-amber-400 disabled:opacity-40"
            >
              <Plus size={12} /> Link
            </button>
          </div>
          {error && (
            <span className="text-[10px] font-mono text-rose-400">
              {error === 'already_linked'
                ? 'Already linked.'
                : error === 'forbidden'
                  ? 'Not permitted (analysts link analysis resources only).'
                  : `Error: ${error}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
