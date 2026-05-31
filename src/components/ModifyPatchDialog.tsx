import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Wand2, X, Sliders } from 'lucide-react';
import { api, getErrorMessage } from '@/api/client';
import { decodeState, encodeState } from '@/share/encode';
import { applyDecodedToStore } from '@/share/hydrate';
import { useParamStore } from '@/state/params';
import { Input } from '@/design/components/Input';

interface ModifyPatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
}

const SUGGESTIONS = [
  'Darker',
  'Brighter',
  'Sparser',
  'Denser',
  'More Motion',
  'Stiller',
];

export default function ModifyPatchDialog({
  isOpen,
  onClose,
  showToast,
}: ModifyPatchDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [direction, setDirection] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      setDirection('');
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  };

  const runModification = useCallback(
    async (selectedDirection: string) => {
      if (!selectedDirection.trim()) return;
      setLoading(true);
      try {
        const s = useParamStore.getState();
        const payload = encodeState(
          s.params,
          s.engineId,
          s.engineParams[s.engineId] ?? {},
          {
            mode: s.sessionMode,
            arcId: s.arcId,
            durationSec: s.arcDurationSec,
          },
          s.loops,
        );

        const res = await api.modifyPatch(payload, selectedDirection.trim());

        // Apply the modified state immediately
        const decoded = decodeState(7, res.state);
        applyDecodedToStore(decoded);

        // Construct a friendly change summary toast
        if (res.changes.length > 0) {
          const changeSummary = res.changes
            .map((c) => {
              const dirStr =
                c.direction === 'increased'
                  ? 'increased'
                  : c.direction === 'decreased'
                    ? 'decreased'
                    : 'modified';
              return `${dirStr} ${c.label}`;
            })
            .slice(0, 3)
            .join(', ');
          const extraCount = res.changes.length - 3;
          const extraStr =
            extraCount > 0 ? ` and ${extraCount} other params` : '';
          showToast(`AI Modified: ${changeSummary}${extraStr}`);
        } else {
          showToast('AI Modified patch with no visible changes');
        }

        handleClose();
      } catch (err) {
        showToast(getErrorMessage(err, 'Failed to modify patch'));
      } finally {
        setLoading(false);
      }
    },
    [showToast, handleClose],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runModification(direction);
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === dialogRef.current && !loading) {
          handleClose();
        }
      }}
      className="p-0 bg-transparent border-0 outline-none backdrop:bg-[rgba(12,10,9,0.75)] backdrop:backdrop-blur-md"
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 relative overflow-hidden font-mono"
        style={{
          background: 'rgba(12, 10, 9, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow:
            '0 25px 50px -12px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Decorative subtle ambient glows */}
        <div
          className="absolute -top-24 -left-24 w-48 h-48 rounded-full pointer-events-none filter blur-[60px]"
          style={{ background: 'rgba(139, 92, 246, 0.05)' }}
        />
        <div
          className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full pointer-events-none filter blur-[60px]"
          style={{ background: 'rgba(245, 158, 11, 0.04)' }}
        />

        <div className="flex items-center justify-between mb-5 relative z-10">
          <div className="flex items-center gap-2">
            <Wand2 size={14} className="text-violet-400 animate-pulse" />
            <h2
              className="text-[11px] uppercase tracking-[0.22em]"
              style={{ color: '#fef3c7' }}
            >
              AI Mood Modifier
            </h2>
          </div>
          {!loading && (
            <button
              type="button"
              onClick={handleClose}
              className="p-1 rounded-full text-stone-500 hover:text-stone-300 transition-colors"
              aria-label="Close dialog"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-8 text-center flex flex-col items-center justify-center relative z-10">
            <div className="relative mb-4 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border border-violet-500/20 border-t-violet-400 animate-spin" />
              <Sliders
                size={18}
                className="absolute text-violet-400 animate-pulse"
              />
            </div>
            <p className="text-xs uppercase tracking-[0.15em] text-violet-200/80 mb-1">
              Modifying Patch...
            </p>
            <p className="text-[11px] text-stone-400 max-w-xs leading-relaxed font-body">
              Adapting filter envelopes, adjusting wave ratios, and sculpting
              synth layers.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            <Input
              id="ai-direction-input"
              label="Direction or Mood"
              multiline
              rows={2}
              required
              placeholder="Make it darker, add organic shifts, sparser..."
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            />

            <div className="space-y-2">
              <span className="block text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono">
                Suggested Shifts
              </span>
              <div className="grid grid-cols-3 gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => runModification(s)}
                    className="text-center text-[10px] text-stone-400 hover:text-stone-200 hover:border-violet-500/30 rounded-lg py-2 px-1 transition-all"
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.2em]"
                style={{ border: '1px solid #44403c', color: '#a8a29e' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!direction.trim()}
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.2em] transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  background: 'rgba(139, 92, 246, 0.12)',
                  border: '1px solid #7c3aed',
                  color: '#ddd6fe',
                }}
              >
                <Wand2 size={11} />
                Modify
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
