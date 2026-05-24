import { useCallback, useImperativeHandle, useState, forwardRef } from 'react';
import { Disc3, Download, Link as LinkIcon, Trash2 } from 'lucide-react';
import { api } from '@/api/client';
import type { Recording } from '@/api/types';

export interface MyRecordingsHandle {
  refresh: () => void;
}

interface MyRecordingsProps {
  showToast: (msg: string) => void;
}

function fmtDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

/**
 * Sibling drawer to My Patches, listing the user's recordings. Per item: inline
 * play, download, delete, and copy `/r/<slug>` share link.
 */
const MyRecordings = forwardRef<MyRecordingsHandle, MyRecordingsProps>(
  function MyRecordings({ showToast }, ref) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<Recording[]>([]);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
      setBusy(true);
      try {
        setItems((await api.myRecordings()).items);
      } catch {
        showToast('Could not load recordings');
      }
      setBusy(false);
    }, [showToast]);

    useImperativeHandle(ref, () => ({ refresh: () => void refresh() }), [
      refresh,
    ]);

    const toggle = useCallback(() => {
      const next = !open;
      setOpen(next);
      if (next) void refresh();
    }, [open, refresh]);

    const remove = useCallback(
      async (id: string) => {
        try {
          await api.deleteRecording(id);
          setItems((prev) => prev.filter((r) => r.id !== id));
        } catch {
          showToast('Could not delete recording');
        }
      },
      [showToast],
    );

    const copyLink = useCallback(
      async (slug: string) => {
        const url = `${window.location.origin}/r/${slug}`;
        try {
          await navigator.clipboard.writeText(url);
          showToast('Recording link copied');
        } catch {
          showToast(url);
        }
      },
      [showToast],
    );

    return (
      <>
        <button
          type="button"
          onClick={toggle}
          aria-label="Open your recordings"
          className="group flex items-center gap-2 rounded-full px-4 py-2.5 transition-all"
          style={{
            background: 'rgba(245, 158, 11, 0.04)',
            border: '1px solid #44403c',
            color: '#d6d3d1',
          }}
        >
          <Disc3 size={13} strokeWidth={1.5} style={{ color: '#78716c' }} />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
            Recordings
          </span>
        </button>

        {open && (
          <div
            className="fixed inset-0 z-50 flex justify-end"
            style={{ background: 'rgba(12, 10, 9, 0.6)' }}
            onClick={() => setOpen(false)}
          >
            <aside
              className="h-full w-full max-w-sm overflow-y-auto p-6"
              style={{ background: '#0c0a09', borderLeft: '1px solid #44403c' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em]"
                style={{ color: '#fef3c7' }}
              >
                My recordings
              </h2>

              {busy && (
                <p
                  className="font-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: '#78716c' }}
                >
                  Loading…
                </p>
              )}
              {!busy && items.length === 0 && (
                <p className="font-body text-sm" style={{ color: '#78716c' }}>
                  No recordings yet. Hit Record while a session plays.
                </p>
              )}

              <ul className="flex flex-col gap-3">
                {items.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-xl p-3"
                    style={{ border: '1px solid #292524' }}
                  >
                    <div
                      className="font-body text-sm"
                      style={{ color: '#f5f5f4' }}
                    >
                      {r.title || 'Untitled session'}
                    </div>
                    <div
                      className="mb-2 mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em]"
                      style={{ color: '#78716c' }}
                    >
                      <span>{r.format}</span>
                      <span>{fmtDuration(r.duration_ms)}</span>
                      <span>{r.visibility}</span>
                    </div>
                    <audio
                      controls
                      preload="none"
                      src={api.recordingAudioUrl(r.id)}
                      className="mb-2 w-full"
                      style={{ height: 32 }}
                    />
                    <div className="flex items-center gap-4">
                      <a
                        href={api.recordingAudioUrl(r.id)}
                        download
                        aria-label="Download recording"
                        style={{ color: '#78716c' }}
                      >
                        <Download size={14} strokeWidth={1.5} />
                      </a>
                      <button
                        type="button"
                        aria-label="Copy share link"
                        onClick={() => void copyLink(r.short_slug)}
                        style={{ color: '#78716c' }}
                      >
                        <LinkIcon size={14} strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete recording"
                        onClick={() => void remove(r.id)}
                        style={{ color: '#78716c' }}
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        )}
      </>
    );
  },
);

export default MyRecordings;
