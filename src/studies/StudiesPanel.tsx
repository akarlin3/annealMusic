import { useEffect, useState } from 'react';
import { FlaskConical, Plus, RefreshCw } from 'lucide-react';
import { studiesApi, ApiError } from './api';
import { StudyView } from './StudyView';
import type { Study } from './types';

export function StudiesPanel() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);
  const [needAuth, setNeedAuth] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const load = () => {
    setLoading(true);
    studiesApi
      .list()
      .then((items) => {
        setStudies(items);
        setNeedAuth(false);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) setNeedAuth(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const create = async () => {
    if (!newTitle.trim()) return;
    const s = await studiesApi.create({ title: newTitle.trim() });
    setNewTitle('');
    setCreating(false);
    load();
    setSelected(s.id);
  };

  if (selected) {
    return (
      <StudyView
        studyId={selected}
        onBack={() => {
          setSelected(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-hidden">
      <div className="flex items-center justify-between select-none">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-mono uppercase tracking-wider font-semibold text-stone-200 flex items-center gap-2">
            <FlaskConical size={18} className="text-amber-500" />
            Studies
          </h2>
          <p className="text-xs text-stone-500 font-mono">
            Versioned, citable bundles of investigators, stimuli, protocols, and
            data — with provenance.
          </p>
        </div>
        {!needAuth && (
          <button
            onClick={() => setCreating((c) => !c)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-stone-950 text-xs font-mono font-semibold hover:bg-amber-400"
          >
            <Plus size={14} /> New study
          </button>
        )}
      </div>

      {creating && (
        <div className="flex gap-2 border border-stone-900 bg-stone-900/10 rounded-xl p-4">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="Study title"
            className="flex-1 bg-stone-900 border border-stone-800 rounded px-3 py-2 text-xs font-mono text-stone-200 placeholder:text-stone-600"
          />
          <button
            onClick={create}
            disabled={!newTitle.trim()}
            className="px-4 py-2 rounded bg-amber-500 text-stone-950 text-xs font-mono font-semibold hover:bg-amber-400 disabled:opacity-40"
          >
            Create
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-stone-500">
          <RefreshCw size={20} className="animate-spin text-amber-500" />
        </div>
      ) : needAuth ? (
        <div className="flex-1 flex flex-col items-center justify-center border border-stone-900 bg-stone-900/10 rounded-xl p-8 text-center select-none">
          <FlaskConical size={28} className="text-amber-500/40 mb-4" />
          <h3 className="text-sm font-mono uppercase tracking-wider text-stone-200">
            Sign in to manage studies
          </h3>
          <p className="text-xs text-stone-500 font-mono mt-1 max-w-sm leading-relaxed">
            Studies organize multi-investigator research and require an
            AnnealMusic account. Public studies remain browsable and citable by
            anyone.
          </p>
        </div>
      ) : studies.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border border-stone-900 bg-stone-900/10 rounded-xl p-8 text-center select-none">
          <FlaskConical size={28} className="text-amber-500/40 mb-4" />
          <h3 className="text-sm font-mono uppercase tracking-wider text-stone-200">
            No studies yet
          </h3>
          <p className="text-xs text-stone-500 font-mono mt-1">
            Create your first study to start organizing a reproducible bundle.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 pb-6 pr-2 scrollbar-thin">
          {studies.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s.id)}
              className="text-left border border-stone-900 bg-stone-900/10 rounded-xl p-5 hover:border-amber-500/20 transition-all flex flex-col gap-3"
            >
              <div className="flex justify-between items-start gap-2">
                <h3 className="text-sm font-mono font-semibold text-stone-200">
                  {s.title}
                </h3>
                <span className="text-[9px] font-mono bg-stone-900 border border-stone-800 px-2 py-0.5 rounded text-amber-400/80 uppercase">
                  {s.status}
                </span>
              </div>
              <p className="text-[11px] text-stone-400 font-mono line-clamp-2">
                {s.abstract || s.description || 'No abstract.'}
              </p>
              <div className="flex justify-between text-[10px] font-mono text-stone-600 pt-2 border-t border-stone-900">
                <span>{s.investigators.length} investigator(s)</span>
                <span>{s.my_role}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
