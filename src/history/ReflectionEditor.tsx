import { useState } from 'react';

const MAX = 500;

interface ReflectionEditorProps {
  initial: string | null;
  onSave: (text: string) => Promise<void>;
}

/**
 * v4.5 — a private, optional reflection on a past session (≤500 chars).
 * Reflections are never shared and never displayed publicly.
 */
export default function ReflectionEditor({
  initial,
  onSave,
}: ReflectionEditorProps) {
  const [text, setText] = useState(initial ?? '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(text.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="mt-2">
        {initial ? (
          <p className="text-stone-300 text-sm font-body whitespace-pre-wrap leading-snug">
            {initial}
          </p>
        ) : (
          <p className="text-stone-600 text-sm font-body italic">
            No reflection.
          </p>
        )}
        <button
          onClick={() => {
            setText(initial ?? '');
            setEditing(true);
          }}
          className="mt-1 font-mono text-[10px] uppercase tracking-wider text-amber-500/80 hover:text-amber-400"
        >
          {initial ? 'Edit reflection' : 'Add a reflection'}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <textarea
        value={text}
        maxLength={MAX}
        rows={3}
        autoFocus
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        placeholder="A few words for yourself, if you like."
        className="w-full rounded-lg border border-stone-800 bg-stone-950/60 px-3 py-2 text-sm text-stone-200 font-body placeholder:text-stone-600 focus:border-amber-500/50 focus:outline-none resize-none"
      />
      <div className="mt-1 flex items-center justify-between">
        <span className="font-mono text-[9px] text-stone-600">
          {text.length}/{MAX}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditing(false)}
            disabled={saving}
            className="font-mono text-[10px] uppercase tracking-wider text-stone-500 hover:text-stone-400"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="font-mono text-[10px] uppercase tracking-wider text-amber-400 hover:text-amber-300 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
