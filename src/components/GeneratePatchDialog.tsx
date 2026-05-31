import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Sparkles, X, Activity } from 'lucide-react';
import { api, getErrorMessage } from '@/api/client';
import { decodeState } from '@/share/encode';
import { applyDecodedToStore } from '@/share/hydrate';
import type { AIQuota } from '@/api/types';
import { Input } from '@/design/components/Input';

interface GeneratePatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
}

const SUGGESTIONS = [
  'A slow dawn over a frozen lake, glass bells in the distance',
  'Anxious granular wind, fast shifting sand and dust',
  'Warm glowing embers, slow pulsing analog synth',
  'Deep ocean trench, distant massive echoes and currents',
];

export default function GeneratePatchDialog({
  isOpen,
  onClose,
  showToast,
}: GeneratePatchDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState<AIQuota | null>(null);

  const fetchQuota = useCallback(async () => {
    try {
      const q = await api.aiQuota();
      setQuota(q);
    } catch {
      // Ignored: silently fail quota fetch
    }
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      setPrompt('');
      fetchQuota();
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen, fetchQuota]);

  const handleClose = () => {
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    try {
      const res = await api.generatePatch(prompt.trim());

      // Load the generated patch state immediately
      const decoded = decodeState(7, res.state);
      applyDecodedToStore(decoded);

      showToast('AI Patch generated and loaded!');
      fetchQuota(); // Refresh quota after use
      handleClose();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to generate patch'));
    } finally {
      setLoading(false);
    }
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
        className="w-full max-w-md rounded-2xl p-6 relative overflow-hidden"
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
          style={{ background: 'rgba(245, 158, 11, 0.06)' }}
        />
        <div
          className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full pointer-events-none filter blur-[60px]"
          style={{ background: 'rgba(139, 92, 246, 0.04)' }}
        />

        <div className="flex items-center justify-between mb-5 relative z-10">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-amber-500 animate-pulse" />
            <h2
              className="text-[11px] uppercase tracking-[0.22em] font-mono"
              style={{ color: '#fef3c7' }}
            >
              Generate AI Patch
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
              <div className="w-12 h-12 rounded-full border border-amber-500/20 border-t-amber-500 animate-spin" />
              <Activity
                size={18}
                className="absolute text-amber-500 animate-pulse"
              />
            </div>
            <p className="text-xs font-mono uppercase tracking-[0.15em] text-amber-200/80 mb-1">
              Generating Patch...
            </p>
            <p className="text-[11px] text-stone-400 max-w-xs leading-relaxed">
              Designing engine parameters, sculpting wave tables, and setting up
              spatial reverb.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            <Input
              id="ai-prompt-input"
              label="Describe the sound you want"
              multiline
              rows={3}
              required
              placeholder="A deep foggy fjord, low humming drone in the background..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />

            <div className="space-y-2">
              <span className="block text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono">
                Suggestions
              </span>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(s)}
                    className="text-left text-[11px] text-stone-400 hover:text-stone-200 rounded-lg p-2 transition-all"
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    "{s}"
                  </button>
                ))}
              </div>
            </div>

            {quota && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-stone-900/40 border border-stone-800/40 text-[10px] font-mono text-stone-400">
                <span>Quota usage</span>
                <span className="text-stone-300">
                  {quota.hour_used}/{quota.hour_limit} hr · {quota.day_used}/
                  {quota.day_limit} day
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em]"
                style={{ border: '1px solid #44403c', color: '#a8a29e' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!prompt.trim()}
                className="flex items-center gap-1.5 rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid #d97706',
                  color: '#fef3c7',
                }}
              >
                <Sparkles size={11} />
                Generate
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
