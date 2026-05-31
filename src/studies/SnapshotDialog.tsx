import { useState } from 'react';
import { Camera, X } from 'lucide-react';
import { studiesApi, ApiError } from './api';
import type { Study } from './types';

export function SnapshotDialog({
  study,
  onClose,
  onCreated,
}: {
  study: Study;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!label.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await studiesApi.snapshot(study.id, label.trim());
      onCreated();
      onClose();
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'duplicate_version_label'
          ? 'That version label already exists.'
          : 'Snapshot failed.',
      );
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-stone-800 bg-stone-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-mono uppercase tracking-wider text-stone-200 flex items-center gap-2">
            <Camera size={16} className="text-amber-500" />
            Snapshot study
          </h3>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-300"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-[11px] font-mono text-stone-500 leading-relaxed mb-4">
          Freezes the current study, investigators, and{' '}
          {study.investigators.length > 0 ? 'linked resources' : 'resources'}{' '}
          into an immutable version. Snapshots cannot be edited or deleted.
        </p>
        <label className="text-[10px] font-mono uppercase tracking-widest text-stone-500">
          Version label
        </label>
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. preregistered, v1.0"
          className="mt-1 w-full bg-stone-900 border border-stone-800 rounded px-2 py-2 text-xs font-mono text-stone-200 placeholder:text-stone-600"
        />
        {error && (
          <p className="mt-2 text-[10px] font-mono text-rose-400">{error}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-[11px] font-mono text-stone-400 hover:text-stone-200"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={busy || !label.trim()}
            className="px-4 py-1.5 rounded bg-amber-500 text-stone-950 text-[11px] font-mono font-semibold hover:bg-amber-400 disabled:opacity-40"
          >
            Create snapshot
          </button>
        </div>
      </div>
    </div>
  );
}
