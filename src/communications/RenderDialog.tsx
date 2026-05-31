import React, { useEffect, useRef, useState } from 'react';
import {
  Video,
  Image,
  Share2,
  X,
  Loader2,
  PlayCircle,
  FileText,
} from 'lucide-react';
import { api, getErrorMessage } from '@/api/client';
import type { RenderedArtifactOut } from '@/api/types';

interface RenderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sourceKind: 'patch' | 'piece' | 'sonification' | 'listening_session';
  sourceId: string;
  showToast: (msg: string) => void;
  onQueueAdded?: (artifact: RenderedArtifactOut) => void;
}

const selectStyle = {
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  color: '#faf9f6',
};

export default function RenderDialog({
  isOpen,
  onClose,
  sourceKind,
  sourceId,
  showToast,
  onQueueAdded,
}: RenderDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [renderKind, setRenderKind] = useState<
    'image' | 'video' | 'outreach-card'
  >('video');
  const [resolution, setResolution] = useState('1920x1080');
  const [durationMs, setDurationMs] = useState(15000);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

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
    setLoading(true);

    try {
      let artifact: RenderedArtifactOut;

      if (renderKind === 'image') {
        artifact = await api.renderImage({
          source_kind: sourceKind,
          source_id: sourceId,
          resolution,
        });
        showToast('Still image rendered successfully!');
      } else if (renderKind === 'video') {
        artifact = await api.queueVideoRender({
          source_kind: sourceKind,
          source_id: sourceId,
          resolution,
          duration_ms: durationMs,
        });
        showToast('Headless video rendering queued in the background!');
        if (onQueueAdded) onQueueAdded(artifact);
      } else {
        artifact = await api.generateOutreachCard({
          source_kind: sourceKind,
          source_id: sourceId,
          resolution: '1280x720', // standard social preview resolution
        });
        showToast(
          'Outreach card looping video abstract successfully generated!',
        );
        if (onQueueAdded) onQueueAdded(artifact);
      }

      handleClose();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to process rendering request'));
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
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Ambient glows */}
        <div
          className="absolute -top-24 -left-24 w-48 h-48 rounded-full pointer-events-none filter blur-[60px]"
          style={{ background: 'rgba(139, 92, 246, 0.05)' }}
        />
        <div
          className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full pointer-events-none filter blur-[60px]"
          style={{ background: 'rgba(245, 158, 11, 0.03)' }}
        />

        <div className="flex items-center justify-between mb-5 relative z-10">
          <div className="flex items-center gap-2">
            <Video size={14} className="text-violet-400" />
            <h2 className="text-[11px] uppercase tracking-[0.22em] font-mono text-stone-200">
              Publishing & Exports
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

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          {/* Output Artifact Type Tabs */}
          <div>
            <label className="mb-2 block text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono">
              Output Format
            </label>
            <div className="grid grid-cols-3 gap-2 bg-stone-900/50 p-1 rounded-xl border border-stone-800/40">
              <button
                type="button"
                onClick={() => setRenderKind('video')}
                className={`py-2 px-3 rounded-lg flex flex-col items-center justify-center gap-1.5 transition-all ${
                  renderKind === 'video'
                    ? 'bg-violet-600 text-white'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Video size={16} />
                <span className="text-[9px] font-medium tracking-wide">
                  Video Abstract
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRenderKind('image')}
                className={`py-2 px-3 rounded-lg flex flex-col items-center justify-center gap-1.5 transition-all ${
                  renderKind === 'image'
                    ? 'bg-violet-600 text-white'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Image size={16} />
                <span className="text-[9px] font-medium tracking-wide">
                  Still Figure
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRenderKind('outreach-card')}
                className={`py-2 px-3 rounded-lg flex flex-col items-center justify-center gap-1.5 transition-all ${
                  renderKind === 'outreach-card'
                    ? 'bg-violet-600 text-white'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Share2 size={16} />
                <span className="text-[9px] font-medium tracking-wide">
                  Outreach Card
                </span>
              </button>
            </div>
          </div>

          {/* Dynamic configuration inputs based on choice */}
          {renderKind !== 'outreach-card' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="render-resolution"
                  className="mb-2 block text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono"
                >
                  Resolution
                </label>
                <select
                  id="render-resolution"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 font-mono text-[11px] outline-none transition-all"
                  style={selectStyle}
                >
                  <option value="1920x1080">1080p (16:9)</option>
                  <option value="3840x2160">4K UHD (16:9)</option>
                  <option value="720x720">Square (1:1)</option>
                </select>
              </div>

              {renderKind === 'video' && (
                <div>
                  <label
                    htmlFor="render-duration"
                    className="mb-2 block text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono"
                  >
                    Duration
                  </label>
                  <select
                    id="render-duration"
                    value={durationMs}
                    onChange={(e) => setDurationMs(Number(e.target.value))}
                    className="w-full rounded-lg px-3 py-2 font-mono text-[11px] outline-none transition-all"
                    style={selectStyle}
                  >
                    <option value={15000}>15 seconds</option>
                    <option value={30000}>30 seconds</option>
                    <option value={60000}>1 minute</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {renderKind === 'outreach-card' && (
            <div className="p-3 rounded-xl bg-stone-900/40 border border-stone-800/40 text-[11px] text-stone-400 space-y-2 leading-relaxed">
              <p>
                <strong>Outreach Cards</strong> package a perfectly looped 15s
                video abstract with:
              </p>
              <ul className="list-disc list-inside pl-1 space-y-1 text-stone-400">
                <li>
                  Server-rendered Open Graph tags (ideal for Slack/Twitter)
                </li>
                <li>Citation sidecar and interactive player link</li>
                <li>Default Creative Commons CC-BY 4.0 license</li>
              </ul>
            </div>
          )}

          {/* Informational help banner */}
          <div className="p-3 rounded-xl bg-violet-950/10 border border-violet-900/20 text-[10px] text-violet-300/80 leading-relaxed font-mono flex gap-2">
            <FileText size={14} className="shrink-0 text-violet-400" />
            <span>
              All rendered assets are automatically appended with BibTeX
              citation sidecars mapping directly to your researcher profile.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleClose}
              className="rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition-all hover:text-stone-200 disabled:opacity-50"
              style={{ border: '1px solid #44403c', color: '#a8a29e' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full px-5 py-2 font-mono text-[10px] uppercase tracking-[0.2em] bg-violet-600 text-white transition-all hover:bg-violet-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={11} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <PlayCircle size={11} />
                  Export
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
