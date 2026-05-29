import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  HardDrive,
  AlertTriangle,
  Play,
  Pause,
} from 'lucide-react';
import { api } from '@/api/client';
import type { UserSource, UserMe } from '@/api/types';
import WaveformThumbnail from '@/components/WaveformThumbnail';
import { loadSource } from '@/audio/sources/loader';

let sharedPreviewCtx: AudioContext | null = null;
function getSharedPreviewCtx(): AudioContext {
  if (!sharedPreviewCtx) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sharedPreviewCtx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    )();
  }
  return sharedPreviewCtx;
}

interface UserSourceWaveformProps {
  sourceId: string;
}

function UserSourceWaveform({ sourceId }: UserSourceWaveformProps) {
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const ctx = getSharedPreviewCtx();

    setLoading(true);
    loadSource(ctx, `u:${sourceId}`)
      .then((buf) => {
        if (active) {
          setBuffer(buf);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load user source for thumbnail:', err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sourceId]);

  if (loading) {
    return (
      <div className="flex h-10 w-full items-center justify-center bg-stone-950/20 rounded">
        <Loader2 size={14} className="animate-spin text-stone-600" />
      </div>
    );
  }

  return (
    <div className="rounded overflow-hidden bg-stone-950/30 border border-stone-850/40">
      <WaveformThumbnail buffer={buffer} height={40} points={150} />
    </div>
  );
}

interface MySourcesPanelProps {
  onClose: () => void;
  onRefreshPicker?: () => void;
}

export default function MySourcesPanel({
  onClose,
  onRefreshPicker,
}: MySourcesPanelProps) {
  const [sources, setSources] = useState<UserSource[]>([]);
  const [me, setMe] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Deletion confirmation
  const [confirmDeleteSource, setConfirmDeleteSource] =
    useState<UserSource | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Preview Playback State
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [listRes, meRes] = await Promise.all([
        api.myUserSources(),
        api.me(),
      ]);
      setSources(listRes.items);
      setMe(meRes);
    } catch (err: unknown) {
      console.error('Failed to fetch user sources', err);
      setErrorMsg('Failed to load your sources. Please verify connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Handle preview playback
  const stopPreview = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {
        // ignore
      }
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    setPlayingId(null);
  }, []);

  const playPreview = useCallback(
    async (source: UserSource) => {
      stopPreview();

      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = getSharedPreviewCtx();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        setPlayingId(source.id);
        const buffer = await loadSource(ctx, `u:${source.id}`);

        // Make sure we are still intending to play this source
        if (sourceNodeRef.current) return;

        const node = ctx.createBufferSource();
        node.buffer = buffer;
        node.loop = true;
        node.connect(ctx.destination);
        node.start(0);
        sourceNodeRef.current = node;
      } catch (err) {
        console.error('Playback failed', err);
        setPlayingId(null);
      }
    },
    [stopPreview],
  );

  const togglePreview = useCallback(
    (source: UserSource) => {
      if (playingId === source.id) {
        stopPreview();
      } else {
        void playPreview(source);
      }
    },
    [playingId, playPreview, stopPreview],
  );

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, [stopPreview]);

  // Rename action
  const startRename = (source: UserSource) => {
    setEditingId(source.id);
    setEditName(source.display_name || '');
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveRename = async (id: string) => {
    if (editName.trim() === '') return;
    setUpdatingId(id);
    setErrorMsg(null);
    try {
      const updated = await api.updateUserSource(id, editName.trim());
      setSources((prev) => prev.map((s) => (s.id === id ? updated : s)));
      setEditingId(null);
      if (onRefreshPicker) onRefreshPicker();
    } catch (err: unknown) {
      const apiErr = err as { code?: string };
      console.error('Rename failed', apiErr);
      const code = apiErr.code || 'unknown_error';
      if (code === 'content_rejected') {
        setErrorMsg('Banned word detected in the display name.');
      } else {
        setErrorMsg('Failed to update display name.');
      }
    } finally {
      setUpdatingId(null);
    }
  };

  // Delete actions
  const initiateDelete = (source: UserSource) => {
    stopPreview();
    if (source.ref_count > 0) {
      setConfirmDeleteSource(source);
    } else {
      void performDelete(source.id);
    }
  };

  const performDelete = async (id: string) => {
    setDeletingId(id);
    setErrorMsg(null);
    try {
      await api.deleteUserSource(id);
      setSources((prev) => prev.filter((s) => s.id !== id));
      setConfirmDeleteSource(null);
      // Refresh user info
      const meRes = await api.me();
      setMe(meRes);
      if (onRefreshPicker) onRefreshPicker();
    } catch (err) {
      console.error('Deletion failed', err);
      setErrorMsg('Failed to delete source.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Quota computations
  const maxSources = me?.quota?.user_sources ?? 20;
  const currentSources = me?.user?.source_count ?? sources.length;
  const quotaPercent = Math.min(100, (currentSources / maxSources) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 px-4 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-sources-title"
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-stone-800 bg-stone-900 shadow-2xl transition-all flex flex-col max-h-[85vh]"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-850 p-5 shrink-0">
          <div className="flex items-center gap-2.5">
            <HardDrive size={18} className="text-amber-500" />
            <h2
              id="manage-sources-title"
              className="text-sm font-mono uppercase tracking-[0.16em] text-stone-100"
            >
              Manage Custom Sources
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-stone-800 transition-colors text-stone-400 hover:text-stone-200"
            aria-label="Close manager"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quota Progress */}
        {me && (
          <div className="bg-stone-950/30 border-b border-stone-850/50 px-6 py-4 shrink-0">
            <div className="flex items-baseline justify-between text-[11px] font-mono text-stone-400 mb-1.5">
              <span className="uppercase tracking-wider">
                Account Storage Quota
              </span>
              <span className="text-stone-300">
                {currentSources} of {maxSources} slots used
              </span>
            </div>
            <div className="h-2 w-full rounded bg-stone-850 overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded transition-all duration-500"
                style={{
                  width: `${quotaPercent}%`,
                  boxShadow: '0 0 8px rgba(245, 158, 11, 0.4)',
                }}
              />
            </div>
          </div>
        )}

        {/* Content Box */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {errorMsg && (
            <div className="mb-4 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 text-xs font-mono text-red-400">
              {errorMsg}
            </div>
          )}

          {loading ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3">
              <Loader2 size={24} className="animate-spin text-amber-500" />
              <span className="font-mono text-xs uppercase tracking-widest text-stone-500">
                Loading database...
              </span>
            </div>
          ) : sources.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone-800 p-8 text-center bg-stone-950/10">
              <HardDrive
                size={32}
                className="text-stone-700 stroke-dasharray mb-2"
              />
              <p className="text-sm text-stone-400 font-semibold">
                No uploaded sources yet
              </p>
              <p className="text-xs text-stone-500 max-w-xs font-mono">
                Click Upload under the custom tab in the picker to add audio
                files.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map((src) => {
                const isEditing = editingId === src.id;
                const isUpdating = updatingId === src.id;
                const isDeleting = deletingId === src.id;
                const isPlaying = playingId === src.id;

                return (
                  <div
                    key={src.id}
                    className="flex flex-col gap-3 rounded-lg border border-stone-850 bg-stone-950/25 p-4.5 hover:border-stone-800 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: Metadata & Editing */}
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-2 max-w-md">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              disabled={isUpdating}
                              maxLength={120}
                              className="flex-1 rounded border border-stone-700 bg-stone-950 px-2.5 py-1 text-xs font-mono text-stone-200 focus:border-amber-500 focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => void saveRename(src.id)}
                              disabled={isUpdating || editName.trim() === ''}
                              className="rounded bg-amber-500 p-1 text-stone-950 hover:bg-amber-400 transition-colors"
                              aria-label="Save name"
                            >
                              {isUpdating ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Check size={14} />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={cancelRename}
                              disabled={isUpdating}
                              className="rounded border border-stone-700 p-1 text-stone-400 hover:text-stone-200 transition-colors"
                              aria-label="Cancel rename"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-xs font-semibold text-stone-200 font-mono">
                              {src.display_name || 'Untitled'}
                            </h3>
                            <button
                              type="button"
                              onClick={() => startRename(src)}
                              className="text-stone-500 hover:text-stone-300 transition-colors"
                              aria-label="Rename source"
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                        )}

                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-stone-500">
                          <span>{(src.duration_ms / 1000).toFixed(2)}s</span>
                          <span>{formatSize(src.bytes)}</span>
                          <span>
                            {src.ref_count > 0
                              ? `Used in ${src.ref_count} patch${src.ref_count === 1 ? '' : 'es'}`
                              : 'Unused'}
                          </span>
                          <span className="capitalize">{src.visibility}</span>
                        </div>
                      </div>

                      {/* Right: Deletion & Play Preview */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => togglePreview(src)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-800 bg-stone-900 text-stone-400 hover:text-stone-200 active:bg-stone-950 transition-all"
                          aria-label={
                            isPlaying ? 'Pause preview' : 'Play preview'
                          }
                        >
                          {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => initiateDelete(src)}
                          disabled={isDeleting}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-800 text-stone-500 hover:text-red-400 hover:border-red-950 active:bg-red-950/20 transition-all"
                          aria-label="Delete source"
                        >
                          {isDeleting ? (
                            <Loader2
                              size={12}
                              className="animate-spin text-stone-600"
                            />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Waveform Visualization */}
                    <UserSourceWaveform sourceId={src.id} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-stone-850 p-5 shrink-0 flex justify-end bg-stone-950/15">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-stone-800 px-5 py-2 text-xs font-semibold text-stone-200 hover:bg-stone-750 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Confirmation Dialog for safety-critical ref_count deletions */}
      {confirmDeleteSource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/90 backdrop-blur-sm"
          onClick={() => setConfirmDeleteSource(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-red-900 bg-stone-900 p-6 shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <AlertTriangle size={24} />
              <h3 className="text-sm font-semibold uppercase tracking-wider font-mono">
                Confirm Destruction
              </h3>
            </div>

            <p className="text-xs text-stone-300 font-mono mb-4 leading-relaxed">
              &ldquo;{confirmDeleteSource.display_name}&rdquo; is referenced by{' '}
              <span className="text-amber-500 font-bold">
                {confirmDeleteSource.ref_count}
              </span>{' '}
              active patch{confirmDeleteSource.ref_count === 1 ? '' : 'es'} in
              the gallery.
            </p>

            <div className="rounded-lg bg-red-950/20 border border-red-900/40 px-3.5 py-3 text-[11px] text-red-400 font-mono mb-6 leading-relaxed">
              <strong>Warning:</strong> Deleting this canonical source is
              irreversible and will cause those patches to load with{' '}
              <span className="underline">Glass Pad</span> (the bundled
              fallback).
            </div>

            <div className="flex justify-end gap-3.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteSource(null)}
                className="rounded px-4 py-2 text-xs font-medium text-stone-400 hover:text-stone-200 transition-colors"
              >
                Keep File
              </button>
              <button
                type="button"
                onClick={() => void performDelete(confirmDeleteSource.id)}
                disabled={deletingId !== null}
                className="rounded bg-red-650 px-4 py-2 text-xs font-semibold text-white hover:bg-red-550 active:bg-red-750 transition-colors flex items-center gap-1.5"
              >
                {deletingId !== null ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Force Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
