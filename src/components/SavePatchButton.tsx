import { useCallback, useState } from 'react';
import { Save } from 'lucide-react';
import type { PatchPersistence, SaveOptions } from '@/api/usePatches';
import type { Visibility } from '@/api/types';
import { useParamStore } from '@/state/params';
import { encodeState } from '@/share/encode';
import { api, getErrorMessage } from '@/api/client';
import { useJam } from '@/jam/JamProvider';

interface SavePatchButtonProps {
  patches: PatchPersistence;
  /** Whether any loop slot currently holds a captured buffer. */
  hasCaptures: boolean;
  showToast: (msg: string) => void;
}

const field =
  'w-full rounded-md bg-transparent px-3 py-2 font-body text-sm outline-none';
const fieldStyle = { border: '1px solid #44403c', color: '#f5f5f4' };

export default function SavePatchButton({
  patches,
  hasCaptures,
  showToast,
}: SavePatchButtonProps) {
  const jam = useJam();
  const isJamActive = !!(jam && jam.session);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('unlisted');
  const [includeCaptures, setIncludeCaptures] = useState(false);
  const [saveAsShared, setSaveAsShared] = useState(false);

  const handleOpen = () => {
    setSaveAsShared(isJamActive);
    setOpen(true);
  };

  const submit = useCallback(async () => {
    if (isJamActive && saveAsShared && jam) {
      try {
        const result = await jam.saveJamPatch({
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          visibility,
        });
        if (result) {
          const patchUrl = `${window.location.origin}/p/${result.short_slug}`;
          try {
            await navigator.clipboard?.writeText(patchUrl);
            showToast('Saved shared collab — link copied');
          } catch {
            window.prompt('Your patch link', patchUrl);
          }
          setOpen(false);
        }
      } catch {
        showToast('Failed to save shared patch. Make sure you are signed in.');
      }
      return;
    }

    const opts: SaveOptions = {
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      visibility,
      includeCaptures: includeCaptures && hasCaptures,
    };
    const result = await patches.savePatch(opts);
    if (result) {
      try {
        await navigator.clipboard?.writeText(result.url);
        showToast('Saved — link copied');
      } catch {
        window.prompt('Your patch link', result.url);
      }
      setOpen(false);
    }
  }, [
    title,
    description,
    visibility,
    includeCaptures,
    hasCaptures,
    patches,
    showToast,
    isJamActive,
    saveAsShared,
    jam,
  ]);

  const [suggesting, setSuggesting] = useState(false);

  const suggestDescription = useCallback(async () => {
    setSuggesting(true);
    try {
      const s = useParamStore.getState();
      const payload = encodeState(
        s.params,
        s.engineId,
        s.engineParams[s.engineId] ?? {},
        { mode: s.sessionMode, arcId: s.arcId, durationSec: s.arcDurationSec },
        s.loops,
      );
      const res = await api.describePatch(payload);
      setDescription(res.description);
      showToast('Description suggested!');
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to suggest description'));
    } finally {
      setSuggesting(false);
    }
  }, [showToast]);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Save patch to your library"
        className="group flex items-center gap-2 rounded-full px-4 py-2.5 transition-all"
        style={{
          background: 'rgba(245, 158, 11, 0.04)',
          border: '1px solid #44403c',
          color: '#d6d3d1',
        }}
      >
        <Save size={13} strokeWidth={1.5} style={{ color: '#78716c' }} />
        <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
          Save
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(12, 10, 9, 0.7)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: '#0c0a09', border: '1px solid #44403c' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em]"
              style={{ color: '#fef3c7' }}
            >
              Save patch
            </h2>

            <label className="mb-3 block">
              <span
                className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ color: '#78716c' }}
              >
                Title
              </span>
              <input
                className={field}
                style={fieldStyle}
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled"
              />
            </label>

            <div className="mb-3 block">
              <div className="mb-1 flex items-center justify-between">
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: '#78716c' }}
                >
                  Description
                </span>
                <button
                  type="button"
                  onClick={suggestDescription}
                  disabled={suggesting}
                  className="font-mono text-[9px] uppercase tracking-[0.15em] hover:text-amber-300 disabled:opacity-50"
                  style={{
                    color: '#fbbf24',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {suggesting ? 'Suggesting…' : 'AI Suggest'}
                </button>
              </div>
              <textarea
                className={field}
                style={fieldStyle}
                value={description}
                maxLength={2000}
                rows={2}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="mb-3 flex items-center justify-between">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ color: '#78716c' }}
              >
                Visibility
              </span>
              <div className="flex gap-2">
                {(['unlisted', 'public'] as Visibility[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
                    style={{
                      border: '1px solid #44403c',
                      background:
                        visibility === v
                          ? 'rgba(245,158,11,0.12)'
                          : 'transparent',
                      color: visibility === v ? '#fef3c7' : '#a8a29e',
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {isJamActive && (
              <label className="mb-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={saveAsShared}
                  onChange={(e) => setSaveAsShared(e.target.checked)}
                />
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: '#fbbf24' }}
                >
                  Save as shared collab
                </span>
              </label>
            )}

            <label
              className="mb-5 flex items-center gap-2"
              style={{ opacity: hasCaptures && !saveAsShared ? 1 : 0.4 }}
            >
              <input
                type="checkbox"
                disabled={!hasCaptures || saveAsShared}
                checked={includeCaptures && hasCaptures && !saveAsShared}
                onChange={(e) => setIncludeCaptures(e.target.checked)}
              />
              <span
                className="font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ color: '#a8a29e' }}
              >
                Include captured audio
              </span>
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em]"
                style={{ border: '1px solid #44403c', color: '#a8a29e' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={patches.saving}
                className="rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em]"
                style={{
                  border: '1px solid #44403c',
                  background: 'rgba(245,158,11,0.12)',
                  color: '#fef3c7',
                  opacity: patches.saving ? 0.6 : 1,
                }}
              >
                {patches.saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
